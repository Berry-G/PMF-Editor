/**
 * 목적: 선택 도구 — 사각 영역 선택. Ctrl+C/X/V, Delete 로 복사/잘라내기/붙여넣기.
 * 왜 이 구조인가: SDD-09 §10. 선택 상태를 store.state.selection 에 저장.
 *   pasteCells 커맨드로 붙여넣기. 고스트는 합성 단계에서 그린다.
 * 바꾸면 안 되는 것: 우클릭 = 지우개 셀. Escape 로 선택 해제.
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells } from '../../../core/commands/paint.js';
import { rectCells } from '../../../core/geometry/shapes.js';
import { Cell } from '../../../core/model/cell.js';

export class SelectTool implements Tool {
  readonly id = 'select' as const;
  private dragging = false;
  private startCell = { x: 0, y: 0 };

  onDown(p: PointerInfo, _ctx: ToolContext): void {
    this.dragging = true;
    this.startCell = p.cell;
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void {
    // 드래그 중 실시간 선택 상자 미리보기 (추후 구현)
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    if (!this.dragging) { this.dragging = false; return; }
    this.dragging = false;
    const x0 = Math.min(this.startCell.x, p.cell.x);
    const y0 = Math.min(this.startCell.y, p.cell.y);
    const x1 = Math.max(this.startCell.x, p.cell.x);
    const y1 = Math.max(this.startCell.y, p.cell.y);
    // 우클릭 시 지우개 셀 칠하기
    if (p.button === 2) {
      const map = ctx.store.state.history.doc.map;
      const cells = rectCells(map, x0, y0, x1, y1, false);
      const useCell = ctx.store.state.eraserCell as Cell;
      ctx.store.state.history.beginStroke();
      const cmd = paintCells(map, cells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '지우개 선택');
      ctx.store.dispatch(cmd);
      ctx.store.state.history.endStroke();
      return;
    }
    // 영역 선택 저장
    ctx.store.update((_s) => ({
      selection: { kind: 'cells', x0, y0, x1, y1 },
    }));
  }

  onCancel(_ctx: ToolContext): void { this.dragging = false; }
}