/**
 * 목적: 인용 판정 `str()` 의 조건 9개를 하나씩 짚는다 (SDD-09 §2-5 검증 목록).
 * 왜 이 구조인가: 인용을 빠뜨리면 표의 열이 밀리거나 키가 둘로 읽혀 파일이 **조용히** 깨진다.
 *   반대로 필요 없는 인용을 하면 씨앗과 바이트가 달라져 골든 왕복이 깨진다. 양쪽 다 검사한다.
 * 바꾸면 안 되는 것: "쉬움" 같은 한글이 인용 없이 나가야 한다는 단언 — 씨앗이 그 형태다.
 * 근거: SDD-09 §2-2 [D-09-02], SDD-09 §2-5 [D-09-02]
 */
import { describe, expect, it } from 'vitest';
import { needsQuote, str } from './quote.js';

describe('str — 인용하지 않는 경우', () => {
  it.each([
    ['쉬움', '한글은 그대로'],
    ['보통', '한글은 그대로'],
    ['Robot_Walker', '영문+밑줄'],
    ['N13_exit', '숫자가 섞인 식별자'],
    ['Escortee+Ally', '+ 는 구조 문자가 아니다'],
    ['pmf.stage/1', '점과 슬래시'],
    ['~', '맵 문자'],
  ])('%s — %s', (input) => {
    expect(needsQuote(input)).toBe(false);
    expect(str(input)).toBe(input);
  });
});

describe('str — 인용하는 경우 (SDD-09 §2-2)', () => {
  it.each([
    ['', '""', '빈 문자열'],
    [' x', '" x"', '앞 공백'],
    ['x ', '"x "', '뒤 공백'],
    ['true', '"true"', '불리언으로 읽힌다'],
    ['false', '"false"', '불리언으로 읽힌다'],
    ['null', '"null"', 'null 로 읽힌다'],
    ['12', '"12"', '숫자로 읽힌다'],
    ['-3.5', '"-3.5"', '숫자로 읽힌다'],
    ['1e5', '"1e5"', '지수 표기도 숫자다'],
    ['a,b', '"a,b"', '구분자 — 표의 열이 밀린다'],
    ['a: b', '"a: b"', '콜론 — 키로 읽힌다'],
    ['a[0]', '"a[0]"', '대괄호'],
    ['a{b}', '"a{b}"', '중괄호'],
    ['-x', '"-x"', '- 로 시작'],
    ['#x', '"#x"', '# 로 시작 — 주석으로 지워진다'],
  ])('%s → %s (%s)', (input, expected) => {
    expect(needsQuote(input)).toBe(true);
    expect(str(input)).toBe(expected);
  });

  it('이스케이프', () => {
    expect(str('a"b')).toBe('"a\\"b"');
    expect(str('a\\b')).toBe('"a\\\\b"');
    expect(str('a\nb')).toBe('"a\\nb"');
    expect(str('a\tb')).toBe('"a\\tb"');
    expect(str('ab')).toBe('"a\\u0001b"');
  });
});
