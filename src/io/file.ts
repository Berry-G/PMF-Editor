/**
 * 목적: 파일 열기·저장 (FSAA + 폴백). 클립보드. 초안 복구.
 * 왜 이 구조인가: FSAA(showOpenFilePicker) 가 있으면 핸들을 쥐고 있어 덮어쓰기 저장이 된다.
 *   없으면 `<input type=file>` 과 Blob 다운로드로 폴백. 기획자 PC 는 Windows+Chrome 이라 1순위.
 *   File System Access API 타입은 TS lib 에 없으므로 로컬 인터페이스로 선언한다.
 * 바꾸면 안 되는 것: UTF-8 줄 끝 `\n`. BOM 없음.
 * 근거: SDD-01 §6 [D-01-06], SDD-08 §9 [D-08-09]
 */

// 왜: TS DOM lib 에 File System Access API 타입이 없어 로컬 선언한다 (SDD-08 §13 any 금지).
interface FileSystemFileHandle {
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

export async function saveFile(text: string, handle: FileSystemFileHandle | null, suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (handle && typeof (handle as any).createWritable === 'function') { // 편차: TS 가 createWritable 을 모르므로 as any 가 불가피
    try { const w = await handle.createWritable(); await w.write(text); await w.close(); return handle; }
    catch { /* fall through */ }
  }
  return saveFileAs(text, suggestedName);
}

export async function saveFileAs(text: string, suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (hasFsAccess && wFS.showSaveFilePicker) {
    try {
      const handle = await wFS.showSaveFilePicker({ suggestedName, types: [{ description: 'TOON', accept: { 'text/plain': ['.toon'] } }] });
      const w = await handle.createWritable(); await w.write(text); await w.close(); return handle;
    } catch { /* fall through */ }
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = suggestedName; a.click();
  URL.revokeObjectURL(url);
  return null;
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

const DRAFT_KEY = 'pmf-editor.draft';

export function saveDraft(text: string, name: string): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), name, text })); } catch { /* ignore */ }
}

export function loadDraft(): { savedAt: number; name: string; text: string } | null {
  try { const d = localStorage.getItem(DRAFT_KEY); if (!d) return null; return JSON.parse(d); }
  catch { return null; }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}