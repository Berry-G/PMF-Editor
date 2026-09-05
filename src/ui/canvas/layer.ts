/**
 * 목적: 오프스크린 캔버스와 더티 영역 관리. 각 레이어는 자기 더티 영역만 다시 그린다.
 * 왜 이 구조인가: 셀 하나 칠할 때 노드·엣지·오버레이를 다시 그리면 안 된다. 각 레이어가
 *   자기 더티 영역만 갱신하고, 화면 합성은 requestAnimationFrame 한 번에 한다.
 *   레이어 크기는 map.width*CELL_PX × map.height*CELL_PX (줌 무관). 줌은 합성 시 drawImage 스케일.
 * 바꾸면 안 되는 것: markDirty/markAllDirty/takeDirty. 레이어 크기가 맵 픽셀 크기인 것.
 * 근거: SDD-09 §9-2 [D-09-09-2], SDD-01 §4 [D-01-04]
 */
import { CELL_PX } from '../../core/palette.js';

export interface DirtyRect {
  x0: number; y0: number; x1: number; y1: number;
}

export class LayerCanvas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dirty: DirtyRect | null = null;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width * CELL_PX;
    this.canvas.height = height * CELL_PX;
    const ctx = this.canvas.getContext('2d');
    // 왜: 생성자에서 오프스크린 캔버스의 컨텍스트를 얻지 못하면 더 이상 진행할 수 없다.
    if (ctx === null) throw new Error('Canvas 2D context 를 얻을 수 없다');
    this.ctx = ctx;
    // 왜: 레이어는 항상 셀 단위 픽셀로 그린다. 줌은 합성 단계에서 drawImage 스케일.
    //   imageSmoothingEnabled = false 는 합성 단계에서 건다.
  }

  get ctx2d(): CanvasRenderingContext2D { return this.ctx; }

  markDirty(x0: number, y0: number, x1: number, y1: number): void {
    // 왜: 더티 영역을 누적한다. 예: 셀 (3,3) 이 바뀌면 x0=3*32, y0=3*32, x1=4*32, y1=4*32.
    //   여러 셀이 연속으로 바뀌면 더티 영역이 합쳐진다.
    const px = CELL_PX;
    const d = { x0: x0 * px, y0: y0 * px, x1: (x1 + 1) * px, y1: (y1 + 1) * px };
    if (this.dirty === null) { this.dirty = d; }
    else {
      this.dirty.x0 = Math.min(this.dirty.x0, d.x0);
      this.dirty.y0 = Math.min(this.dirty.y0, d.y0);
      this.dirty.x1 = Math.max(this.dirty.x1, d.x1);
      this.dirty.y1 = Math.max(this.dirty.y1, d.y1);
    }
  }

  markAllDirty(): void {
    this.dirty = { x0: 0, y0: 0, x1: this.canvas.width, y1: this.canvas.height };
  }

  takeDirty(): DirtyRect | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.markAllDirty();
  }
}