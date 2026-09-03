/**
 * 목적: Vite 빌드·테스트 설정. 산출물은 파일 하나(`dist/pmf-editor.html`)여야 한다.
 * 왜 이 구조인가: 기획자 PC 에 설치가 0 이어야 하므로 모든 에셋을 인라인한다
 *   (`assetsInlineLimit` 을 사실상 무한으로). 테스트 환경이 node 인 이유는
 *   `core/` 가 DOM 을 모른다는 계층 규칙을 환경 자체로 강제하기 위해서다.
 * 바꾸면 안 되는 것: `viteSingleFile()` 과 `cssCodeSplit:false` — 빼면 산출물이 여러 파일로 쪼개져
 *   배포 전제가 무너진다. `test.environment` 를 jsdom 으로 올리면 core 순수성 위반이 조용히 통과한다.
 * 근거: SDD-01 §1 [D-01-01], SDD-08 §1-2 [D-08-01], ADR-E01, ADR-E03
 */
// 왜 'vitest/config' 인가: `test` 필드를 같은 파일에 두려면 vitest 가 확장한 defineConfig 가 필요하다.
// 'vite' 의 것을 쓰면 `test` 가 알 수 없는 속성으로 거부된다 (vite 8 + vitest 5).
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// 왜: 빌드 시각을 분 단위까지만 넣는다. 초까지 넣으면 같은 코드가 매번 다른 산출물이 되어
//     "기획자가 쓰는 버전" 을 말로 특정하기 어려워진다.
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {
    __TOOL_VERSION__: JSON.stringify(`v${pkg.version} (${builtAt} UTC)`),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 100_000_000, // 왜: 모든 에셋을 인라인. 파일 하나가 목표다
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
