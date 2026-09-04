/**
 * 목적: 격자 좌표 유틸. XY 타입과 인덱스 변환.
 * 왜 이 구조인가: `cellAt`/`indexOf` 가 `map.ts` 에 있는데 XY 변환이 여기저기 흩어지면 안 된다.
 *   이 파일은 게임 `GridSystem` 의 좌표 변환과 같은 역할을 한다.
 * 바꾸면 안 되는 것: 인덱스 공식 `y * width + x` — 게임 임포터와 맞춰져 있다.
 * 근거: SDD-09 §4 [D-09-04], SDD-08 §5 [D-08-05]
 */
import type { XY } from '../model/stage.js';
export type { XY };

export function xy(x: number, y: number): XY { return { x, y }; }

export function idx(mw: number, x: number, y: number): number { return y * mw + x; }

export function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && x < w && y >= 0 && y < h;
}

/** 두 점의 유클리드 거리 (셀 단위, 중심 기준). */
export function dist(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}