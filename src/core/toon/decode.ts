/**
 * 목적: TOON 트리(parseToon)를 StageDocument 로 변환. 스키마를 안다.
 * 왜 이 구조인가: parseToon 은 범용 파서, decode 가 스키마 매핑. 필수 키 누락 = 오류, 기본값 없음.
 * 바꾸면 안 되는 것: `rows[r] ↔ y = height-1-r` 변환은 decode/encode 에서만.
 *   helper 함수명을 파라미터명과 다르게 유지할 것 (e → mkErr).
 * 근거: SDD-08 §3 [D-08-03], SDD-09 §1 [D-09-01]
 */
import type { StageDocument, PathNode, PathEdge, SpawnEntry, CurveKey, DifficultyTier } from '../model/stage.js';
import type { ObjectNode, ToonValue } from './lexer.js';
import { Cell as C, cellFromChar } from '../model/cell.js';
import { parseToon } from './lexer.js';
import { SCHEMA } from '../schema.js';
import { migrate } from './migrate.js';

export interface DecodeError { line: number; path: string; message: string }
type R<T> = { ok: true; value: T } | { ok: false; error: DecodeError };
function mkErr(l: number, p: string, m: string): DecodeError { return { line: l, path: p, message: m }; }

function sv(n: ObjectNode, k: string): R<ToonValue> {
  const en = n.entries.get(k);
  if (en === undefined) return { ok: false, error: mkErr(n.line, k, `"${k}" 가 없다`) };
  if (en.kind !== 'scalar') return { ok: false, error: mkErr(en.line, k, `스칼라여야 하는데 ${en.kind}`) };
  return { ok: true, value: en.value };
}
function nv(n: ObjectNode, k: string): R<number> {
  const r = sv(n, k); if (!r.ok) return r;
  if (typeof r.value !== 'number') return { ok: false, error: mkErr(n.line, k, `숫자여야 하는데 "${r.value}"`) };
  return { ok: true, value: r.value };
}
function bv(n: ObjectNode, k: string): R<boolean> {
  const r = sv(n, k); if (!r.ok) return r;
  if (typeof r.value !== 'boolean') return { ok: false, error: mkErr(n.line, k, `불리언 " "${r.value}"`) };
  return { ok: true, value: r.value };
}
function strv(n: ObjectNode, k: string): R<string> {
  const r = sv(n, k); if (!r.ok) return r;
  if (typeof r.value !== 'string') return { ok: false, error: mkErr(n.line, k, `문자열이어야 하는데 ${r.value}`) };
  return { ok: true, value: r.value };
}
function obj(n: ObjectNode, k: string): R<ObjectNode> {
  const en = n.entries.get(k);
  if (en === undefined) return { ok: false, error: mkErr(n.line, k, `"${k}" 가 없다`) };
  if (en.kind !== 'object') return { ok: false, error: mkErr(en.line, k, `객체여야 하는데 ${en.kind}`) };
  return { ok: true, value: en };
}
function strArr(n: ObjectNode, k: string): R<string[]> {
  const en = n.entries.get(k);
  if (en === undefined) return { ok: false, error: mkErr(n.line, k, `"${k}" 가 없다`) };
  if (en.kind !== 'array') return { ok: false, error: mkErr(en.line, k, `배열여야 하는데 ${en.kind}`) };
  const items: string[] = [];
  for (let i = 0; i < en.items.length; i++) {
    if (typeof en.items[i] !== 'string') return { ok: false, error: mkErr(en.line, `${k}[${i}]`, `문자열이어야 하는데 ${en.items[i]}`) };
    items.push(en.items[i] as string);
  }
  return { ok: true, value: items };
}
function tbl<T>(n: ObjectNode, k: string, fn: (vals: ToonValue[], line: number) => R<T>): R<T[]> {
  const en = n.entries.get(k);
  if (en === undefined) return { ok: false, error: mkErr(n.line, k, `"${k}" 가 없다`) };
  if (en.kind !== 'table') return { ok: false, error: mkErr(en.line, k, `표여야 하는데 ${en.kind}`) };
  const out: T[] = [];
  for (let ri = 0; ri < en.rows.length; ri++) {
    const r = fn(en.rows[ri]!, en.line);
    if (!r.ok) return { ok: false, error: { line: r.error.line, path: `${k}[${ri}]`, message: r.error.message } };
    out.push(r.value);
  }
  return { ok: true, value: out };
}
/* -------------------------------------------------------------- */
/*  섹션 파서들 — 각 파라미터명을 helper(mkErr)와 다르게 유지한다  */
/* -------------------------------------------------------------- */

