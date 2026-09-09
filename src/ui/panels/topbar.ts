/**
 * 목적: 상단 바 — 내부 이름·파일명·버전·검증 상태와 열기·저장·전달 동작.
 * 왜 이 구조인가: Unity 대상 이름과 바깥 파일명을 구분하고 세 저장 경로가 같은 최신 검증을 써야 한다.
 * 바꾸면 안 되는 것: DOM id. innerHTML 사용 금지. 버튼 비활성 제거.
 * 근거: SDD-03 §1·§9 [D-03-01/09], SDD-09 §11 [D-09-11], ADR-E08, ADR-E13
 */
import type { EditorState, Store } from '../state.js';
import { SCHEMA } from '../../core/schema.js';
import { TOOL_VERSION } from '../../core/version.js';
import { UI } from '../../core/palette.js';
import { decode } from '../../core/toon/decode.js';
import { openFile, saveFile, saveFileAs } from '../../io/file.js';
import { clearDraft } from '../../io/draft.js';
import { createEmptyStage } from '../../core/model/factory.js';
import type { FileSystemFileHandle } from '../../io/file.js';
import { copyText } from '../../io/clipboard.js';
import { showDeliveryDialog } from './dialogs.js';
import { mountHelpButton } from './help.js';
import { setField } from '../../core/commands/fields.js';
import { prepareDelivery, toonFileName, type PreparedDelivery } from './delivery.js';

// 저장 핸들 — File System Access API 핸들을 모듈 변수로 유지한다 (EditorState 에 두지 않음)
let _saveHandle: FileSystemFileHandle | null = null;

