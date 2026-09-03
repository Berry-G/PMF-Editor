/**
 * 목적: 툴 버전 문자열. 상단 바에 표시하고 저장하는 `.toon` 첫 주석에 넣는다.
 * 왜 이 구조인가: 기획자가 "어느 버전 툴로 만든 파일인지" 를 말할 수 있어야 문제를 재현한다.
 *   값은 빌드 시 Vite `define` 이 주입하므로 소스에는 리터럴이 없다.
 * 바꾸면 안 되는 것: 이 파일은 DOM 도 Node API 도 쓰지 않는다 — `core/` 순수성 규칙.
 *   테스트에서는 `define` 이 없을 수 있으므로 폴백을 유지하라(없으면 vitest 가 죽는다).
 * 근거: SDD-01 §9 [D-01-09], SDD-08 §8 [D-08-08]
 */

declare const __TOOL_VERSION__: string | undefined;

// 왜: vitest 는 vite.config 의 define 을 함께 쓰지만, 다른 실행 경로(에디터 언어 서버 등)에서는
//     정의되지 않을 수 있다. 버전 표시 하나 때문에 도구가 죽으면 안 된다.
export const TOOL_VERSION: string =
  typeof __TOOL_VERSION__ === 'string' ? __TOOL_VERSION__ : 'v0.0.0 (dev)';
