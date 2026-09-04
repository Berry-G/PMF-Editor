/**
 * 목적: TOON 텍스트를 범용 트리(ToonNode)로 파싱. 스키마를 모른다.
 * 왜 이 구조인가: TOON 사양 전체 대신 부분집합만 쓰므로 직접 구현이 더 작고 단순하다.
 *   디코더(decode.ts)가 스키마를 알아서 변환하고, C# 임포터(ToonReader)와 1:1 대응한다.
 * 바꾸면 안 되는 것: 주석 제거 pre-pass, 들여쓰기 2칸 단위, null 금지, 조용히 무시 금지.
 * 근거: SDD-02 §6 [D-02-07], SDD-09 §1 [D-09-01], SDD-05 §3 [D-05-03]
 */
export type ToonValue = string | number | boolean;
export interface ScalarNode { kind: 'scalar'; value: ToonValue; line: number }
export interface ArrayNode { kind: 'array'; items: ToonValue[]; line: number }
export interface TableNode { kind: 'table'; fields: string[]; rows: ToonValue[][]; line: number }
export interface ObjectNode { kind: 'object'; entries: Map<string, ToonNode>; line: number }
export type ToonNode = ObjectNode | ScalarNode | ArrayNode | TableNode;
export interface ToonError { line: number; message: string }
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

interface Line { line: number; depth: number; body: string }

function preprocess(text: string): { lines: Line[]; error: null } | { lines: null; error: ToonError } {
  const raw = text.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]!.trimEnd();
    raw[i] = t.endsWith('\r') ? t.slice(0, -1) : t;
  }
  const lines: Line[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]!; const ln = i + 1;
    if (r.trimEnd() === '') continue;
    if (/^\s*#/.test(r)) continue;
    if (r.includes('\t')) return { lines: null, error: { line: ln, message: '탭 금지' } };
    const indent = r.length - r.trimStart().length;
    if (indent % 2 !== 0) return { lines: null, error: { line: ln, message: `들여쓰기 홀수(${indent})` } };
    lines.push({ line: ln, depth: indent / 2, body: r.trim() });
  }
  return { lines, error: null };
}

function splitDelimited(s: string): string[] {
  const out: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQ) {
      if (c === '\\') { cur += c; i++; if (i < s.length) cur += s[i]!; }
      else { if (c === '"') inQ = false; cur += c; }
    } else {
      if (c === '"') { inQ = true; cur += c; }
      else if (c === ',') { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

class ParseValueError extends Error { line: number; constructor(l: number, m: string) { super(m); this.line = l; } }

function parseValue(t: string, line: number): ToonValue {
  if (t === 'true') return true; if (t === 'false') return false;
  if (t === 'null') throw new ParseValueError(line, 'null 금지');
  if (t.startsWith('"')) { if (!t.endsWith('"') || t.length < 2) throw new ParseValueError(line, '닫히지 않은 인용'); return unescape(t.slice(1, -1), line); }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)) { const n = Number(t); if (Number.isFinite(n)) return n; }
  if (t === '') throw new ParseValueError(line, '빈 값은 "" 으로');
  return t;
}
function unescape(s: string, line: number): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const c = s[++i]!;
      switch (c) {
        case '\\': out += '\\'; break; case '"': out += '"'; break;
        case 'n': out += '\n'; break; case 'r': out += '\r'; break; case 't': out += '\t'; break;
        case 'u': {
          const h = s.slice(i + 1, i + 5);
          if (h.length < 4 || !/^[0-9a-fA-F]+$/.test(h)) throw new ParseValueError(line, '\\uXXXX 오류');
          out += String.fromCodePoint(Number.parseInt(h, 16)); i += 4; break;
        }
        default: throw new ParseValueError(line, `알 수 없는 이스케이프 \\${c}`);
      }
    } else out += s[i]!;
  }
  return out;
}

const RE_TABLE = /^([A-Za-z_][A-Za-z0-9_.]*)\[(\d+)\]\{([^}]*)\}:$/;
const RE_ARRAY = /^([A-Za-z_][A-Za-z0-9_.]*)\[(\d+)\]:(.*)$/;
const RE_OBJECT = /^([A-Za-z_][A-Za-z0-9_.]*):$/;
const RE_SCALAR = /^([A-Za-z_][A-Za-z0-9_.]*):\s(.*)$/;

