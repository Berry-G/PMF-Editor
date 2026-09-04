/**
 * 목적: TOON 정규 출력을 위한 숫자 변환. 게임 C# float 과 JS number 를 같은 문자열로 맞춘다.
 * 왜 이 구조인가: JS `Number.prototype.toString` 이 최단 왕복 표현이라 정수는 `"150"`, 실수는 `"0.42"` 가 된다.
 *   지수 표기는 쓰지 않는다 — 이 도메인에 그런 값이 없기 때문이다.
 *   게임 쪽은 `((float)v).ToString("R")` 을 쓴다 — `double` 로 올려 찍으면 `0.41999998` 이 된다.
 * 바꾸면 안 되는 것: `formatNumber` 에 `toFixed` 를 쓰거나 지수 표기를 허용하지 마라.
 *   `parseNumber` 는 JS `Number()` 대신 정규식으로 숫자 패턴만 허용해야 한다 — 빈 문자열이 0 이 되는 사고 방지.
 * 근거: SDD-02 §6-1 [D-02-08], SDD-09 §2-3 [D-09-02-3]
 */

/** 숫자를 TOON 정규 출력 형식으로 바꾼다. NaN/Infinity → throw. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`숫자가 아님: ${n}`);
  // 왜: `-0` 을 `"-0"` 대신 `"0"` 으로 쓴다 — git diff 가 깨끗해야 한다.
  if (Object.is(n, -0)) return '0';
  const s = Number.isInteger(n) ? String(n) : String(n);
  // 왜: 이 도메인(속도 0.1~1, 시간 0~600, 크기 8~256)에는 지수 표기가 없다. 있으면 설계 오류.
  if (s.includes('e') || s.includes('E')) {
    throw new Error(`지수 표기 금지: ${s} (값 ${n})`);
  }
  return s;
}

/** TOON 숫자 패턴에 맞을 때만 number 로, 아니면 undefined. */
export function parseNumber(s: string): number | undefined {
  // 왜: 빈 문자열이 `Number('')` → 0 이 되는 사고를 막는다.
  if (s === '') return undefined;
  // TOON 숫자 패턴: 정수·소수·지수(금지이지만 파서는 받는다)
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) {
    const v = Number(s);
    if (Number.isFinite(v)) return v;
  }
  return undefined;
}