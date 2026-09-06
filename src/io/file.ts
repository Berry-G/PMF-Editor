/**
 * 목적: 파일 열기·저장 (FSAA + 폴백). 클립보드. 초안 복구.
 * 왜 이 구조인가: FSAA(showOpenFilePicker) 가 있으면 핸들을 쥐고 있어 덮어쓰기 저장이 된다.
 *   없으면 `<input type=file>` 과 Blob 다운로드로 폴백. 기획자 PC 는 Windows+Chrome 이라 1순위.
 *   File System Access API 타입은 TS lib 에 없으므로 로컬 인터페이스로 선언한다.
 * 바꾸면 안 되는 것: UTF-8 줄 끝 `\n`. BOM 없음.
 * 근거: SDD-01 §6 [D-01-06], SDD-08 §9 [D-08-09]
 */

// 왜: TS DOM lib 에 File System Access API 타입이 없어 로컬 선언한다 (SDD-08 §13 any 금지).
export interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}
interface FileSystemWritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FileSystemPickerOptions { types?: Array<{ description: string; accept: Record<string, string[]> }>; suggestedName?: string; }
interface WindowWithFS extends Window { showOpenFilePicker?(opts: FileSystemPickerOptions): Promise<FileSystemFileHandle[]>; showSaveFilePicker?(opts: FileSystemPickerOptions): Promise<FileSystemFileHandle>; }

export interface OpenedFile { name: string; text: string; handle: FileSystemFileHandle | null }

export const hasFsAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const wFS = window as unknown as WindowWithFS;

export async function openFile(): Promise<OpenedFile | null> {
  if (hasFsAccess && wFS.showOpenFilePicker) {
    try {
      const [handle] = await wFS.showOpenFilePicker({ types: [{ description: 'TOON', accept: { 'text/plain': ['.toon'] } }] });
      if (!handle) return null;
      const file = await handle.getFile();
      const text = await file.text();
      return { name: file.name, text, handle };
    } catch { return null; }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.toon,.txt';
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) { resolve(null); return; }
      f.text().then(text => resolve({ name: f.name, text, handle: null }));
    };
    input.click();
  });
}

/**
 * 저장 결과. **취소를 성공과 구분한다.**
 * 왜: 예전에는 둘 다 `null` 이었다. 그래서 사용자가 저장 대화상자를 취소해도 호출부가
 *   `markSaved()` 를 불러 "저장됨" 으로 표시했고, 그 상태로 창을 닫으면 경고도 안 떴다.
 */
export type SaveOutcome =
  | { status: 'saved'; handle: FileSystemFileHandle | null }
  | { status: 'cancelled' };

export async function saveFile(text: string, handle: FileSystemFileHandle | null, suggestedName: string): Promise<SaveOutcome> {
  if (handle && typeof handle.createWritable === 'function') {
    try { const w = await handle.createWritable(); await w.write(text); await w.close(); return { status: 'saved', handle }; }
    catch { /* 핸들이 죽었을 수 있다(파일 이동·권한 만료) — 다시 물어본다 */ }
  }
  return saveFileAs(text, suggestedName);
}

export async function saveFileAs(text: string, suggestedName: string): Promise<SaveOutcome> {
  if (hasFsAccess && wFS.showSaveFilePicker) {
    try {
      const handle = await wFS.showSaveFilePicker({ suggestedName, types: [{ description: 'TOON', accept: { 'text/plain': ['.toon'] } }] });
      const w = await handle.createWritable(); await w.write(text); await w.close(); return { status: 'saved', handle };
    } catch (err) {
      // 왜 AbortError 만 따로 보는가: 사용자가 [취소] 를 누른 것이다. 그런데 예전에는 이걸
      //   삼키고 아래 다운로드 폴백으로 내려가서, 취소했는데도 파일이 다운로드 폴더에 생겼다.
      //   그 밖의 오류(권한·API 부재)는 폴백이 맞다.
      if (err instanceof DOMException && err.name === 'AbortError') return { status: 'cancelled' };
    }
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = suggestedName; a.click();
  URL.revokeObjectURL(url);
  return { status: 'saved', handle: null };
}