function decodeMap(m: ObjectNode): R<{ width: number; height: number; origin: [number, number]; cells: Uint8Array }> {
  const wR = nv(m, 'width'); if (!wR.ok) return wR;
  const hR = nv(m, 'height'); if (!hR.ok) return hR;
  const width = Math.floor(wR.value); const height = Math.floor(hR.value);
  const oe = m.entries.get('origin');
  let origin: [number, number];
  if (oe !== undefined) {
    if (oe.kind !== 'array') return { ok: false, error: mkErr(oe.line, 'map.origin', '배열이어야 함') };
    if (oe.items.length !== 2 || typeof oe.items[0] !== 'number' || typeof oe.items[1] !== 'number')
      return { ok: false, error: mkErr(oe.line, 'map.origin', '숫자 2개여야 함') };
    origin = [oe.items[0] as number, oe.items[1] as number];
  } else origin = [-(width / 2), -(height / 2)];

  const re = m.entries.get('rows');
  if (re === undefined) return { ok: false, error: mkErr(m.line, 'map.rows', '"rows" 가 없다') };
  if (re.kind !== 'table') return { ok: false, error: mkErr(re.line, 'map.rows', '표여야 함') };
  if (re.rows.length !== height) return { ok: false, error: mkErr(re.line, 'map.rows', `${height}행인데 ${re.rows.length}행`) };

  const cells = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) {
    const row = re.rows[r]!; if (row.length !== 1 || typeof row[0] !== 'string')
      return { ok: false, error: mkErr(re.line, `map.rows[${r}]`, '문자열 1열이어야 함') };
    const s = row[0] as string; if (s.length !== width)
      return { ok: false, error: mkErr(re.line, `map.rows[${r}]`, `길이 ${width}인데 ${s.length}`) };
    const y = height - 1 - r;
    for (let x = 0; x < width; x++) {
      const cell = cellFromChar(s[x]!); if (cell === undefined)
        return { ok: false, error: mkErr(re.line, `map.rows[${r}]`, `알 수 없는 문자 '${s[x]}'`) };
      cells[y * width + x] = cell === C.Empty ? 255 : cell;
    }
  }
  return { ok: true, value: { width, height, origin, cells } };
}

