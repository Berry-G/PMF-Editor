/**
 * 목적: 브러시 도구 — 드래그 칠하기, 크기 1·3·5, Shift 직선. V 칠할 때 크기 1 강제.
 * 왜 이 구조인가: SDD-09 §10. 모든 칠하기는 paintCells 커맨드로 store.dispatch() 한다.
 *   스트로크 하나 = beginStroke/endStroke + coalesce.
 * 바꾸면 안 되는 것: V 마을 크기 1 강제, 우클릭 = 지우개 셀.
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells } from '../../../core/commands/paint.js';
import { brushCells, lineCells } from '../../../core/geometry/shapes.js';

import { Cell } from '../../../core/model/cell.js';
import type { XY } from '../../../core/model/stage.js';

export class BrushTool implements Tool {
  readonly id = 'brush' as const;
  private dragging = false;
  private lastCell: XY = { x: 0, y: 0 };
  private anchorCell: XY = { x: 0, y: 0 };

  onDown(p: PointerInfo, ctx: ToolContext): void {
    this.dragging = true;
    this.lastCell = p.cell;
    this.anchorCell = p.cell;
    ctx.store.state.history.beginStroke();
    this.paintAt(p.cell, p, ctx);
  }

  onMove(p: PointerInfo, ctx: ToolContext): void {
    if (!this.dragging) return;
    const cells = p.shift
      ? lineCells(ctx.store.state.history.doc.map, this.anchorCell.x, this.anchorCell.y, p.cell.x, p.cell.y)
      : lineCells(ctx.store.state.history.doc.map, this.lastCell.x, this.lastCell.y, p.cell.x, p.cell.y);
    for (const c of cells) this.paintAt(c, p, ctx);
    this.lastCell = p.cell;
  }

  onUp(_p: PointerInfo, ctx: ToolContext): void { this.dragging = false; ctx.store.state.history.endStroke(); }
  onCancel(_ctx: ToolContext): void { this.dragging = false; }

  private paintAt(cell: XY, p: PointerInfo, ctx: ToolContext): void {
    const size = ctx.store.state.brushSize;
    const palCell = ctx.store.state.paletteCell as Cell;
    const useCell = p.button === 2 ? ctx.store.state.eraserCell as Cell : palCell;
    const actualSize = useCell === Cell.VillageSlot ? 1 as const : size;
    const cells = brushCells(ctx.store.state.history.doc.map, cell.x, cell.y, actualSize);
    const cmd = paintCells(ctx.store.state.history.doc.map, cells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '칠하기');
    ctx.store.dispatch(cmd);
  }
}
