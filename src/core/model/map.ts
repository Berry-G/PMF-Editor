/**
 * 목적: 격자 데이터(MapData)의 생성·조회·범위 검사·불변 갱신. 맵을 바꾸는 유일한 함수들.
 * 왜 이 구조인가: `cells` 가 `Uint8Array` 이므로 복사가 싸서 커맨드가 새 문서를 통째로 돌려줄 수 있다
 *   (SDD-01 §3). `cellAt` 은 범위 밖을 `Empty` 로 반환하므로 호출자가 매번 검사하지 않아도 된다 —
 *   게임의 `GridSystem.TryGetCell` 과 같은 정신이다.
 * 바꾸면 안 되는 것: `indexOf` 의 `y*width + x` 공식 — 게임 임포터가 이 인덱스로 `byte[]` 를 채운다.
 *   `createMap` 의 `origin` 계산 규칙: 게임 씨앗과 같은 `-(width/2), -(height/2)` (중심 배치).
 * 근거: SDD-02 §1-2 [D-02-02], SDD-08 §2 [D-08-02]
 */
import type { MapData, XY } from './stage.js';
import { Cell as C } from './cell.js';

/** 빈 칸으로 채운 맵을 만든다. origin 은 너비·높이의 절반을 음수로 (중심 배치). */
export function createMap(width: number, height: number, fill: C): MapData {
  // 왜: 게임 GridSystem 은 맵을 월드 원점 중심에 배치한다. 씨앗 32×18 → origin [-16, -9].
  const cells = new Uint8Array(width * height).fill(fill === C.Empty ? 255 : fill);
  return { width, height, origin: [-(width / 2), -(height / 2)], cells };
}

/** (x,y) 의 셀을 돌려준다. 범위 밖이면 `Cell.Empty` (255). 게임 `TryGetCell` 과 같다. */
export function cellAt(map: MapData, x: number, y: number): C {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return C.Empty;
  const i = y * map.width + x;
  const v = map.cells[i];
  return v as C;
}

/** `y*width + x`. 범위 검사 없음 — 호출자가 `inBounds` 를 먼저 확인했다고 전제한다. */
export function indexOf(map: MapData, x: number, y: number): number {
  return y * map.width + x;
}

export function inBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

/**
 * 지정한 칸만 새 값으로 교체한 새 `MapData` 를 돌려준다.
 * `changes` 에 같은 좌표가 두 번 이상 있으면 마지막 값을 쓴다.
 */
export function withCells(
  map: MapData,
  changes: ReadonlyArray<{ x: number; y: number; cell: C }>,
): MapData {
  const cells = new Uint8Array(map.cells);
  for (const ch of changes) {
    if (inBounds(map, ch.x, ch.y)) {
      cells[ch.y * map.width + ch.x] = ch.cell === C.Empty ? 255 : ch.cell;
    }
  }
  return { width: map.width, height: map.height, origin: [...map.origin] as [number, number], cells };
}

/** 종류별 칸 개수. `Cell.Empty` 도 포함한다. */
export function countCells(map: MapData): Record<C, number> {
  // 모든 Cell 타입을 0으로 초기화
  const counts: Record<number, number> = {};
  const values: number[] = [0, 1, 2, 3, 4, 5, 255];
  for (const v of values) counts[v] = 0;
  for (let i = 0; i < map.cells.length; i++) {
    const v = map.cells[i]!;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts as Record<C, number>;
}

/**
 * 특정 종류의 칸 위치 목록. 정렬 순서: y 오름차순, 같은 y 면 x 오름차순.
 * 왜: 게임 씬 빌더가 마을을 y 내림차순·x 오름차순으로 만든다 (SDD-05 §7).
 *   여기는 문자열 정렬이 아니라 좌표 정수 비교라 안정적이다.
 */
export function findCells(map: MapData, cell: C): XY[] {
  const out: XY[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.cells[y * map.width + x] === (cell === C.Empty ? 255 : cell)) {
        out.push({ x, y });
      }
    }
  }
  return out;
}