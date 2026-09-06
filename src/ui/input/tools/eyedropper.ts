/**
 * 목적: 스포이드 도구 — 클릭한 칸의 셀 종류를 팔레트로 설정. 종료 시 이전 도구로 복귀.
 * 왜 이 구조인가: SDD-09 §10. Alt+클릭으로도 동작 (단축키 처리에서 다른 도구 일시 전환).
 *   이전 도구 복귀는 pointer.ts 에서 currentTool 이 null 이면 TOOLS[store.state.tool] 을 다시 읽는다.
 * 바꾸면 안 되는 것: 좌클릭만 받는다 — 우클릭은 컨텍스트 메뉴다 (ADR-E12).
 * 근거: SDD-09 §10 [D-09-10], SDD-03 §3 [D-03-03]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { cellAt } from '../../../core/model/map.js';
export class EyedropperTool implements Tool {
  readonly id = 'eyedropper' as const;

  onDown(p: PointerInfo, ctx: ToolContext): void {
    const map = ctx.store.state.history.doc.map;
    const c = cellAt(map, p.cell.x, p.cell.y);
    ctx.store.update((_s) => ({ paletteCell: c }));
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void { /* nothing */ }
  onUp(_p: PointerInfo, _ctx: ToolContext): void { /* nothing */ }
  onCancel(_ctx: ToolContext): void { /* nothing */ }
}