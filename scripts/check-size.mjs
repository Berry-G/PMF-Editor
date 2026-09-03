/**
 * 목적: 산출 HTML 이 1MiB 를 넘으면 실패시킨다.
 * 왜 이 구조인가: "런타임 의존성 0" 은 문서에 적어 두면 조용히 무너진다. 크기는 그 규칙이
 *   지켜지고 있다는 **간접 증거** 이고, 라이브러리가 들어오면 가장 먼저 여기서 티가 난다.
 * 바꾸면 안 되는 것: 한계를 올려서 통과시키지 마라. 넘었다면 무엇이 들어왔는지 먼저 밝혀라.
 * 근거: SDD-06 §7 [D-06-07], CLAUDE.md §1
 */
import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LIMIT = 1_048_576;
// 왜 fileURLToPath 인가: 저장소 경로에 공백이 있어 `URL.pathname` 은 `%20` 로 인코딩된다.
const OUT = fileURLToPath(new URL('../dist/pmf-editor.html', import.meta.url));

if (!existsSync(OUT)) {
  console.error('[check-size] dist/pmf-editor.html 이 없다. 먼저 npm run build 를 돌려라.');
  process.exit(1);
}

const { size } = await stat(OUT);
const pct = Math.round((size / LIMIT) * 100);
if (size > LIMIT) {
  console.error(`[check-size] ${size.toLocaleString('ko-KR')} 바이트 — 한계 1MiB 의 ${pct}%. 초과.`);
  process.exit(1);
}
console.log(`[check-size] ${size.toLocaleString('ko-KR')} 바이트 — 한계의 ${pct}%. 통과.`);
