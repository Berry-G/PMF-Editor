/**
 * 목적: 파일 선택 취소와 실제 I/O 실패를 구분하고 저장 실패를 성공으로 삼키지 않는지 검증한다.
 * 왜 이 구조인가: 브라우저 피커는 전역 API라 모듈을 매 테스트 다시 불러 독립된 가짜 창을 사용한다.
 * 바꾸면 안 되는 것: AbortError만 취소다. read/write/close 오류는 reject 되어 UI가 표시해야 한다.
 * 근거: SDD-08 §9 [D-08-09], SDD-09 §11 [D-09-11], ADR-E13
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('파일 오류 경계', () => {
  it('열기 피커 AbortError만 취소로 돌린다', async () => {
    vi.stubGlobal('window', { showOpenFilePicker: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')) });
    const { openFile } = await import('./file.js');
    await expect(openFile()).resolves.toBeNull();
  });

  it('열기 권한·읽기 오류는 호출부로 전달한다', async () => {
    vi.stubGlobal('window', { showOpenFilePicker: vi.fn().mockRejectedValue(new Error('permission denied')) });
    const { openFile } = await import('./file.js');
    await expect(openFile()).rejects.toThrow('permission denied');
  });

  it('폴백 파일 선택 취소도 대기 중인 Promise를 끝낸다', async () => {
    const input = { type: '', accept: '', files: null, onchange: null as null | (() => void), oncancel: null as null | (() => void), click(): void { this.oncancel?.(); } };
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(input) });
    const { openFile } = await import('./file.js');
    await expect(openFile()).resolves.toBeNull();
  });

  it('폴백 File.text 실패도 reject한다', async () => {
    const file = { name: 'bad.toon', text: vi.fn().mockRejectedValue(new Error('read failed')) };
    const input = { type: '', accept: '', files: [file], onchange: null as null | (() => void), oncancel: null as null | (() => void), click(): void { this.onchange?.(); } };
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(input) });
    const { openFile } = await import('./file.js');
    await expect(openFile()).rejects.toThrow('read failed');
  });

  it('기존 핸들 write 실패를 다른 이름 저장으로 숨기지 않는다', async () => {
    vi.stubGlobal('window', {});
    const { saveFile } = await import('./file.js');
    const handle = {
      getFile: vi.fn(),
      createWritable: vi.fn().mockResolvedValue({ write: vi.fn().mockRejectedValue(new Error('disk full')), close: vi.fn() }),
    };
    await expect(saveFile('x', handle, 'stage.toon')).rejects.toThrow('disk full');
  });

  it('다른 이름 저장 성공 시 사용자가 고른 실제 파일명을 돌린다', async () => {
    const handle = {
      getFile: vi.fn().mockResolvedValue({ name: 'chosen.toon' }),
      createWritable: vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() }),
    };
    vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn().mockResolvedValue(handle) });
    const { saveFileAs } = await import('./file.js');
    await expect(saveFileAs('x', 'suggested.toon')).resolves.toMatchObject({ status: 'saved', name: 'chosen.toon' });
  });
});
