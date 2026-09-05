/**
 * 목적: 다이얼로그 — 맵 크기 변경(SDD-03 §7), 저장 시 오류 경고(ADR-E08).
 * 왜 이 구조인가: SDD-08 §11 의 #dialogs div 에 HTMLElement 를 심는다.
 *   resizeMap 은 앵커 9칸 + 폭·높이 입력. saveError 는 오류 N건 + [저장] [취소].
 * 바꾸면 안 되는 것: 저장을 막지 마라 (ADR-E08). 앵커 9칸.
 * 근거: SDD-03 §7 [D-03-07], ADR-E08
 */
import type { Store } from '../state.js';
import { resizeMap, type Anchor } from '../../core/commands/fields.js';
import { UI } from '../../core/palette.js';

const ANCHORS: Anchor[] = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];

export function showResizeDialog(store: Store, container: HTMLElement): void {
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:' + UI.panel + ';border:1px solid ' + UI.panelBorder + ';padding:16px;z-index:100';
  container.innerHTML = '<strong>맵 크기 변경</strong>';
  const body = document.createElement('div'); body.style.margin = '8px 0';
  const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,40px);gap:2px';
  let selected: Anchor = 'c';
  for (const a of ANCHORS) {
    const btn = document.createElement('button');
    btn.textContent = ({ nw: '↖', n: '↑', ne: '↗', w: '←', c: '⊙', e: '→', sw: '↙', s: '↓', se: '↘' } as Record<string, string>)[a] ?? '·';
    btn.style.cssText = 'width:40px;height:40px;background:' + (a === 'c' ? UI.selection : UI.panelBorder) + ';border:none;color:' + UI.text;
    btn.onclick = () => { selected = a; grid.querySelectorAll('button').forEach(b => b.style.background = UI.panelBorder); btn.style.background = UI.selection; };
    grid.append(btn);
  }
  body.append(grid);
  const wL = document.createElement('label'); wL.textContent = '폭 ';
  const wI = document.createElement('input'); wI.type = 'number'; wI.value = String(store.state.history.doc.map.width); wI.style.width = '60px';
  wL.append(wI);
  const hL = document.createElement('label'); hL.textContent = ' 높이 ';
  const hI = document.createElement('input'); hI.type = 'number'; hI.value = String(store.state.history.doc.map.height); hI.style.width = '60px';
  hL.append(hI);
  body.append(wL, hL);
  container.append(body);
  const ok = document.createElement('button'); ok.textContent = '확인'; ok.style.marginRight = '4px';
  ok.onclick = () => { const w = Number(wI.value), h = Number(hI.value); if (!isNaN(w) && !isNaN(h) && w >= 10 && h >= 10 && w <= 256 && h <= 256) { store.state.history.beginStroke(); store.dispatch(resizeMap(store.state.history.doc, w, h, selected)); store.state.history.endStroke(); } container.innerHTML = ''; container.style.cssText = ''; };
  container.append(ok);
  const cancel = document.createElement('button'); cancel.textContent = '취소';
  cancel.onclick = () => { container.innerHTML = ''; container.style.cssText = ''; };
  container.append(cancel);
}

export function showSaveErrorDialog(store: Store, container: HTMLElement, onSave: () => void): void {
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:' + UI.panel + ';border:1px solid ' + UI.panelBorder + ';padding:16px;z-index:100';
  const errCount = store.state.issues.filter(i => i.severity === 'error').length;
  container.innerHTML = '<strong>검증 오류 ' + errCount + '건</strong><p style="font-size:12px;color:' + UI.textDim + '">저장은 진행되지만 Unity 임포트는 거부됩니다.</p>';
  const save = document.createElement('button'); save.textContent = '저장'; save.style.marginRight = '4px';
  save.onclick = () => { container.innerHTML = ''; container.style.cssText = ''; onSave(); };
  container.append(save);
  const cancel = document.createElement('button'); cancel.textContent = '취소';
  cancel.onclick = () => { container.innerHTML = ''; container.style.cssText = ''; };
  container.append(cancel);
}