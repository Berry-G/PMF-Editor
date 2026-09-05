/**
 * 목적: `src/core/` 가 DOM·브라우저 API·비결정적 소스를 참조하지 않고, 상위 계층을 import 하지 않음을 검사한다.
 * 왜 이 구조인가: 이 앱에서 틀리면 안 되는 부분(코덱·검증·시뮬)이 전부 core 다. DOM 이 없어야
 *   vitest 가 브라우저 없이 전부 덮고, 같은 규칙을 C# 임포터로 1:1 옮길 수 있다. 계층은 문서로
 *   지켜지지 않는다 — 한 번 새면 되돌리기 어렵다.
 * 바꾸면 안 되는 것: 금지 목록에서 항목을 빼지 마라. 특히 `Math.random`·`Date.now` —
 *   시뮬레이션 결정론이 여기에 걸려 있다(시드 PRNG 와 인자로 받는 시각만 쓴다).
 * 근거: SDD-01 §2 [D-01-02], SDD-06 §4 [D-06-04], SDD-08 §0 [D-08-00], ADR-E03
 */
import { describe, expect, it } from 'vitest';
import { read, walk } from '../util/walk.js';

const CORE_FILES = walk('src/core', ['.ts']);

/**
 * `productionOnly` 인 규칙은 `*.test.ts` 에 적용하지 않는다.
 * 왜: 테스트는 node 에서만 돌고 번들에 들어가지 않는다. 픽스처를 읽으려면 `node:fs` 가 필요하다.
 *   DOM·비결정 금지는 테스트에도 그대로 적용된다 — 그건 환경이 아니라 규율의 문제다.
 */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string; productionOnly?: boolean }> = [
  { pattern: /\bdocument\b/, why: 'DOM' },
  { pattern: /\bwindow\b/, why: 'DOM' },
  { pattern: /\bnavigator\b/, why: '브라우저 API' },
  { pattern: /\b(?:local|session)Storage\b/, why: '브라우저 저장소' },
  { pattern: /\bfetch\s*\(/, why: '네트워크' },
  { pattern: /\bMath\.random\b/, why: '비결정적 — 시드 PRNG 를 써라 (SDD-09 §7-1)' },
  { pattern: /\bDate\.now\b|\bnew Date\b/, why: '비결정적 — 시각은 인자로 받아라' },
  { pattern: /\bconsole\./, why: '부작용 — 순수 함수여야 한다' },
  { pattern: /from\s+['"][^'"]*\.\.\/(?:ui|io)\//, why: '상위 계층 import' },
  // 왜 node: 를 막는가: core 는 브라우저에서 돈다. node:fs 로 파일을 읽으면 vitest 에서만
  //   통과하고 vite 빌드에서는 번들에 들어가지 못한다 — 기획자 화면에서만 조용히 실패한다.
  //   실제로 factory.ts 가 씨앗을 node:fs 로 읽고 있었고, main.ts 가 아직 안 쓰는 덕에 가려져 있었다.
  {
    pattern: /from\s+['"]node:/,
    why: '브라우저에서 못 돈다 — 파일은 `?raw` 로 인라인하라',
    productionOnly: true,
  },
];

describe('core 순수성 게이트', () => {
  it('검사 대상이 비어 있지 않다', () => {
    expect(CORE_FILES.length).toBeGreaterThan(0);
  });

  it.each(CORE_FILES)('%s 가 DOM·비결정적 API 를 쓰지 않는다', (path) => {
    const source = read(path);
    const isTest = path.endsWith('.test.ts');
    const hits = FORBIDDEN.filter(
      (rule) => !(isTest && rule.productionOnly === true) && rule.pattern.test(source),
    ).map((rule) => `${rule.pattern.source} (${rule.why})`);
    expect(hits, `${path}: core 는 이것들을 쓸 수 없다`).toEqual([]);
  });
});