export function mountTopbar(store: Store, container: HTMLElement): void {
  let fileBusy = false;
  const fileButtons: HTMLButtonElement[] = [];
  const setFileBusy = (busy: boolean): void => {
    fileBusy = busy;
    for (const button of fileButtons) button.disabled = busy;
  };
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

  const dirtyBadge = document.createElement('span');
  dirtyBadge.style.color = UI.warning;
  dirtyBadge.style.marginLeft = '8px';
  container.append(dirtyBadge);

  const issuesBadge = document.createElement('span');
  issuesBadge.style.marginLeft = '8px';
  issuesBadge.style.cursor = 'pointer';
  container.append(issuesBadge);

  const nameLabel = document.createElement('label');
  nameLabel.style.cssText = 'font-size:12px;color:' + UI.textDim + ';white-space:nowrap';
  nameLabel.textContent = '내부 이름 ';
  const nameInput = document.createElement('input');
  nameInput.style.width = '116px';
  nameInput.title = 'Unity 임포트 대상 .map.asset, .path.asset, .asset 세 파일의 기본 이름';
  nameInput.onchange = () => {
    const next = nameInput.value.trim();
    if (next === store.state.history.doc.name) return;
    store.state.history.beginStroke();
    store.dispatch(setField('name', next));
    store.state.history.endStroke();
  };
  nameLabel.append(nameInput);
  container.append(nameLabel);

  const fileBadge = document.createElement('span');
  fileBadge.style.cssText = 'font-size:11px;color:' + UI.textDim + ';white-space:nowrap';
  container.append(fileBadge);

  const renderStatus = (state: EditorState): void => {
    dirtyBadge.textContent = state.history.dirty ? '*' : '';
    dirtyBadge.title = state.history.dirty ? '저장되지 않은 변경 있음' : '';
    const errs = state.issues.filter(i => i.severity === 'error').length;
    const warns = state.issues.filter(i => i.severity === 'warning').length;
    issuesBadge.textContent = errs > 0 ? '⚠ ' + errs : warns > 0 ? '⚡ ' + warns : '';
    issuesBadge.style.color = errs > 0 ? UI.error : warns > 0 ? UI.warning : UI.textDim;
    if (document.activeElement !== nameInput) nameInput.value = state.history.doc.name;
    const normalized = toonFileName(state.fileName, state.history.doc.name);
    fileBadge.textContent = '파일 ' + normalized;
    fileBadge.title = '내부 이름과 파일명은 별개입니다. Unity는 내부 이름으로 ' +
      state.history.doc.name + '.map.asset / .path.asset / .asset 을 갱신합니다.';
  };
  store.subscribe(renderStatus);
  renderStatus(store.state);

  const btnSep = document.createElement('span');
  btnSep.style.marginLeft = 'auto';
  container.append(btnSep);

  const dialogEl = (): HTMLElement | null => document.querySelector<HTMLElement>('#dialogs');
  const showPrepared = (
    prepared: PreparedDelivery,
    actionLabel: string,
    always: boolean,
    action: (delivery: PreparedDelivery) => Promise<void>,
  ): void => {
    // 왜: 화면 배지는 디바운스될 수 있지만 저장·복사에 쓴 결과와 검증 탭은 같아야 한다.
    store.update(() => ({ issues: prepared.issues }));
    const dialogs = dialogEl();
    if (dialogs && (always || prepared.summary.errorCount > 0)) {
      showDeliveryDialog(prepared.summary, dialogs, actionLabel, () => {
        // 왜: 확인창을 읽는 동안 문서가 바뀌었다면 화면에 보인 요약과 실제 전달본이 달라진다.
        const latest = prepare();
        if (latest.doc !== prepared.doc) { showPrepared(latest, actionLabel, always, action); return; }
        void action(prepared);
      });
      return;
    }
    void action(prepared);
  };
  const prepare = (): PreparedDelivery => prepareDelivery(
    store.state.history.doc,
    store.state.catalog,
    store.state.fileName,
    TOOL_VERSION,
  );
  const explainError = (operation: string, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    alert(operation + ' 실패: ' + message);
  };

  const newBtn = document.createElement('button');
  newBtn.textContent = '새로 만들기';
  newBtn.style.marginLeft = '4px';
  newBtn.onclick = () => {
    if (fileBusy) return;
    if (store.state.history.dirty && !confirm('저장하지 않은 변경이 있다. 버리고 새로 만들까?')) return;
    const name = prompt('내부 스테이지 이름 (Unity 에셋 이름이 된다)', 'Stage_New');
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed === '') { alert('이름이 비었다.'); return; }
    store.state.history.replace(createEmptyStage(trimmed, 32, 18));
    _saveHandle = null;
    clearDraft();
    store.update(() => ({ doc: store.state.history.doc, fileName: trimmed + '.toon' }));
  };
  container.append(newBtn);
  fileButtons.push(newBtn);

  const openBtn = document.createElement('button');
  openBtn.textContent = '열기';
  openBtn.style.marginLeft = '4px';
  const doOpen = async (): Promise<void> => {
    if (fileBusy) return;
    if (store.state.history.dirty && !confirm('저장하지 않은 변경이 있다. 버리고 다른 파일을 열까?')) return;
    setFileBusy(true);
    try {
      const result = await openFile();
      if (!result) return;
      const decoded = decode(result.text);
      if (!decoded.ok) {
        alert('열기 실패: ' + decoded.error.line + '행 · ' + decoded.error.path + ' — ' + decoded.error.message);
        return;
      }
      store.state.history.replace(decoded.value);
      _saveHandle = result.handle;
      clearDraft();
      store.update(() => ({ doc: store.state.history.doc, fileName: result.name }));
    } catch (error) {
      explainError('열기', error);
    } finally {
      setFileBusy(false);
    }
  };
  openBtn.onclick = () => { void doOpen(); };
  window.addEventListener('pmf-open', () => { void doOpen(); });
  container.append(openBtn);
  fileButtons.push(openBtn);

  const savePrepared = async (prepared: PreparedDelivery, saveAs: boolean): Promise<void> => {
    if (fileBusy) return;
    setFileBusy(true);
    try {
      const result = saveAs
        ? await saveFileAs(prepared.text, prepared.summary.fileName)
        : await saveFile(prepared.text, _saveHandle, prepared.summary.fileName);
      if (result.status === 'cancelled') return;
      _saveHandle = result.handle;
      const sameSnapshot = store.state.history.doc === prepared.doc;
      if (sameSnapshot) {
        store.state.history.markSaved();
        clearDraft();
      }
      store.update(() => ({ fileName: result.name }));
    } catch (error) {
      explainError('저장', error);
    } finally {
      setFileBusy(false);
    }
  };

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '저장';
  saveBtn.style.marginLeft = '4px';
  const doSave = (): void => {
    if (fileBusy) return;
    const prepared = prepare();
    showPrepared(prepared, '작업본 저장', false, delivery => savePrepared(delivery, false));
  };
  saveBtn.onclick = doSave;
  window.addEventListener('pmf-save', doSave);
  container.append(saveBtn);
  fileButtons.push(saveBtn);

  const saveAsBtn = document.createElement('button');
  saveAsBtn.textContent = '다른 이름으로 저장';
  saveAsBtn.style.marginLeft = '4px';
  saveAsBtn.onclick = () => {
    if (fileBusy) return;
    const prepared = prepare();
    showPrepared(prepared, '확인하고 저장', true, delivery => savePrepared(delivery, true));
  };
  container.append(saveAsBtn);
  fileButtons.push(saveAsBtn);

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'TOON 복사';
  copyBtn.style.marginLeft = '4px';
  const doCopy = (): void => {
    if (fileBusy) return;
    const prepared = prepare();
    showPrepared(prepared, '확인하고 복사', true, async delivery => {
      try {
        const ok = await copyText(delivery.text);
        if (!ok) alert('클립보드 복사 실패');
      } catch (error) {
        explainError('클립보드 복사', error);
      }
    });
  };
  copyBtn.onclick = doCopy;
  window.addEventListener('pmf-copy-toon', doCopy);
  container.append(copyBtn);
  fileButtons.push(copyBtn);

  mountHelpButton(container);
}
