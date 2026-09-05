/**
 * 목적: 스칼라 필드·표·맵 크기를 바꾸는 커맨드. 스폰·밸런스 탭의 모든 입력이 이 셋을 거친다.
 * 왜 이 구조인가: 경로를 **문자열 유니온(FieldPath)** 으로 못박는다. `string` 으로 두면 오타가
 *   런타임까지 살아남아 문서에 없는 키를 만들고, 그 문서는 저장은 되지만 임포터가 거부한다.
 *   `any` 로 객체를 파고들면 그 안전장치가 통째로 사라진다 (SDD-08 §13).
 *   revert 는 **apply 전에 캡처한 값만** 쓴다 — 적용 후 문서에서 이전 상태를 유추하면
 *   되돌릴 수 없다. 실제로 예전 구현이 `return d` 여서 Undo 가 동작하지 않았다.
 * 바꾸면 안 되는 것: FIELD_PATHS 에 없는 경로를 허용하지 마라. 표는 deep copy 로 기억한다
 *   (얕게 기억하면 같은 배열을 가리켜 revert 가 무의미해진다).
 *   resizeMap 은 맵과 **노드를 함께** 옮긴다 — 맵만 옮기면 노드가 지형에서 미끄러진다.
 * 근거: SDD-08 §7 [D-08-07], SDD-09 §8 [D-09-08], SDD-03 §7 [D-03-07]
 */
import type { Command } from './command.js';
import type { StageDocument } from '../model/stage.js';

/** 편집 가능한 스칼라 필드의 전체 목록. SDD-02 §4 대응표에서 표·배열을 뺀 것이다. */
export const FIELD_PATHS = [
  'name',
  'escortee.speed',
  'escortee.maxHealth',
  'mother.speed',
  'mother.spawnDelay',
  'mother.followsPath',
  'spawn.volleyCount',
  'spawn.volleySpacing',
  'spawn.restSeconds',
  'spawn.telegraphSeconds',
  'burst.duration',
  'burst.volleyCount',
  'burst.restSeconds',
  'burst.recoverySpeedMultiplier',
  'burst.recoverySeconds',
  'economy.startingResource',
  'economy.shortcutCost',
  'presentation.uiSlowMotionScale',
  'presentation.shotLineSeconds',
  'presentation.magicMissileSpeed',
  'presentation.hitFlashSeconds',
  'presentation.debrisCount',
  'presentation.debrisSeconds',
  'presentation.healthBarHideWhenFull',
  'presentation.masterVolume',
  'toggles.alliesCanDieWhileMarching',
  'toggles.enemiesTargetAllies',
] as const;
export type FieldPath = (typeof FIELD_PATHS)[number];

/** 표·배열 필드. 행 전체를 갈아끼운다. */
export const TABLE_PATHS = [
  'spawn.table',
  'spawn.healthByProgress',
  'economy.difficulties',
  'burst.triggerNodeIds',
] as const;
export type TablePath = (typeof TABLE_PATHS)[number];

type Section = 'escortee' | 'mother' | 'spawn' | 'burst' | 'economy' | 'presentation' | 'toggles';

/**
 * 섹션 하나의 키 하나를 바꾼 새 문서를 만든다.
 * 왜 여기서만 캐스팅하는가: 계산된 키(`[section]:`)는 타입이 넓어져 컴파일러가 되돌려 주지 못한다.
 *   그 좁힘을 이 함수 한 곳에 가둬 두면 호출부는 전부 타입 안전하게 남는다.
 */
function patch<S extends Section>(doc: StageDocument, section: S, key: string, value: unknown): StageDocument {
  const next = { ...doc[section], [key]: value };
  return { ...doc, [section]: next } as StageDocument;
}

/**
 * 객체에서 키 하나를 읽는다.
 * 왜 `Object.entries` 인가: 인덱스 시그니처가 없는 타입에 문자열 키로 접근하려면 캐스팅이 필요한데,
 *   그 캐스팅이 곧 `any` 로 가는 문이다. 섹션 객체는 필드 열 개 남짓이라 순회 비용이 없다.
 */
