/**
 * 목적: 상단 바 — 파일명, 스키마, 버전, 저장 안 됨(*) 표시. 버튼 자리만.
 * 왜 이 구조인가: 기획자가 현재 문서가 무엇인지, 저장되었는지, 어느 버전인지 바로 알 수 있어야 한다.
 * 바꾸면 안 되는 것: DOM id. innerHTML 사용 금지.
 * 근거: SDD-03 §1 [D-03-01], SDD-08 §11 [D-08-11]
 */
import type { Store } from '../state.js';
import { SCHEMA } from '../../core/schema.js';
import { TOOL_VERSION } from '../../core/version.js';
import { UI } from '../../core/palette.js';

export function mountTopbar(store: Store, container: HTMLElement): void {
  const title = document.createElement('strong');
  title.textContent = 'PMF Editor';
  container.append(title);

  const schema = document.createElement('span');
  schema.style.color = UI.textDim;
  schema.textContent = SCHEMA;
  container.append(schema);

  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = TOOL_VERSION;
  container.append(version);

  // 저장 안 됨 표시
  const dirtyBadge = document.createElement('span');
  dirtyBadge.style.color = UI.warning;
  dirtyBadge.style.marginLeft = '8px';
  dirtyBadge.textContent = '';
  container.append(dirtyBadge);

  store.subscribe((state) => {
    dirtyBadge.textContent = state.history.dirty ? '●' : '';
    dirtyBadge.title = state.history.dirty ? '저장되지 않은 변경 있음' : '';
  });

  // 버튼 자리 (M2-B 에서 활성화)
  const btnSep = document.createElement('span');
  btnSep.style.marginLeft = 'auto';
  container.append(btnSep);

  for (const [label, _id] of [['열기', 'open'], ['저장', 'save'], ['TOON 복사', 'copy']] as const) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = true;
    btn.style.marginLeft = '4px';
    container.append(btn);
  }
}