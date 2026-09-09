/**
 * 목적: 다이얼로그 — 맵 크기 변경(SDD-03 §7), 저장·전달 전 검증 요약(ADR-E08/E13).
 * 왜 이 구조인가: SDD-08 §11 의 #dialogs div 에 HTMLElement 를 심는다.
 *   resizeMap 은 앵커 9칸 + 폭·높이 입력. 전달 요약은 Unity 대상 3개와 실제 검증 결과를 함께 보인다.
 * 바꾸면 안 되는 것: 저장을 막지 마라 (ADR-E08). 앵커 9칸.
 * 근거: SDD-03 §7·§9 [D-03-07/09], ADR-E08, ADR-E13
 */
import type { Store } from '../state.js';
import { resizeMap, type Anchor } from '../../core/commands/fields.js';
import { UI } from '../../core/palette.js';
import type { DeliverySummary } from './delivery.js';

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

export function showDeliveryDialog(
  summary: DeliverySummary,
  container: HTMLElement,
  actionLabel: string,
  onProceed: () => void,
): void {
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:' + UI.panel + ';border:1px solid ' + UI.panelBorder + ';padding:16px;z-index:100';
  container.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = summary.errorCount > 0 ? '검증 오류 ' + summary.errorCount + '건' : 'Unity 전달 전 확인';
  container.append(title);
  const details = document.createElement('div');
  details.style.cssText = 'font-size:12px;line-height:1.6;margin:8px 0;color:' + UI.textDim;
  const lines = [
    '내부 스테이지 이름: ' + (summary.internalName || '(비어 있음)'),
    '저장 파일명: ' + summary.fileName,
    'Unity 대상: ' + summary.unityAssets.join(', '),
    '마을: ' + summary.villageCount + '개 · 버스트 트리거: ' + summary.burstTriggerCount + '개',
    '검증: 오류 ' + summary.errorCount + ' · 경고 ' + summary.warningCount + ' · 정보 ' + summary.infoCount,
  ];
  for (const line of lines) { const row = document.createElement('div'); row.textContent = line; details.append(row); }
  const assetEffect = document.createElement('div');
  assetEffect.textContent = 'Unity 임포트는 동일한 내부 이름의 기존 에셋 3개를 갱신합니다.';
  details.append(assetEffect);
  const scope = document.createElement('div');
  scope.textContent = '이 결과는 에디터 검증입니다. Unity 임포트와 플레이 확인은 별도입니다.';
  details.append(scope);
  if (summary.errorCount > 0) {
    const warning = document.createElement('div');
    warning.style.color = UI.error;
    warning.textContent = '작업본 저장은 가능하지만 Unity 임포트는 거부됩니다.';
    details.append(warning);
  }
  container.append(details);
  const proceed = document.createElement('button'); proceed.textContent = actionLabel; proceed.style.marginRight = '4px';
  proceed.onclick = () => { container.replaceChildren(); container.style.cssText = ''; onProceed(); };
  container.append(proceed);
  const cancel = document.createElement('button'); cancel.textContent = '취소';
  cancel.onclick = () => { container.replaceChildren(); container.style.cssText = ''; };
  container.append(cancel);
}
