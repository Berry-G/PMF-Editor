/**
 * 목적: 선 도구 — 드래그한 두 점 사이 Bresenham 직선을 칠한다. 브러시 크기 반영.
 * 왜 이 구조인가: SDD-09 §10. lineCells + brushCells 로 굵기 조절.
 * 바꾸면 안 되는 것: Shift 는 직선 고정. 우클릭 = 지우개 셀.
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells } from '../../../core/commands/paint.js';
import { lineCells, brushCells } from '../../../core/geometry/shapes.js';
import { Cell } from '../../../core/model/cell.js';
import type { XY } from '../../../core/model/stage.js';

export class LineTool implements Tool {
  readonly id = 'line' as const;
  private dragging = false;
  private startCell: XY = { x: 0, y: 0 };

  onDown(p: PointerInfo, ctx: ToolContext): void {
    this.dragging = true;
    this.startCell = p.cell;
    ctx.store.state.history.beginStroke();
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void {
    // no-op during drag, preview only
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    if (!this.dragging) { this.dragging = false; return; }
    this.dragging = false;
    const map = ctx.store.state.history.doc.map;
    const size = ctx.store.state.brushSize;
    const palCell = ctx.store.state.paletteCell as Cell;
    const useCell = p.button === 2 ? ctx.store.state.eraserCell as Cell : palCell;
    const actualSize = useCell === Cell.VillageSlot ? 1 as const : size;
    const base = lineCells(map, this.startCell.x, this.startCell.y, p.cell.x, p.cell.y);
    // 브러시 크기 반영: 각 선 셀 주변을 brushCells 로 확장
    const allCells: XY[] = [];
    const seen = new Set<number>();
    for (const c of base) {
      const bs = brushCells(map, c.x, c.y, actualSize);
      for (const b of bs) {
        const k = b.y * map.width + b.x;
        if (!seen.has(k)) { seen.add(k); allCells.push(b); }
      }
    }
    const cmd = paintCells(map, allCells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '선');
    ctx.store.dispatch(cmd);
    ctx.store.state.history.endStroke();
  }

  onCancel(_ctx: ToolContext): void { this.dragging = false; }
}