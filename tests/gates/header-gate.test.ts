/**
 * 목적: 모든 소스 파일이 4항목 헤더 주석을 갖고, `근거:` 가 SDD 절이나 ADR 을 가리키는지 검사한다.
 * 왜 이 구조인가: 사용자 요구의 핵심은 "왜 그렇게 설계했는가가 주석으로 남는 것" 이다. 문화에
 *   맡기면 바쁠 때 가장 먼저 사라진다. 게이트로 만들면 헤더 없는 파일은 애초에 커밋되지 않는다.
 *   테스트 파일도 예외가 아니다 — 무엇을 왜 지키는지가 테스트에도 있어야 한다.
 * 바꾸면 안 되는 것: 네 항목의 이름과 순서, `근거:` 의 SDD/ADR 참조 요구. 예외 목록을 만들지 마라.
 * 근거: SDD-00 §6 [D-00-05], SDD-06 §4 [D-06-04], SDD-08 §12 [D-08-12]
 */
import { describe, expect, it } from 'vitest';
import { read, walk } from '../util/walk.js';

const TARGETS = [
  ...walk('src', ['.ts']),
  ...walk('tests', ['.ts']),
  ...walk('scripts', ['.mjs']),
  'vite.config.ts',
];

const ITEMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: '목적:', pattern: /^\s*(?:\*|#)\s*목적:\s*\S/m },
  { label: '왜 이 구조인가:', pattern: /^\s*(?:\*|#)\s*왜 이 구조인가:\s*\S/m },
  { label: '바꾸면 안 되는 것:', pattern: /^\s*(?:\*|#)\s*바꾸면 안 되는 것:\s*\S/m },
  { label: '근거: (SDD-0n 또는 ADR-E0n)', pattern: /^\s*(?:\*|#)\s*근거:.*(?:SDD-0\d|ADR-E\d\d)/m },
];

/** 파일 첫머리의 헤더 블록만 잘라낸다. 본문에 우연히 같은 문구가 있어도 통과하지 않도록. */
function headerOf(source: string, path: string): string {
  if (path.endsWith('.sh')) {
    const lines = source.split('\n');
    const start = lines[0]?.startsWith('#!') === true ? 1 : 0;
    const end = lines.findIndex((line, i) => i >= start && !line.startsWith('#'));
    return lines.slice(start, end === -1 ? lines.length : end).join('\n');
  }
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('/**') && !trimmed.startsWith('/*')) return '';
  const close = trimmed.indexOf('*/');
  return close === -1 ? '' : trimmed.slice(0, close);
}

describe('헤더 게이트', () => {
  it('검사 대상이 비어 있지 않다', () => {
    // 왜: 순회가 깨져 0개를 검사하면 게이트 전체가 조용히 통과한다.
    expect(TARGETS.length).toBeGreaterThan(5);
  });

  it.each(TARGETS)('%s 에 4항목 헤더가 있다', (path) => {
    const header = headerOf(read(path), path);
    expect(header, `${path}: 파일 첫머리에 블록 주석 헤더가 없다`).not.toBe('');
    const missing = ITEMS.filter((item) => !item.pattern.test(header)).map((item) => item.label);
    expect(missing, `${path}: 헤더에 빠진 항목`).toEqual([]);
  });
});