function get(obj: object, key: string): unknown {
  for (const [k, v] of Object.entries(obj)) {
    if (k === key) return v;
  }
  return undefined;
}

function write(doc: StageDocument, path: string, value: unknown): StageDocument {
  if (path === 'name') return { ...doc, name: value as string };
  const dot = path.indexOf('.');
  return patch(doc, path.slice(0, dot) as Section, path.slice(dot + 1), value);
}

function read(doc: StageDocument, path: string): unknown {
  if (path === 'name') return doc.name;
  const dot = path.indexOf('.');
  return get(doc[path.slice(0, dot) as Section], path.slice(dot + 1));
}

export function setField(path: FieldPath, value: number | boolean | string): Command {
  // 왜 클로저에 담는가: 커맨드는 히스토리 스택에 남아 있다가 나중에 revert 된다.
  //   그때 문서는 이미 다른 편집을 거쳤을 수 있으므로, 이전 값은 지금 붙잡아 둬야 한다.
  let prev: unknown;
  let captured = false;
  return {
    label: `필드 ${path}`,
    apply(d: StageDocument): StageDocument {
      if (!captured) {
        prev = read(d, path);
        captured = true;
      }
      return write(d, path, value);
    },
    revert(d: StageDocument): StageDocument {
      if (!captured) return d;
      return write(d, path, prev);
    },
  };
}

export function setTable(path: TablePath, rows: readonly unknown[]): Command {
  let prev: unknown;
  let captured = false;
  return {
    label: `표 ${path}`,
    apply(d: StageDocument): StageDocument {
      if (!captured) {
        // 왜 deep copy 인가: 행 객체를 얕게 들고 있으면 이후 편집이 같은 객체를 고쳐
        //   "이전 값" 이 조용히 현재 값으로 바뀐다. 표는 작아서 복사가 싸다.
        prev = JSON.parse(JSON.stringify(read(d, path))) as unknown;
        captured = true;
      }
      return write(d, path, rows);
    },
    revert(d: StageDocument): StageDocument {
      if (!captured) return d;
      return write(d, path, prev);
    },
  };
}

export type Anchor = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';

export function resizeMap(doc: StageDocument, width: number, height: number, anchor: Anchor): Command {
  const oldMap = doc.map;
  const oldNodes = doc.path.nodes;
  // 왜 's' 가 0 인가: y 는 아래가 0 이다. 아래쪽 앵커면 기존 내용이 제자리에 남는다 (SDD-09 §8-4).
  const dx = anchor.includes('e')
    ? width - oldMap.width
    : anchor.includes('w')
      ? 0
      : Math.floor((width - oldMap.width) / 2);
  const dy = anchor.includes('n')
    ? height - oldMap.height
    : anchor.includes('s')
      ? 0
      : Math.floor((height - oldMap.height) / 2);

  return {
    label: `크기 ${oldMap.width}×${oldMap.height}→${width}×${height}`,
    apply(d: StageDocument): StageDocument {
      const cells = new Uint8Array(width * height).fill(255);
      for (let y = 0; y < oldMap.height; y++) {
        for (let x = 0; x < oldMap.width; x++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            cells[ny * width + nx] = oldMap.cells[y * oldMap.width + x]!;
          }
        }
      }
      // 왜 노드도 옮기는가: 맵만 옮기면 노드가 지형에서 미끄러져 도로 밖으로 나간다.
      //   맵 밖으로 나가는 노드는 **지우지 않는다** — 조용히 지우면 엣지와 트리거가 함께
      //   사라져 원인을 찾을 수 없다. V-P07 이 잡도록 그대로 둔다 (SDD-03 §7).
      const nodes = oldNodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
      return {
        ...d,
        map: { width, height, origin: [oldMap.origin[0] - dx, oldMap.origin[1] - dy], cells },
        path: { ...d.path, nodes },
      };
    },
    revert(d: StageDocument): StageDocument {
      return { ...d, map: oldMap, path: { ...d.path, nodes: oldNodes } };
    },
  };
}