function decodePath(p: ObjectNode): R<{ nodes: PathNode[]; edges: PathEdge[] }> {
  const nodes = tbl(p, 'nodes', (v, l) => {
    if (v.length < 4 || typeof v[0] !== 'string' || typeof v[1] !== 'number' || typeof v[2] !== 'number' || typeof v[3] !== 'string')
      return { ok: false, error: mkErr(l, '', 'id,x,y,role') };
    if (!['start','exit','branch','waypoint'].includes(v[3] as string))
      return { ok: false, error: mkErr(l, '', `role "${v[3]}" 유효하지 않음`) };
    return { ok: true, value: { id: v[0] as string, x: v[1] as number, y: v[2] as number, role: v[3] as PathNode['role'] } };
  }); if (!nodes.ok) return nodes;
  const edges = tbl(p, 'edges', (v, l) => {
    if (v.length < 5 || typeof v[0] !== 'string' || typeof v[1] !== 'string' || typeof v[2] !== 'string' || typeof v[3] !== 'boolean' || typeof v[4] !== 'boolean')
      return { ok: false, error: mkErr(l, '', 'from,to,allowed,bidirectional,shortcut') };
    const as = v[2] as string; let allowed: PathEdge['allowed'];
    if (as === 'All') allowed = ['Escortee','Enemy','Ally'];
    else { const p2 = as.split('+').map(s => s.trim()); for (const a of p2) { if (!['Escortee','Enemy','Ally'].includes(a)) return { ok: false, error: mkErr(l, '', `allowed "${a}" 유효하지 않음`) }; } allowed = p2 as PathEdge['allowed']; }
    return { ok: true, value: { from: v[0] as string, to: v[1] as string, allowed, bidirectional: v[3] as boolean, shortcut: v[4] as boolean } };
  }); if (!edges.ok) return edges;
  return { ok: true, value: { nodes: nodes.value, edges: edges.value } };
}
type SpawnShape = { volleyCount: number; volleySpacing: number; restSeconds: number; telegraphSeconds: number; table: SpawnEntry[]; healthByProgress: CurveKey[] };
function decodeSpawn(s: ObjectNode): R<SpawnShape> {
  const vc = nv(s, 'volleyCount'); if (!vc.ok) return vc; const vs = nv(s, 'volleySpacing'); if (!vs.ok) return vs;
  const rs = nv(s, 'restSeconds'); if (!rs.ok) return rs; const ts = nv(s, 'telegraphSeconds'); if (!ts.ok) return ts;
  const tr = tbl(s, 'table', (v, l) => {
    if (v.length < 2 || typeof v[0] !== 'string' || typeof v[1] !== 'number') return { ok: false, error: mkErr(l, '', 'enemy:string,weight:number') };
    return { ok: true, value: { enemy: v[0] as string, weight: v[1] as number } };
  }); if (!tr.ok) return tr;
  const hp = tbl(s, 'healthByProgress', (v, l) => {
    if (v.length < 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') return { ok: false, error: mkErr(l, '', 't:number,mul:number') };
    return { ok: true, value: { t: v[0] as number, mul: v[1] as number } };
  }); if (!hp.ok) return hp;
  return { ok: true, value: { volleyCount: vc.value, volleySpacing: vs.value, restSeconds: rs.value, telegraphSeconds: ts.value, table: tr.value, healthByProgress: hp.value } };
}

function decodeBurst(b: ObjectNode): R<{ triggerNodeIds: string[]; duration: number; volleyCount: number; restSeconds: number; recoverySpeedMultiplier: number; recoverySeconds: number }> {
  const ids: R<string[]> = b.entries.has('triggerNodeIds') ? strArr(b, 'triggerNodeIds') : { ok: true as const, value: [] as string[] };
  if (!ids.ok) return ids; const d = nv(b, 'duration'); if (!d.ok) return d; const vc = nv(b, 'volleyCount'); if (!vc.ok) return vc;
  const rs = nv(b, 'restSeconds'); if (!rs.ok) return rs; const rsm = nv(b, 'recoverySpeedMultiplier'); if (!rsm.ok) return rsm;
  const rsc = nv(b, 'recoverySeconds'); if (!rsc.ok) return rsc;
  return { ok: true, value: { triggerNodeIds: ids.value, duration: d.value, volleyCount: vc.value, restSeconds: rs.value, recoverySpeedMultiplier: rsm.value, recoverySeconds: rsc.value } };
}

function decodeEconomy(ec: ObjectNode): R<{ startingResource: number; shortcutCost: number; difficulties: DifficultyTier[] }> {
  const sr = nv(ec, 'startingResource'); if (!sr.ok) return sr; const sc = nv(ec, 'shortcutCost'); if (!sc.ok) return sc;
  const df = tbl(ec, 'difficulties', (v, l) => {
    if (v.length < 4 || typeof v[0] !== 'string' || typeof v[1] !== 'string' || typeof v[2] !== 'number' || typeof v[3] !== 'number')
      return { ok: false, error: mkErr(l, '', 'difficulty,displayName,killReward,resPerSec') };
    if (!['Easy','Normal','Hard'].includes(v[0] as string)) return { ok: false, error: mkErr(l, '', `difficulty="${v[0]}" 안 맞음`) };
    return { ok: true, value: { difficulty: v[0] as DifficultyTier['difficulty'], displayName: v[1] as string, killReward: v[2] as number, resourcePerSecond: v[3] as number } };
  }); if (!df.ok) return df;
  return { ok: true, value: { startingResource: sr.value, shortcutCost: sc.value, difficulties: df.value } };
}

function decodeEscortee(es: ObjectNode): R<{ speed: number; maxHealth: number }> {
  const sp = nv(es, 'speed'); if (!sp.ok) return sp; const mh = nv(es, 'maxHealth'); if (!mh.ok) return mh;
  return { ok: true, value: { speed: sp.value, maxHealth: mh.value } };
}

function decodeMother(mt: ObjectNode): R<{ speed: number; spawnDelay: number; followsPath: boolean }> {
  const sp = nv(mt, 'speed'); if (!sp.ok) return sp; const sd = nv(mt, 'spawnDelay'); if (!sd.ok) return sd;
  const fp = bv(mt, 'followsPath'); if (!fp.ok) return fp;
  return { ok: true, value: { speed: sp.value, spawnDelay: sd.value, followsPath: fp.value } };
}
function decodePresentation(pr: ObjectNode): R<{ uiSlowMotionScale: number; shotLineSeconds: number; magicMissileSpeed: number; hitFlashSeconds: number; debrisCount: number; debrisSeconds: number; healthBarHideWhenFull: boolean; masterVolume: number }> {
  const u = nv(pr, 'uiSlowMotionScale'); if (!u.ok) return u; const sl = nv(pr, 'shotLineSeconds'); if (!sl.ok) return sl;
  const mm = nv(pr, 'magicMissileSpeed'); if (!mm.ok) return mm; const hf = nv(pr, 'hitFlashSeconds'); if (!hf.ok) return hf;
  const dc = nv(pr, 'debrisCount'); if (!dc.ok) return dc; const ds = nv(pr, 'debrisSeconds'); if (!ds.ok) return ds;
  const hb = bv(pr, 'healthBarHideWhenFull'); if (!hb.ok) return hb; const mv = nv(pr, 'masterVolume'); if (!mv.ok) return mv;
  return { ok: true, value: { uiSlowMotionScale: u.value, shotLineSeconds: sl.value, magicMissileSpeed: mm.value, hitFlashSeconds: hf.value, debrisCount: dc.value, debrisSeconds: ds.value, healthBarHideWhenFull: hb.value, masterVolume: mv.value } };
}

function decodeToggles(tg: ObjectNode): R<{ alliesCanDieWhileMarching: boolean; enemiesTargetAllies: boolean }> {
  const ac = bv(tg, 'alliesCanDieWhileMarching'); if (!ac.ok) return ac; const et = bv(tg, 'enemiesTargetAllies'); if (!et.ok) return et;
  return { ok: true, value: { alliesCanDieWhileMarching: ac.value, enemiesTargetAllies: et.value } };
}

export function decode(text: string): R<StageDocument> {
  const parsed = parseToon(text);
  if (!parsed.ok) return { ok: false, error: { line: parsed.error.line, path: '', message: parsed.error.message } };
  const migrated = migrate(parsed.value);
  if (!migrated.ok) return { ok: false, error: { line: migrated.error.line, path: 'schema', message: migrated.error.message } };
  const root = migrated.value;
  const se = root.entries.get('schema');
  const sv1 = se?.kind === 'scalar' ? se.value : '(없음)';
  if (sv1 !== SCHEMA) return { ok: false, error: mkErr(root.line, 'schema', `schema="${sv1}" 다. ${SCHEMA} 만 읽는다`) };
  const ne = strv(root, 'name'); if (!ne.ok) return ne;
  const mo = obj(root, 'map'); if (!mo.ok) return mo; const mr = decodeMap(mo.value); if (!mr.ok) return mr;
  const po = obj(root, 'path'); if (!po.ok) return po; const pr = decodePath(po.value); if (!pr.ok) return pr;
  const so = obj(root, 'spawn'); if (!so.ok) return so; const sr = decodeSpawn(so.value); if (!sr.ok) return sr;
  const bo = obj(root, 'burst'); if (!bo.ok) return bo; const br = decodeBurst(bo.value); if (!br.ok) return br;
  const eo = obj(root, 'economy'); if (!eo.ok) return eo; const er = decodeEconomy(eo.value); if (!er.ok) return er;
  const e2o = obj(root, 'escortee'); if (!e2o.ok) return e2o; const e2r = decodeEscortee(e2o.value); if (!e2r.ok) return e2r;
  const mto = obj(root, 'mother'); if (!mto.ok) return mto; const mtr = decodeMother(mto.value); if (!mtr.ok) return mtr;
  const pro = obj(root, 'presentation'); if (!pro.ok) return pro; const prr = decodePresentation(pro.value); if (!prr.ok) return prr;
  const to = obj(root, 'toggles'); if (!to.ok) return to; const tr = decodeToggles(to.value); if (!tr.ok) return tr;
  return { ok: true, value: { schema: SCHEMA, name: ne.value, map: mr.value, path: pr.value, spawn: sr.value, burst: br.value, economy: er.value, escortee: e2r.value, mother: mtr.value, presentation: prr.value, toggles: tr.value } };
}