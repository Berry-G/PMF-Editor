/**
 * 목적: 문자열을 TOON 값으로 쓸 때의 인용 판정과 이스케이프. SDD-09 §2-2 를 그대로 구현한다.
 * 왜 이 구조인가: 인코더에서 분리했다 — 판정 규칙이 촘촘하고(9개 조건) 단위 테스트로 하나씩
 *   짚어야 하는데, 인코더 안에 두면 파일 전체를 거쳐야만 확인할 수 있다.
 *   C# 임포터(ToonWriter)도 같은 규칙을 갖는다. 한 곳에 모여 있어야 대조할 수 있다.
 * 바꾸면 안 되는 것: 판정 조건 9개와 그 순서. 하나를 빼면 그 문자를 가진 이름이 파일을
 *   조용히 깨뜨린다 — 표의 열이 밀리거나 키가 둘로 읽힌다.
 * 근거: SDD-09 §2-2 [D-09-02], SDD-02 §6-1 [D-02-08]
 */

/** 인용이 필요한 문자: 구조 문자(`:` `"` `\` `[` `]` `{` `}`)와 구분자(`,`). */
const STRUCTURAL = /[:"\\[\]{},]/;
/** TOON 숫자 패턴. 숫자로 읽힐 문자열은 인용해야 문자열로 남는다. */
const NUMERIC = /^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;
/** 제어문자 (U+0000–U+001F). */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f]/;

/** 이 문자열을 TOON 에 쓰려면 인용해야 하는가. */
export function needsQuote(v: string): boolean {
  return (
    v === '' ||
    v.trim() !== v ||
    v === 'true' ||
    v === 'false' ||
    v === 'null' ||
    NUMERIC.test(v) ||
    STRUCTURAL.test(v) ||
    CONTROL.test(v) ||
    // 왜 `-`·`#` 로 시작하면 인용하는가: `#` 은 주석 줄로 지워지고, `-` 는 사양이 인용을 강제한다.
    v.startsWith('-') ||
    v.startsWith('#')
  );
}

/**
 * TOON 값으로 쓸 문자열을 만든다. 필요할 때만 인용한다.
 * 인용하지 않아도 되는 것을 인용하면 씨앗과 바이트가 달라져 골든 왕복이 깨진다.
 */
export function str(v: string): string {
  if (!needsQuote(v)) return v;
  let out = '"';
  for (const ch of v) {
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (CONTROL.test(ch)) out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}
