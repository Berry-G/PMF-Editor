/**
 * 목적: 코드의 `SCHEMA` 상수와 씨앗·픽스처 `.toon` 파일의 `schema:` 줄이 모두 같은지 검사한다.
 * 왜 이 구조인가: 스키마를 올릴 때 코드·씨앗·픽스처·문서가 함께 움직여야 하는데, 사람이 하면
 *   반드시 하나가 남는다. 남은 하나는 옛 파일을 조용히 받아들이는 구멍이 된다.
 * 바꾸면 안 되는 것: 픽스처 폴더를 검사 대상에서 빼지 마라. M1 에서 파일이 생기면 자동으로 포함된다.
 * 근거: SDD-02 §7 [D-02-09], SDD-06 §4 [D-06-04]
 */
import { describe, expect, it } from 'vitest';
import { SCHEMA } from '../../src/core/schema.js';
import { read, walk } from '../util/walk.js';

const TOON_FILES = [...walk('docs/examples', ['.toon']), ...walk('docs/fixtures', ['.toon'])];

function schemaLineOf(text: string): string | undefined {
  for (const line of text.split('\n')) {
    const match = /^schema:\s*(\S+)\s*$/.exec(line);
    if (match !== null) return match[1];
  }
  return undefined;
}

describe('스키마 버전 게이트', () => {
  it('씨앗 파일이 검사 대상에 있다', () => {
    expect(TOON_FILES).toContain('docs/examples/Stage_Greybox.toon');
  });

  it.each(TOON_FILES)('%s 의 schema 가 코드와 같다', (path) => {
    // 왜: V-F01 픽스처는 일부러 다른 스키마를 갖는다. 그 파일만 예외다.
    if (path.endsWith('V-F01.toon')) return;
    expect(schemaLineOf(read(path)), `${path}: schema 줄이 없거나 값이 다르다`).toBe(SCHEMA);
  });
});
