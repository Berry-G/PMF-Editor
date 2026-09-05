/**
 * 목적: 미니맵 — tiles 레이어 축소 + 뷰포트 사각형 + 노드 점. 클릭/드래그로 뷰 이동.
 * 왜 이 구조인가: 맵이 한 화면에 다 들어와도 미니맵은 항상 보인다 — 맵이 커질 계획이 있기 때문.
 *   tiles 레이어를 가로 200px 고정으로 축소하고 뷰포트 사각형을 오버레이한다.
 * 바꾸면 안 되는 것: 가로 200px 고정은 SDD-03 §4 의 디자인 결정.
 * 근거: SDD-03 §4 [D-03-04], SDD-09 §9-4 [D-09-09-4]
 */
import type { Store } from '../state.js';
import { CELL_PX, BACKGROUND, COLOR, UI } from '../../core/palette.js';
import { View } from '../canvas/view.js';

const MINIMAP_W = 200;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private store: Store;
  private view: View;
  private dragging = false;

  constructor(canvas: HTMLCanvasElement, store: Store, view: View) {
    this.canvas = canvas;
    this.view = view;
    this.store = store;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('미니맵 캔버스 컨텍스트를 얻을 수 없다');
    this.ctx = ctx;

    canvas.style.width = MINIMAP_W + 'px';
    canvas.style.height = MINIMAP_W + 'px'; // 정사각형

    // 마우스 이벤트
    canvas.onmousedown = (e) => { this.dragging = true; this.moveTo(e); };
    canvas.onmousemove = (e) => { if (this.dragging) this.moveTo(e); };
    canvas.onmouseup = () => { this.dragging = false; };
    canvas.onmouseleave = () => { this.dragging = false; };

    store.subscribe(() => this.draw());
    this.draw();
  }

  private moveTo(e: MouseEvent): void {
    const map = this.store.state.history.doc.map;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = map.width / map.height;
    const mh = MINIMAP_W / (ratio > 1 ? ratio : 1);
    const mw = MINIMAP_W * (ratio > 1 ? 1 : ratio);
    const ox = (MINIMAP_W - mw) / 2;
    const oy = (MINIMAP_W - mh) / 2;
    const mx = (e.clientX - rect.left - ox) / mw;
    const my = (e.clientY - rect.top - oy) / mh;
    if (mx < 0 || mx > 1 || my < 0 || my > 1) return;
    const cx = Math.round(mx * map.width);
    const cy = Math.round((1 - my) * map.height);
    this.view.panX = -(cx * CELL_PX * this.view.zoom - this.ctx.canvas.width / 2);
    this.view.panY = -(cy * CELL_PX * this.view.zoom - this.ctx.canvas.height / 2);
    this.store.notifyViewChanged();
  }

  draw(): void {
    const state = this.store.state;
    const map = state.history.doc.map;
    const ratio = map.width / map.height;
    const mh = MINIMAP_W / (ratio > 1 ? ratio : 1);
    const mw = MINIMAP_W * (ratio > 1 ? 1 : ratio);
    const ox = (MINIMAP_W - mw) / 2;
    const oy = (MINIMAP_W - mh) / 2;
    const dpr = window.devicePixelRatio;

    this.canvas.width = MINIMAP_W * dpr;
    this.canvas.height = MINIMAP_W * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = BACKGROUND;
    this.ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_W);

    // 타일 축소 그리기
    const cellSize = mw / map.width;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.cells[y * map.width + x]!;
        if (cell === 255) continue; // Empty
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(ox + x * cellSize, oy + (map.height - 1 - y) * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }

    // 노드 점
    this.ctx.fillStyle = UI.text;
    for (const n of state.history.doc.path.nodes) {
      this.ctx.beginPath();
      this.ctx.arc(ox + n.x * cellSize, oy + (map.height - 1 - n.y) * cellSize, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 뷰포트 사각형
    const S = CELL_PX * this.view.zoom;
    const vx0 = -this.view.panX / S;
    const vy0 = map.height - 1 - (-this.view.panY / S);
    const vw = this.ctx.canvas.width / dpr / S;
    const vh = this.ctx.canvas.height / dpr / S;
    this.ctx.strokeStyle = UI.text;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(ox + vx0 * cellSize, oy + (map.height - 1 - (vy0 - vh + 1)) * cellSize, vw * cellSize, vh * cellSize);
  }
}











