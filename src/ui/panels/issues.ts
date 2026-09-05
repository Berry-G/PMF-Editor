/**
 * 목적: 검증 패널 — 규칙 ID · 심각도 · 메시지 목록. 클릭 시 캔버스 이동 + 대상 선택.
 * 왜 이 구조인가: SDD-03 §9. 이 패널이 검증 결과를 유일하게 표시한다.
 *   클릭 시 view.centerOnCell (SDD-08 §10: View 가 유일한 좌표 변환 지점).
 *   iss.cells?.[0] + 지역 const 로 non-null ! 금지.
 * 바꾸면 안 되는 것: 클릭 시 view 이동 + selection 갱신. 좌표 변환 우회 금지.
 * 근거: SDD-03 §9 [D-03-09], ADR-E08, SDD-08 §13 [D-08-13]
 */
import type { Store, EditorState } from '../state.js';
import { View } from '../canvas/view.js';
import { UI } from '../../core/palette.js';

const SEV_COLOR: Record<string, string> = { error: UI.error, warning: UI.warning, info: UI.info };

export function mountIssues(store: Store, container: HTMLElement, view: View): void {
  const render = (state: EditorState) => {
    container.innerHTML = '';
    if (state.issues.length === 0) { container.textContent = '✓ 검증 통과'; return; }
    for (const iss of state.issues) {
      const div = document.createElement('div'); div.style.cssText = 'font-size:12px;padding:2px 4px;cursor:pointer';
      div.onclick = () => {
        const firstCell = iss.cells?.[0];
        if (firstCell) {
          view.centerOnCell(firstCell.x, firstCell.y, state.history.doc.map, 800, 600);
          store.notifyViewChanged();
        }
        const nodeIds = iss.nodeIds;
        if (nodeIds && nodeIds.length > 0) {
          store.update((_s) => ({ selection: { kind: 'nodes' as const, ids: nodeIds } }));
        } else {
          const ei = iss.edgeIndex;
          if (ei !== undefined) {
            store.update((_s) => ({ selection: { kind: 'edge' as const, index: ei } }));
          }
        }
      };
      const badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;width:50px;font-weight:bold;color:' + (SEV_COLOR[iss.severity] ?? UI.text);
      badge.textContent = iss.id; div.append(badge);
      const msg = document.createElement('span'); msg.textContent = ' ' + iss.message; msg.style.color = UI.textDim;
      div.append(msg);
      container.append(div);
    }
  };
  store.subscribe((state) => render(state));
  render(store.state);
}