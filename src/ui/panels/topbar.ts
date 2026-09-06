/**
 * 목적: 상단 바 — 파일명, 스키마, 버전, 저장 안 됨(*) 표시. [열기] [저장] [TOON 복사] 실제 동작.
 * 왜 이 구조인가: 기획자가 현재 문서가 무엇인지, 저장되었는지, 어느 버전인지 바로 알 수 있어야 한다.
 * 바꾸면 안 되는 것: DOM id. innerHTML 사용 금지. 버튼 비활성 제거.
 * 근거: SDD-03 §1 [D-03-01], SDD-08 §11 [D-08-11]
 */
import type { Store } from '../state.js';
import { SCHEMA } from '../../core/schema.js';
import { TOOL_VERSION } from '../../core/version.js';
import { UI } from '../../core/palette.js';
import { encode } from '../../core/toon/encode.js';
import { decode } from '../../core/toon/decode.js';
import { openFile, saveFile, saveFileAs } from '../../io/file.js';
import type { FileSystemFileHandle } from '../../io/file.js';
import { copyText } from '../../io/clipboard.js';
import { showSaveErrorDialog } from './dialogs.js';
import { mountHelpButton } from './help.js';

// 저장 핸들 — File System Access API 핸들을 모듈 변수로 유지한다 (EditorState 에 두지 않음)
let _saveHandle: FileSystemFileHandle | null = null;

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

  const issuesBadge = document.createElement('span');
  issuesBadge.style.marginLeft = '8px';
  issuesBadge.style.cursor = 'pointer';
  container.append(issuesBadge);

  store.subscribe((state) => {
    dirtyBadge.textContent = state.history.dirty ? '*' : '';
    dirtyBadge.title = state.history.dirty ? '저장되지 않은 변경 있음' : '';
    const errs = state.issues.filter(i => i.severity === 'error').length;
    const warns = state.issues.filter(i => i.severity === 'warning').length;
    issuesBadge.textContent = errs > 0 ? '⚠ ' + errs : warns > 0 ? '⚡ ' + warns : '';
    issuesBadge.style.color = errs > 0 ? UI.error : warns > 0 ? UI.warning : UI.textDim;
  });

  // 버튼 자리
  const btnSep = document.createElement('span');
  btnSep.style.marginLeft = 'auto';
  container.append(btnSep);

  // 열기
  const openBtn = document.createElement('button');
  openBtn.textContent = '열기';
  openBtn.style.marginLeft = '4px';
  const doOpen = async () => {
    const result = await openFile();
    if (!result) return;
    const decoded = decode(result.text);
    if (!decoded.ok) {
      alert('열기 실패: ' + decoded.error.path + ' ' + decoded.error.message);
      return;
    }
    store.state.history.replace(decoded.value);
    _saveHandle = result.handle;
    store.update((_s) => ({ doc: store.state.history.doc, fileName: result.name }));
  };
  openBtn.onclick = doOpen;
  window.addEventListener('pmf-open', () => doOpen());
  container.append(openBtn);

  // 저장
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '저장';
  saveBtn.style.marginLeft = '4px';
  const doSave = async () => {
    const doSaveActual = async () => {
      const doc = store.state.history.doc;
      const text = encode(doc, { toolVersion: TOOL_VERSION, issues: store.state.issues });
      const newHandle = await saveFile(text, _saveHandle, store.state.fileName + '.toon');
      if (newHandle) { _saveHandle = newHandle; }
      store.state.history.markSaved();
      store.update((_s) => ({}));
    };
    const errorCount = store.state.issues.filter(i => i.severity === 'error').length;
    if (errorCount > 0) {
      const dialogEl = document.querySelector<HTMLElement>('#dialogs');
      if (dialogEl) { showSaveErrorDialog(store, dialogEl, doSaveActual); return; }
    }
    await doSaveActual();
  };
  saveBtn.onclick = doSave;
  window.addEventListener('pmf-save', () => doSave());
  container.append(saveBtn);

  // 다른 이름으로 저장 (오른쪽 클릭 메뉴 없이 버튼 하나 더)
  const saveAsBtn = document.createElement('button');
  saveAsBtn.textContent = '다른 이름';
  saveAsBtn.style.marginLeft = '4px';
  saveAsBtn.onclick = async () => {
    const doc = store.state.history.doc;
    const text = encode(doc, { toolVersion: TOOL_VERSION, issues: store.state.issues });
    const handle = await saveFileAs(text, store.state.fileName + '.toon');
    if (handle) { _saveHandle = handle; }
    store.state.history.markSaved();
    store.update((_s) => ({}));
  };
  container.append(saveAsBtn);

  // TOON 복사
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'TOON 복사';
  copyBtn.style.marginLeft = '4px';
  const doCopy = async () => {
    const doc = store.state.history.doc;
    const text = encode(doc, { toolVersion: TOOL_VERSION, issues: store.state.issues });
    const ok = await copyText(text);
    if (!ok) alert('클립보드 복사 실패');
  };
  copyBtn.onclick = doCopy;
  window.addEventListener('pmf-copy-toon', () => doCopy());
  container.append(copyBtn);

  // 왜 마지막인가: 파일 버튼들 오른쪽 끝에 둔다. 도움말은 자주 안 누르지만 항상 같은 자리에 있어야 한다.
  mountHelpButton(container);
}