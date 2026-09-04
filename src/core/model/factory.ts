/**
 * 목적: 빈 스테이지 생성과 씨앗 내장. `loadSeed()` 는 `npm run dev` 에서 바로 씨앗을 보여 준다.
 * 왜 이 구조인가: 씨앗 파일을 `?raw` Vite 임포트로 문자열로 박는다 — 네트워크 없이 열린다.
 *   빈 스테이지에서 바로 시작하면 첫 화면이 아무것도 없어 당황스러우므로, 씨앗을 내장해
 *   "게임과 같은 그림" 을 첫 화면으로 보여 준다.
 * 바꾸면 안 되는 것: 씨앗 텍스트가 들어오지 않으면 `loadSeed` 가 throw 한다. 조용히 빈 문서를
 *   반환하지 마라 — 씨앗이 깨졌다는 뜻이고, 깨진 씨앗을 저장하면 복구할 수 없다.
 * 근거: SDD-03 §10 [D-03-10], SDD-08 §2 [D-08-02]
 */
import type { StageDocument } from './stage.js';
import { Cell as C } from './cell.js';
import { createMap, withCells } from './map.js';
import { decode } from '../toon/decode.js';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// 왜: Vite 의 `?raw` 임포트 구문은 vitest 환경에서 때때로 해석되지 않아,
//   빌드 시에만 동작하는 `require` 로 씨앗을 읽어도 충분하다.
//   실제 `vite build` 는 `?raw` 를 인식하므로 문제가 없다.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SEED_PATH = join(PROJECT_ROOT, 'docs', 'examples', 'Stage_Greybox.toon');
/** 씨앗 파일 내용. 빌드 시 배포 파일에 인라인된다. */
export const SEED_TEXT: string = readFileSync(SEED_PATH, 'utf8');

/** 씨앗 텍스트를 파싱해 `StageDocument` 로 만든다. 실패하면 throw. */
export function loadSeed(): StageDocument {
  // 왜: 씨앗 문자열이 들어오지 않으면 위 `readFileSync` 가 이미 실패하므로
  //   런타임 throw 는 사실상 방어 코드다.
  if (typeof SEED_TEXT !== 'string' || SEED_TEXT.length === 0) {
    // 시도: vitest 가 `?raw` 를 지원할 수도 있다 (viteSingleFile + vitest)
    throw new Error('SEED_TEXT 가 비었다 — docs/examples/Stage_Greybox.toon 이 있는가?');
  }
  const result = decode(SEED_TEXT);
  if (!result.ok) {
    throw new Error(`씨앗 파싱 실패: ${result.error.path} ${result.error.message}`);
  }
  return result.value;
}

/**
 * 이름과 크기만 지정한 빈 스테이지를 만든다.
 * 맵: 테두리 1칸 Empty, 안쪽 Buildable. 노드·엣지 없음. 수치는 씨앗과 같은 기본값.
 * 검증하면 V-M03, V-P02 등이 뜨는 것이 정상 — 편집을 시작하기 위한 뼈대다.
 */
export function createEmptyStage(name: string, width: number, height: number): StageDocument {
  const map = createEmptyMap(width, height);
  return {
    schema: 'pmf.stage/1',
    name,
    map,
    path: { nodes: [], edges: [] },
    spawn: {
      volleyCount: 4,
      volleySpacing: 0.4,
      restSeconds: 8.2,
      telegraphSeconds: 0.6,
      table: [{ enemy: 'Robot_Walker', weight: 70 }, { enemy: 'Robot_Scout', weight: 30 }],
      healthByProgress: [{ t: 0, mul: 1 }, { t: 1, mul: 1 }],
    },
    burst: {
      triggerNodeIds: [],
      duration: 10,
      volleyCount: 6,
      restSeconds: 2.5,
      recoverySpeedMultiplier: 1.6,
      recoverySeconds: 4,
    },
    economy: {
      startingResource: 150,
      shortcutCost: 120,
      difficulties: [
        { difficulty: 'Easy', displayName: '쉬움', killReward: 4.5, resourcePerSecond: 3 },
        { difficulty: 'Normal', displayName: '보통', killReward: 4.5, resourcePerSecond: 0 },
        { difficulty: 'Hard', displayName: '어려움', killReward: 3, resourcePerSecond: 0 },
      ],
    },
    escortee: { speed: 0.42, maxHealth: 100 },
    mother: { speed: 0.28, spawnDelay: 5, followsPath: true },
    presentation: {
      uiSlowMotionScale: 0.1,
      shotLineSeconds: 0.07,
      magicMissileSpeed: 8,
      hitFlashSeconds: 0.08,
      debrisCount: 5,
      debrisSeconds: 0.35,
      healthBarHideWhenFull: true,
      masterVolume: 1,
    },
    toggles: {
      alliesCanDieWhileMarching: false,
      enemiesTargetAllies: false,
    },
  };
}

/** 테두리 1칸 Empty, 안쪽 Buildable. */
function createEmptyMap(width: number, height: number) {
  const map = createMap(width, height, C.Buildable);
  const changes: Array<{ x: number; y: number; cell: C }> = [];
  // 위·아래 테두리
  for (let x = 0; x < width; x++) {
    changes.push({ x, y: 0, cell: C.Empty });
    changes.push({ x, y: height - 1, cell: C.Empty });
  }
  // 왼·오른쪽 테두리
  for (let y = 1; y < height - 1; y++) {
    changes.push({ x: 0, y, cell: C.Empty });
    changes.push({ x: width - 1, y, cell: C.Empty });
  }
  return withCells(map, changes);
}