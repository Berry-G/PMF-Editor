/**
 * 목적: 브러시·선·사각형의 칸 목록 계산. 전부 "칠할 칸 목록" 을 돌려준다.
 * 왜 이 구조인가: `paintCells` 커맨드가 이 목록을 받아 delta 를 만든다. 각 함수는 범위 밖 칸을 자르고
 *   중복 없이 y,x 오름차순으로 정렬한다 — `paintCells` 가 중복을 제거하지만 여기서도 방지하면
 *   테스트가 단순해진다.
 * 바꾸면 안 되는 것: Bresenham 수식과 방향 의존성(SDD-09 §4-2). `brushCells` 의 순서.
 * 근거: SDD-09 §4 [D-09-04], SDD-08 §5 [D-08-05]
 */
import type { XY, MapData } from '../model/stage.js';
import { inBounds, xy } from './xy.js';

/** 브러시 칸 — size 중심의 정사각형. size 는 1·3·5. 순서: y 오름차순, x 오름차순. */
export function brushCells(map: MapData, cx: number, cy: number, size: 1 | 3 | 5): XY[] {
  const r = (size - 1) / 2;
  const out: XY[] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (inBounds(map.width, map.height, x, y)) out.push(xy(x, y));
    }
  }
  return out;
}

/** 정수 Bresenham 선. 양 끝 포함. 대칭 아님(SDD-09 §4-2). */
export function lineCells(map: MapData, x0: number, y0: number, x1: number, y1: number): XY[] {
  const out: XY[] = [];
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    if (inBounds(map.width, map.height, x, y)) out.push(xy(x, y));
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

/** 사각형 칸. `outlineOnly` 면 경계만. 결과는 y,x 오름차순, 중복 없음. */
export function rectCells(
  map: MapData, x0: number, y0: number, x1: number, y1: number, outlineOnly: boolean,
): XY[] {
  const xMin = Math.min(x0, x1), xMax = Math.max(x0, x1);
  const yMin = Math.min(y0, y1), yMax = Math.max(y0, y1);
  const out: XY[] = [];
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      if (!inBounds(map.width, map.height, x, y)) continue;
      if (outlineOnly && y !== yMin && y !== yMax && x !== xMin && x !== xMax) continue;
      out.push(xy(x, y));
    }
  }
  return out;
}