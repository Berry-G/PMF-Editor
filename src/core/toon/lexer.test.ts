/**
 * 목적: TOON 파서(lexer) 단위 테스트. SDD-09 §1-5 검증 목록을 그대로 구현.
 * 왜 이 구조인가: 파서가 조용히 넘어가는 경우(표 행 부족·키 중복·null 등)가 없어야 한다.
 *   모든 오류는 메시지에 행 번호를 포함해야 한다.
 * 바꾸면 안 되는 것: 정상 6종·오류 9종 전부. 오류마다 행 번호 확인.
 * 근거: SDD-09 §1-5 [D-09-01-5]
 */
import { describe, expect, it } from 'vitest';
import { parseToon } from './lexer.js';
import type { ScalarNode } from './lexer.js';

function scalar(r: any, key: string): any {
  const e = r?.entries?.get?.(key);
  if (e?.kind === 'scalar') return (e as ScalarNode).value;
  return undefined;
}

describe('TOON 파서 §1-5', () => {
  describe('정상', () => {
    it('스칼라 4종 (문자열·숫자·true·false)', () => {
      const r = parseToon('s: hello\nn: 42\nb: true\no: false');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(scalar(r.value, 's')).toBe('hello');
        expect(scalar(r.value, 'n')).toBe(42);
        expect(scalar(r.value, 'b')).toBe(true);
        expect(scalar(r.value, 'o')).toBe(false);
      }
    });
    it('중첩 3단', () => {
      const r = parseToon('a:\n  b:\n    c: 1');
      expect(r.ok).toBe(true);
    });
    it('빈 배열 [0]:', () => {
      const r = parseToon('arr[0]:');
      expect(r.ok).toBe(true);
      if (r.ok) {
        const e = r.value.entries.get('arr');
        if (e?.kind === 'array') expect(e.items).toEqual([]);
      }
    });
    it('표 1열', () => {
      const r = parseToon('t[2]{x}:\n  1\n  2');
      expect(r.ok).toBe(true);
    });
    it('표 4열', () => {
      const r = parseToon('t[2]{a,b,c,d}:\n  1,2,3,4\n  5,6,7,8');
      expect(r.ok).toBe(true);
    });
    it('인용 안 콤마·콜론, 이스케이프', () => {
      const r = parseToon('s: "a,b"\nt: "x:y"\nu: "hello\\nworld"');
      expect(r.ok).toBe(true);
    });
  });

  describe('오류 — 행 번호 포함 확인', () => {
    it('탭 → 오류', () => {
      const r = parseToon('key:\n\tval');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.line).toBe(2);
    });
    it('홀수 들여쓰기 → 오류', () => {
      const r = parseToon('key:\n   val');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(2); expect(r.error.message).toMatch(/홀수/); }
    });
    it('표 행 부족 → 오류', () => {
      const r = parseToon('t[3]{x}:\n  1\n  2');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(1); expect(r.error.message).toMatch(/3행인데 2행/); }
    });
    it('표 행 초과 → 오류', () => {
      const r = parseToon('t[1]{x}:\n  1\n  2');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(3); expect(r.error.message).toMatch(/1행인데 더 있음/); }
    });
    it('열 수 불일치 → 오류', () => {
      const r = parseToon('t[1]{a,b}:\n  1,2,3');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(2); expect(r.error.message).toMatch(/2열인데 3열/); }
    });
    it('키 중복 → 오류', () => {
      const r = parseToon('k: 1\nk: 2');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(2); expect(r.error.message).toMatch(/중복/); }
    });
    it('null → 오류', () => {
      const r = parseToon('k: null');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/null/);
    });
    it('닫히지 않은 인용 → 오류', () => {
      const r = parseToon('k: "hello');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(1); expect(r.error.message).toMatch(/닫히지 않은/); }
    });
    it('콜론 뒤 공백 없음 → 오류', () => {
      const r = parseToon('k:value');
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error.line).toBe(1); expect(r.error.message).toMatch(/해석 불가/); }
    });
  });
});