function mObj(l: number): ObjectNode { return { kind: 'object', entries: new Map(), line: l }; }
function mScl(v: ToonValue, l: number): ScalarNode { return { kind: 'scalar', value: v, line: l }; }
function mArr(v: ToonValue[], l: number): ArrayNode { return { kind: 'array', items: v, line: l }; }
function mTbl(f: string[], r: ToonValue[][], l: number): TableNode { return { kind: 'table', fields: f, rows: r, line: l }; }

function parseObject(depth: number, startIdx: number, lines: Line[]): { node: ObjectNode; nextIdx: number } | ToonError {
  const node = mObj(startIdx < lines.length ? lines[startIdx]!.line : 0);
  let k = startIdx;
  while (k < lines.length && lines[k]!.depth === depth) {
    const L = lines[k]!;
    if (L.depth > depth) return { line: L.line, message: '들여쓰기 너무 깊음' };
    const tm = L.body.match(RE_TABLE);
    if (tm !== null) {
      const key = tm[1]!; const n = Number(tm[2]);
      const fields = tm[3]!.split(',').map(f => f.trim()).filter((f: string) => f !== '');
      if (fields.length === 0) return { line: L.line, message: `표 ${key} 필드명 없음` };
      const rows: ToonValue[][] = [];
      for (let ri = 0; ri < n; ri++) {
        const idx = k + 1 + ri; if (idx >= lines.length || lines[idx]!.depth !== depth + 1) return { line: L.line, message: `표 ${key} ${n}행인데 ${ri}행` };
        const cells = splitDelimited(lines[idx]!.body); if (cells.length !== fields.length) return { line: lines[idx]!.line, message: `${fields.length}열인데 ${cells.length}열` };
        const pv: ToonValue[] = []; for (const cell of cells) { try { pv.push(parseValue(cell, lines[idx]!.line)); } catch (e) { if (e instanceof ParseValueError) return { line: e.line, message: e.message }; throw e; } }
        rows.push(pv);
      }
const nxt = k + 1 + n;
      if (nxt < lines.length && lines[nxt]!.depth === depth + 1) return { line: lines[nxt]!.line, message: `표 ${key} ${n}행인데 더 있음` };
      if (node.entries.has(key)) return { line: L.line, message: `키 ${key} 중복` };
      node.entries.set(key, mTbl(fields, rows, L.line)); k = nxt; continue;
    }
    const am = L.body.match(RE_ARRAY);
    if (am !== null) {
      const key = am[1]!; const n = Number(am[2]); const rest = am[3]!;
      try { const items = n === 0 ? [] : splitDelimited(rest).map(v => parseValue(v, L.line)); if (items.length !== n) return { line: L.line, message: `배열 ${key} ${n}개인데 ${items.length}개` }; if (node.entries.has(key)) return { line: L.line, message: `키 ${key} 중복` }; node.entries.set(key, mArr(items, L.line)); k++; continue; }
      catch (e) { if (e instanceof ParseValueError) return { line: e.line, message: e.message }; throw e; }
    }
    const om = L.body.match(RE_OBJECT);
    if (om !== null) {
      const key = om[1]!; if (node.entries.has(key)) return { line: L.line, message: `키 ${key} 중복` };
      const r2 = parseObject(depth + 1, k + 1, lines); if ('line' in r2) return r2;
      if (r2.node.entries.size === 0) return { line: L.line, message: '빈 객체' };
      node.entries.set(key, r2.node); k = r2.nextIdx; continue;
    }
    const sm = L.body.match(RE_SCALAR);
    if (sm !== null) {
      const key = sm[1]!; const rv = sm[2]!; if (node.entries.has(key)) return { line: L.line, message: `키 ${key} 중복` };
      try { node.entries.set(key, mScl(parseValue(rv, L.line), L.line)); k++; continue; }
      catch (e) { if (e instanceof ParseValueError) return { line: e.line, message: e.message }; throw e; }
    }
    return { line: L.line, message: `해석 불가: ${L.body}` };
  }
  return { node, nextIdx: k };
}

export function parseToon(text: string): Result<ObjectNode, ToonError> {
  const pre = preprocess(text);
  if (pre.error !== null) return { ok: false, error: pre.error };
  if (pre.lines.length === 0) return { ok: false, error: { line: 0, message: '파일이 비었다' } };
  const result = parseObject(0, 0, pre.lines);
  if ('line' in result) return { ok: false, error: { line: result.line, message: result.message } };
  if (result.nextIdx < pre.lines.length) return { ok: false, error: { line: pre.lines[result.nextIdx]!.line, message: '루트 깊이 아님' } };
  return { ok: true, value: result.node };
}