/**
 * 목적: 4-연결 플러드필 (반복 스택). 256×256 에서도 재귀 없음.
 * 왜 이 구조인가: 게임 `AllyWalkGraph` 와 같은 4-연결 연결성. 대각선 연결은 없다 — 아군이 대각선으로
 *   도로를 건너뛰지 않기 때문이다. 재귀 대신 반복 스택을 써서 큰 맵에서도 스택 오버플로우가 없다.
 * 바꾸면 안 되는 것: 4-연결(상하좌우) — 8-연결로 바꾸면 도달 영역이 통째로 달라진다.
 *   `same` 술어 — 호출자가 전달한 술어로만 판정한다.
 * 근거: SDD-09 §4-4 [D-09-04-4], SDD-08 §5 [D-08-05]
 */
import type { XY, MapData } from '../model/stage.js';
import { inBounds, xy } from './xy.js';
import { cellAt } from '../model/map.js';
import { type Cell } from '../model/cell.js';

/** 4-연결 플러드필. 시작 칸을 포함한다. `same(c)` 가 true 인 인접 칸으로 퍼진다. */
export function floodFill(map: MapData, sx: number, sy: number, same: (c: Cell) => boolean): XY[] {
  if (!inBounds(map.width, map.height, sx, sy) || !same(cellAt(map, sx, sy))) return [];

  const w = map.width, h = map.height;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const startIdx = sy * w + sx;
  seen[startIdx] = 1;
  stack.push(startIdx);
  const out: XY[] = [];

  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % w, y = (i - x) / w;
    out.push(xy(x, y));
    // 4-연결
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (inBounds(w, h, nx, ny)) {
        const ni = ny * w + nx;
        if (seen[ni] === 0 && same(cellAt(map, nx, ny))) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }

  // 정렬: y 오름차순, 같은 y 면 x 오름차순
  out.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  return out;
}