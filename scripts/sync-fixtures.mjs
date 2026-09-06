/**
 * 목적: `docs/fixtures/` 를 게임 저장소의 Unity 테스트 폴더로 복사한다.
 * 왜 이 구조인가: 픽스처의 원본은 이 저장소이고 게임 레포는 사본을 갖는다 — 게임 레포 단독으로
 *   EditMode 테스트가 돌아야 하기 때문이다(사용자 확정 2026-09-03). 사본은 **스크립트로만**
 *   갱신한다. 손으로 복사하면 어긋난 채로 오래 간다.
 * 바꾸면 안 되는 것: 복사 방향(에디터 → 게임). 반대로 돌리면 원본이 둘이 된다.
 * 근거: SDD-06 §3 [D-06-03], SDD-05 §4 [D-05-04], SDD-07 M5 [D-07-06]
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'docs', 'fixtures');
const DST = join(ROOT, '..', "Prowl's Moving Factory", 'Assets', '_Project', 'Scripts', 'Tests', 'Authoring', 'Fixtures');

if (!existsSync(SRC)) {
  console.error('[sync-fixtures] 원본 폴더 없음:', SRC);
  process.exit(1);
}

// 게임 레포 대상 폴더 만들기
if (!existsSync(DST)) mkdirSync(DST, { recursive: true });

// flat 복사 (하위폴더 없이, 게임 테스트는 파일 이름으로 접근)
for (const sub of ['valid', 'invalid']) {
  const srcDir = join(SRC, sub);
  if (!existsSync(srcDir)) continue;
  for (const file of readdirSync(srcDir).filter(f => f.endsWith('.toon'))) {
    copyFileSync(join(srcDir, file), join(DST, file));
  }
}
console.log(`[sync-fixtures] ${SRC} → ${DST} 완료`);
