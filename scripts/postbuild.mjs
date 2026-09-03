/**
 * 목적: 빌드 산출물을 `dist/pmf-editor.html` 하나로 확정하고, 파일이 더 있으면 실패시킨다.
 * 왜 이 구조인가: "파일 하나" 는 이 툴의 배포 전제다. 인라인이 깨져 에셋이 따로 떨어져도
 *   빌드는 성공하므로, 성공했다는 사실만으로는 전제가 지켜졌는지 알 수 없다. 여기서 확인한다.
 * 바꾸면 안 되는 것: 남은 파일을 조용히 지우고 넘어가지 마라 — 인라인이 깨졌다는 신호를 잃는다.
 * 근거: SDD-01 §9 [D-01-09], SDD-08 §1-1 [D-08-01], ADR-E01
 */
import { readdir, rename, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// 왜 fileURLToPath 인가: 이 저장소 경로에는 공백과 아포스트로피가 있다. `URL.pathname` 은
//   퍼센트 인코딩(`%20`)된 문자열이라 그대로 쓰면 파일을 못 찾는다. 실제로 한 번 당했다.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SRC = join(DIST, 'index.html');
const OUT = join(DIST, 'pmf-editor.html');

if (!existsSync(SRC)) {
  console.error(`[postbuild] ${SRC} 가 없다. vite build 가 실패했거나 outDir 설정이 바뀌었다.`);
  process.exit(1);
}
await rename(SRC, OUT);

// 왜: 빈 디렉터리는 인라인 성공의 흔적일 뿐이라 지운다. 파일이 남았다면 그건 다른 문제다.
const stray = [];
for (const entry of await readdir(DIST, { recursive: true, withFileTypes: true })) {
  const abs = join(entry.parentPath ?? entry.path, entry.name);
  if (entry.isDirectory()) continue;
  if (abs === OUT) continue;
  stray.push(relative(DIST, abs));
}
for (const entry of await readdir(DIST, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const abs = join(DIST, entry.name);
    const remaining = await readdir(abs, { recursive: true });
    if (remaining.length === 0) await rm(abs, { recursive: true });
  }
}

if (stray.length > 0) {
  console.error(
    `[postbuild] 산출물이 하나가 아니다. 인라인이 깨졌다:\n  ${stray.join('\n  ')}\n` +
      '  vite.config.ts 의 assetsInlineLimit / cssCodeSplit / viteSingleFile 을 확인하라.',
  );
  process.exit(1);
}

const { size } = await stat(OUT);
console.log(`[postbuild] dist/pmf-editor.html — ${size.toLocaleString('ko-KR')} 바이트`);
