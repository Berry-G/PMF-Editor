/**
 * 목적: 격자 ↔ 화면 좌표 변환. 유일한 좌표 변환 지점.
 * 왜 이 구조인가: 캔버스·패널·입력 모두 이 View 를 통해서만 좌표를 변환한다.
 *   y 뒤집기(셀 y=0 이 화면 아래)는 여기서만 처리한다.
 * 바꾸면 안 되는 것: CELL_PX 상수(32px)와의 곱셈. y 뒤집기 수식.
 * 근거: SDD-09 §9-1 [D-09-09-1], SDD-08 §10 [D-08-10]
 */
import { CELL_PX } from '../../core/palette.js';
import type { MapData } from '../../core/model/stage.js';

export class View {
  zoom = 1; panX = 0; panY = 0;
  cellToScreen(x: number, y: number, map: MapData): { sx: number; sy: number } {
    const S = CELL_PX * this.zoom;
    return { sx: this.panX + x * S, sy: this.panY + (map.height - 1 - y) * S };
  }
  screenToCell(sx: number, sy: number, map: MapData): { x: number; y: number; fx: number; fy: number } {
    const S = CELL_PX * this.zoom;
    const fx = (sx - this.panX) / S;
    const fyTop = (sy - this.panY) / S;
    return { x: Math.floor(fx), y: map.height - 1 - Math.floor(fyTop), fx: fx - Math.floor(fx), fy: fyTop - Math.floor(fyTop) };
  }
  zoomAt(sx: number, sy: number, f: number): void {
    const z2 = Math.max(0.25, Math.min(8, this.zoom * f));
    this.panX = sx - (sx - this.panX) * (z2 / this.zoom);
    this.panY = sy - (sy - this.panY) * (z2 / this.zoom);
    this.zoom = z2;
  }
  fitToMap(map: MapData, vw: number, vh: number): void {
    const S = CELL_PX;
    this.zoom = Math.max(0.25, Math.min(8, Math.min(vw / (map.width * S), vh / (map.height * S)) * 0.95));
    this.panX = (vw - map.width * S * this.zoom) / 2;
    this.panY = (vh - map.height * S * this.zoom) / 2;
  }
}