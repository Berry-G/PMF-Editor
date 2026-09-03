/**
 * 목적: 게임 저장소의 픽스처 사본이 이 저장소의 원본과 같은지 검사한다. (사본 폴더가 없으면 건너뛴다)
 * 왜 이 구조인가: 픽스처 원본은 이 저장소이고 게임 레포는 사본을 갖는다 — 게임 레포 단독으로
 *   EditMode 테스트가 돌아야 하기 때문이다. 사본은 반드시 어긋난다는 전제로, 어긋남을 사람이 아니라
 *   테스트가 발견해야 한다.
 * 바꾸면 안 되는 것: 사본이 없을 때 **조용히 통과** 시키지 마라 — 건너뛰는 이유를 남긴다.
 *   비교 실패를 관대하게 바꾸지 마라. 고치는 방법은 `npm run sync:fixtures` 하나다.
 * 근거: SDD-06 §3 [D-06-03], SDD-05 §4 [D-05-04]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, walk } from '../util/walk.js';

const GAME_FIXTURES = join(
  ROOT,
  '..',
  "Prowl's Moving Factory",
  'Assets/_Project/Scripts/Tests/Authoring/Fixtures',
);

const ORIGINALS = walk('docs/fixtures', ['.toon']);
const copyExists = existsSync(GAME_FIXTURES);

describe('픽스처 사본 동기화 게이트', () => {
  it('원본과 사본이 같다', (ctx) => {
    if (ORIGINALS.length === 0) {
      ctx.skip('건너뜀: 픽스처가 아직 없다 (M1 에서 생긴다)');
      return;
    }
    if (!copyExists) {
      ctx.skip(`건너뜀: 게임 저장소 사본 폴더가 없다 — ${GAME_FIXTURES}`);
      return;
    }
    const copies = new Set(readdirSync(GAME_FIXTURES));
    const problems: string[] = [];
    for (const rel of ORIGINALS) {
      const name = rel.slice(rel.lastIndexOf('/') + 1);
      const candidate = copies.has(name) ? name : `${name}.txt`;
      if (!copies.has(candidate)) {
        problems.push(`${name}: 사본이 없다`);
        continue;
      }
      const a = readFileSync(join(ROOT, rel), 'utf8');
      const b = readFileSync(join(GAME_FIXTURES, candidate), 'utf8');
      if (a !== b) problems.push(`${name}: 내용이 다르다`);
    }
    expect(problems, 'npm run sync:fixtures 를 돌리고 두 저장소에 각각 커밋하라').toEqual([]);
  });
});
