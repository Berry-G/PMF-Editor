/**
 * 목적: localStorage 초안 저장/로드/삭제. SDD-01 §6, SDD-09 §11.
 * 왜 이 구조인가: 5초 디바운스로 저장. 시작 시 1시간 이내면 복구 UI.
 * 바꾸면 안 되는 것: DRAFT_KEY 고정. try/catch 로 저장 실패 무시.
 * 근거: SDD-01 §6 [D-01-06], SDD-09 §11 [D-09-11]
 */
const DRAFT_KEY = 'pmf-editor.draft';
const DRAFT_HOURS = 1;

export function saveDraft(text: string, name: string): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), name, text })); } catch { /* ignore */ }
}

export function loadDraft(): { savedAt: number; name: string; text: string } | null {
  try {
    const d = localStorage.getItem(DRAFT_KEY);
    if (!d) return null;
    const parsed = JSON.parse(d) as { savedAt: number; name: string; text: string };
    // 1시간 이상 지난 초안은 무시
    if (Date.now() - parsed.savedAt > DRAFT_HOURS * 60 * 60 * 1000) { clearDraft(); return null; }
    return parsed;
  } catch { return null; }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}