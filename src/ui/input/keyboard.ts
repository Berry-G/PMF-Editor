/**
 * 목적: 단축키 표 (SDD-03 §8). Ctrl+Z/Y, 1~7 팔레트, B/L/R/F/M/I 도구, `[` `]` 브러시 크기.
 * 왜 이 구조인가: 표는 고정. 바꾸면 기획자 손이 어긋난다. 입력 필드 포커스 시 문자 단축키 무시.
 * 바꾸면 안 되는 것: 단축키 매핑 — SDD-03 §8 표 그대로.
 * 근거: SDD-03 §8 [D-03-08]
 */
import type { Store, ToolId } from '../state.js';
import { View } from '../canvas/view.js';
import { PALETTE_ORDER } from '../../core/model/cell.js';

const TOOL_KEYS: Record<string, ToolId> = { b: 'brush', l: 'line', r: 'rect', f: 'fill', m: 'select', i: 'eyedropper', n: 'node', e: 'edge', v: 'object' };

function decSize(s: 1 | 3 | 5): 1 | 3 | 5 { return s === 5 ? 3 : s === 3 ? 1 : 1; }
function incSize(s: 1 | 3 | 5): 1 | 3 | 5 { return s === 1 ? 3 : s === 3 ? 5 : 5; }

export function mountKeyboard(store: Store, view: View): void {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); if (e.shiftKey) store.state.history.redo(); else store.state.history.undo(); store.update((_s) => ({ doc: store.state.history.doc })); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); store.state.history.redo(); store.update((_s) => ({ doc: store.state.history.doc })); return; }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); dispatchEvent(new Event('pmf-save')); return; }
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); dispatchEvent(new Event('pmf-open')); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); dispatchEvent(new Event('pmf-copy-toon')); return; }
    if (e.ctrlKey && e.key === '0') { e.preventDefault(); view.zoom = 1; view.panX = 0; view.panY = 0; store.notifyViewChanged(); return; }
    if (e.ctrlKey && e.key === '1') { e.preventDefault(); view.zoom = 1; store.notifyViewChanged(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 7) { store.update((_s) => ({ paletteCell: PALETTE_ORDER[n - 1]! })); return; }
    const tool = TOOL_KEYS[e.key.toLowerCase()];
    if (tool) { store.update((_s) => ({ tool })); return; }
    if (e.key === '[') { store.update((_s) => ({ brushSize: decSize(_s.brushSize) })); return; }
    if (e.key === ']') { store.update((_s) => ({ brushSize: incSize(_s.brushSize) })); return; }
    if (e.key === 'g' || e.key === 'G') { store.update((_s) => ({ showGrid: !_s.showGrid })); return; }
    if (e.key === 'h' || e.key === 'H') { store.update((_s) => ({ layers: { ..._s.layers, reach: !_s.layers.reach } })); return; }
    if (e.key === 'Escape') { store.update((_s) => ({ selection: { kind: 'none' as const } })); return; }
  });
}