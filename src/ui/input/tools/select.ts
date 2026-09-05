/**
 * 목적: 선택 도구 — 사각 영역 선택. Ctrl+C/X/V, Delete 로 복사/잘라내기/붙여넣기.
 * 왜 이 구조인가: SDD-09 §10. 선택 상태를 store.state.selection 에 저장.
 *   pasteCells 커맨드로 붙여넣기. 고스트는 합성 단계에서 그린다.
 * 바꾸면 안 되는 것: 우클릭 = 지우개 셀. Escape 로 선택 해제.
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells, pasteCells } from '../../../core/commands/paint.js';
import { rectCells } from '../../../core/geometry/shapes.js';
import { Cell } from '../../../core/model/cell.js';
import { cellAt } from '../../../core/model/map.js';

export class SelectTool implements Tool {
  readonly id = 'select' as const;
  private dragging = false;
  private startCell = { x: 0, y: 0 };
  private pasteGhost: { x: number; y: number } | null = null;

  onDown(p: PointerInfo, _ctx: ToolContext): void {
    this.dragging = true;
    this.startCell = p.cell;
  }

  onMove(p: PointerInfo, ctx: ToolContext): void {
    // 고스트 붙여넣기 모드: 마우스 따라다님
    if (this.pasteGhost && ctx.store.state.clipboard) {
      ctx.store.update((_s) => ({ previewCells: this.ghostCells(p.cell, ctx.store.state.clipboard!) }));
    }
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    // 고스트 붙여넣기 확정
    if (this.pasteGhost) {
      const clip = ctx.store.state.clipboard;
      this.pasteGhost = null;
      ctx.store.update((_s) => ({ previewCells: [] }));
      if (!clip) return;
      ctx.store.state.history.beginStroke();
      const cmd = pasteCells(ctx.store.state.history.doc.map, p.cell, clip);
      ctx.store.dispatch(cmd);
      ctx.store.state.history.endStroke();
      ctx.store.update((_s) => ({ selection: { kind: 'none' } }));
      return;
    }

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

  onCancel(ctx: ToolContext): void {
    this.dragging = false;
    this.pasteGhost = null;
    ctx.store.update((_s) => ({ previewCells: [] }));
  }

  /** Ctrl+C: 선택 영역 복사 */
  copySelection(ctx: ToolContext): void {
    const sel = ctx.store.state.selection;
    if (sel.kind !== 'cells') return;
    const map = ctx.store.state.history.doc.map;
    const w = sel.x1 - sel.x0 + 1, h = sel.y1 - sel.y0 + 1;
    const cells = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        cells[y * w + x] = cellAt(map, sel.x0 + x, sel.y0 + y);
      }
    }
    ctx.store.update((_s) => ({ clipboard: { width: w, height: h, cells } }));
  }

  /** Ctrl+X: 복사 후 지우개로 채움 */
  cutSelection(ctx: ToolContext): void {
    this.copySelection(ctx);
    this.deleteSelection(ctx);
  }

  /** Ctrl+V: 고스트 붙여넣기 시작 */
  startPaste(ctx: ToolContext): void {
    if (!ctx.store.state.clipboard) return;
    this.pasteGhost = { x: 0, y: 0 };
  }

  /** Delete: 선택 영역을 지우개로 채움 */
  deleteSelection(ctx: ToolContext): void {
    const sel = ctx.store.state.selection;
    if (sel.kind !== 'cells') return;
    const map = ctx.store.state.history.doc.map;
    const cells = rectCells(map, sel.x0, sel.y0, sel.x1, sel.y1, false);
    const useCell = ctx.store.state.eraserCell as Cell;
    ctx.store.state.history.beginStroke();
    const cmd = paintCells(map, cells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '삭제');
    ctx.store.dispatch(cmd);
    ctx.store.state.history.endStroke();
    ctx.store.update((_s) => ({ selection: { kind: 'none' } }));
  }

  private ghostCells(anchor: { x: number; y: number }, clip: { width: number; height: number; cells: Uint8Array }): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < clip.height; y++) {
      for (let x = 0; x < clip.width; x++) {
        out.push({ x: anchor.x + x, y: anchor.y + y });
      }
    }
    return out;
  }
}