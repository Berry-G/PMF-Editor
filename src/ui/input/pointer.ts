/**
 * 목적: 포인터 이벤트 → 도구 디스패치 + 뷰 조작(팬·줌).
 * 왜 이 구조인가: SDD-09 §10. 현재 도구(store.state.tool)에 따라 onDown/onMove/onUp 호출.
 *   팬(Space+드래그/중클릭)과 줌(휠)은 도구와 무관하게 항상 동작.
 * 바꾸면 안 되는 것: 줌 factor 1.1, Space+드래그 팬.
 * 근거: SDD-03 §8 [D-03-08], SDD-09 §10 [D-09-10]
 */
import type { Store } from '../state.js';
import type { ToolId } from '../state.js';
import { View } from '../canvas/view.js';
import { StatusBar } from '../panels/status.js';
import { BrushTool } from './tools/brush.js';
import { LineTool } from './tools/line.js';
import { RectTool } from './tools/rect.js';
import { FillTool } from './tools/fill.js';
import { SelectTool } from './tools/select.js';
import { EyedropperTool } from './tools/eyedropper.js';
import { NodeTool } from './tools/node.js';
import { EdgeTool } from './tools/edge.js';
import { ObjectTool } from './tools/object.js';
import type { Tool, PointerInfo, ToolContext } from './tools/tool.js';

const TOOLS: Partial<Record<ToolId, Tool>> = {
  brush: new BrushTool(),
  line: new LineTool(),
  rect: new RectTool(),
  fill: new FillTool(),
  select: new SelectTool(),
  eyedropper: new EyedropperTool(),
  node: new NodeTool(),
  edge: new EdgeTool(),
  object: new ObjectTool(),
};

export function mountPointer(canvas: HTMLCanvasElement, store: Store, view: View, status: StatusBar): void {
  let panning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0, spaceDown = false;
  let currentTool: Tool | null = null;
  let previousToolId: ToolId | null = null;
  canvas.oncontextmenu = (e) => e.preventDefault();
  canvas.addEventListener('keydown', (e) => { if (e.code === 'Space') { spaceDown = true; e.preventDefault(); } });
  canvas.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
  const ctx: ToolContext = { store, view, status };
  const selectTool = (TOOLS.select as SelectTool) ?? null;
  const pi = (e: MouseEvent): PointerInfo => {
    const map = store.state.history.doc.map;
    const { x, y, fx, fy } = view.screenToCell(e.offsetX, e.offsetY, map);
    return { cell: { x, y }, fx, fy, button: e.button as 0 | 1 | 2, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, sx: e.offsetX, sy: e.offsetY };
  };
  canvas.onwheel = (e) => { e.preventDefault(); view.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.1 : 1 / 1.1); store.notifyViewChanged(); };
  canvas.onmousedown = (e) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) { panning = true; panStartX = e.clientX; panStartY = e.clientY; panStartPX = view.panX; panStartPY = view.panY; e.preventDefault(); return; }
    // Alt+클릭 스포이드 일시 전환
    if (e.altKey && store.state.tool !== 'eyedropper') {
      previousToolId = store.state.tool;
      store.update((_s) => ({ tool: 'eyedropper' as const }));
    }
    // 왜 우클릭을 걸러내는가: 우클릭은 컨텍스트 메뉴 전용이다 (ADR-E12). 예전에는 지우개였는데,
    //   팔레트에서 칸을 골라 칠하면 되는 일이라 조작만 둘로 늘렸다.
    if (e.button === 2) { status.setCell(pi(e).cell.x, pi(e).cell.y); return; }
    const t = TOOLS[store.state.tool]; if (t) { currentTool = t; t.onDown(pi(e), ctx); }
    status.setCell(pi(e).cell.x, pi(e).cell.y);
  };
  canvas.onmousemove = (e) => {
    if (panning) { view.panX = panStartPX + (e.clientX - panStartX); view.panY = panStartPY + (e.clientY - panStartY); store.notifyViewChanged(); return; }
    if (currentTool) { currentTool.onMove(pi(e), ctx); } else { status.setCell(pi(e).cell.x, pi(e).cell.y); }
  };
  canvas.onmouseup = (e) => { if (currentTool) { currentTool.onUp(pi(e), ctx); currentTool = null; } panning = false; if (previousToolId) { store.update((_s) => ({ tool: previousToolId! })); previousToolId = null; } };
  canvas.onmouseleave = () => { if (currentTool) { currentTool.onCancel(ctx); currentTool = null; } panning = false; if (previousToolId) { store.update((_s) => ({ tool: previousToolId! })); previousToolId = null; } };

  // 클립보드 이벤트 (Ctrl+C/X/V, Delete)
  window.addEventListener('pmf-copy', () => { if (selectTool) selectTool.copySelection(ctx); });
  window.addEventListener('pmf-cut', () => { if (selectTool) selectTool.cutSelection(ctx); });
  window.addEventListener('pmf-paste', () => { if (selectTool) selectTool.startPaste(ctx); });
  window.addEventListener('pmf-delete', () => {
    if (selectTool) selectTool.deleteSelection(ctx);
    const { tool } = store.state;
    if (tool === 'node') { const nt = TOOLS.node as NodeTool; if (nt) nt.deleteSelected(ctx); }
    if (tool === 'edge') { const et = TOOLS.edge as EdgeTool; if (et) et.deleteSelected(ctx); }
  });
}