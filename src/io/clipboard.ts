/**
 * 목적: 클립보드 복사. navigator.clipboard 폴백.
 * 왜 이 구조인가: SDD-01 §6. TOON 텍스트를 클립보드에 복사한다 (Ctrl+Shift+C).
 * 바꾸면 안 되는 것: 실패 시 false 반환.
 * 근거: SDD-01 §6 [D-01-06], SDD-08 §9 [D-08-09]
 */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}