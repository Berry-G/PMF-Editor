/**
 * 목적: 채우기 도구 — 4-연결 플러드필. 클릭한 셀과 같은 종류만 채운다.
 * 왜 이 구조인가: SDD-09 §10. floodFill 은 core/geometry 에서 이미 검증됨.
 * 바꾸면 안 되는 것: 우클릭은 이 도구에 오지 않는다 (ADR-E12).
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { paintCells } from '../../../core/commands/paint.js';
import { floodFill } from '../../../core/geometry/flood.js';
import { cellAt } from '../../../core/model/map.js';
import { Cell } from '../../../core/model/cell.js';

export class FillTool implements Tool {
  readonly id = 'fill' as const;

  onDown(_p: PointerInfo, _ctx: ToolContext): void {
    // down 에서 바로 실행 (드래그 없음)
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void {
    // preview: 따라다니는 플러드필 영역 (추후 구현)
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    const map = ctx.store.state.history.doc.map;
    const palCell = ctx.store.state.paletteCell as Cell;
    const useCell = palCell;   // 우클릭 지우개는 폐지됐다 (ADR-E12) — 우클릭은 컨텍스트 메뉴다
    const same = (c: Cell) => c === cellAt(map, p.cell.x, p.cell.y);
    const cells = floodFill(map, p.cell.x, p.cell.y, same);
    if (cells.length === 0) return;
    ctx.store.state.history.beginStroke();
    const cmd = paintCells(map, cells.map(c => ({ x: c.x, y: c.y, cell: useCell })), '채우기');
    ctx.store.dispatch(cmd);
    ctx.store.state.history.endStroke();
  }

  onCancel(_ctx: ToolContext): void { /* nothing */ }
}