/**
 * 목적: 사각 도구 — 드래그 영역을 채운다 (테두리 아님, 통째로).
 * 왜 이 구조인가: SDD-09 §10. rectCells(map, ..., false) 로 채움 영역.
 * 바꾸면 안 되는 것: 우클릭은 이 도구에 오지 않는다 (ADR-E12). V 마을 크기 1 강제.
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells } from '../../../core/commands/paint.js';
import { rectCells } from '../../../core/geometry/shapes.js';
import { Cell } from '../../../core/model/cell.js';
import type { XY } from '../../../core/model/stage.js';

export class RectTool implements Tool {
  readonly id = 'rect' as const;
  private dragging = false;
  private startCell: XY = { x: 0, y: 0 };

  onDown(p: PointerInfo, ctx: ToolContext): void {
    this.dragging = true;
    this.startCell = p.cell;
    ctx.store.state.history.beginStroke();
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void {
    // preview only — up 에서 한 번에 dispatch
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    if (!this.dragging) { this.dragging = false; return; }
    this.dragging = false;
    const map = ctx.store.state.history.doc.map;
    const palCell = ctx.store.state.paletteCell as Cell;
    const useCell = palCell;   // 우클릭 지우개는 폐지됐다 (ADR-E12) — 우클릭은 컨텍스트 메뉴다
    const cells = rectCells(map, this.startCell.x, this.startCell.y, p.cell.x, p.cell.y, false);
    const cmd = paintCells(map, cells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '사각');
    ctx.store.dispatch(cmd);
    ctx.store.state.history.endStroke();
  }

  onCancel(_ctx: ToolContext): void { this.dragging = false; }
}