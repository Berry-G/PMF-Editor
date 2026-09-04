/**
 * 목적: formatNumber / str 단위 테스트. SDD-09 §2-5 검증 목록.
 * 왜 이 구조인가: formatNumber 는 정수는 "150", 실수는 최단 왕복, 지수 표기 금지.
 *   str 은 인용 판정이 정확해야 한다.
 * 바꾸면 안 되는 것: 6케이스 + 5케이스 전부.
 * 근거: SDD-09 §2-5 [D-09-02-5]
 */
import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber } from './number.js';

describe('formatNumber §2-5', () => {
  it('150 → "150"', () => expect(formatNumber(150)).toBe('150'));
  it('0.42 → "0.42"', () => expect(formatNumber(0.42)).toBe('0.42'));
  it('8.2 → "8.2"', () => expect(formatNumber(8.2)).toBe('8.2'));
  it('-16 → "-16"', () => expect(formatNumber(-16)).toBe('-16'));
  it('1e21 → throw', () => expect(() => formatNumber(1e21)).toThrow());
  it('-0 → "0"', () => expect(formatNumber(-0)).toBe('0'));
  it('NaN → throw', () => expect(() => formatNumber(NaN)).toThrow());
  it('Infinity → throw', () => expect(() => formatNumber(Infinity)).toThrow());
});

describe('parseNumber §2-5', () => {
  it('"150" → 150', () => expect(parseNumber('150')).toBe(150));
  it('"0.42" → 0.42', () => expect(parseNumber('0.42')).toBe(0.42));
  it('빈 문자열 → undefined', () => expect(parseNumber('')).toBeUndefined());
  it('"abc" → undefined', () => expect(parseNumber('abc')).toBeUndefined());
});