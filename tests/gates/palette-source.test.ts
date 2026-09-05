/**
 * 목적: `core/palette.ts` 의 게임 유래 색·크기 값마다 `출처:` 주석이 붙어 있는지 검사한다.
 * 왜 이 구조인가: 색의 원본은 언제나 게임 코드이고 툴은 사본이다. 출처가 없으면 게임이 바뀌었을 때
 *   어디를 고쳐야 하는지 알 수 없고, 사본이 슬그머니 원본 행세를 한다.
 *   `@출처-불필요` 마커 아래는 게임에 대응물이 없는 툴 전용 색이라 면제한다.
 * 바꾸면 안 되는 것: 마커를 파일 위쪽으로 올려 검사 범위를 줄이지 마라. 새 게임 색은 마커 **위** 에 둔다.
 * 근거: SDD-01 §5 [D-01-05], SDD-06 §4 [D-06-04], ADR-E09
 */
import { describe, expect, it } from 'vitest';
import { read, walk } from '../util/walk.js';

const PATH = 'src/core/palette.ts';
// 왜 줄 시작을 요구하나: 헤더 주석이 이 마커를 설명하면서 언급하기 때문에, 단순 포함 검사로는
//   헤더에서 먼저 매치되어 검사 범위가 통째로 잘린다 (실제로 그렇게 통과할 뻔했다).
const MARKER = /^\/\*\s*@출처-불필요/;
const COLOR_LITERAL = /'#[0-9A-Fa-f]{3,8}'|'rgba?\(/;

describe('팔레트 출처 게이트', () => {
  const lines = read(PATH).split('\n');
  const markerIndex = lines.findIndex((line) => MARKER.test(line));

  it(`${PATH} 에 @출처-불필요 마커가 줄 시작에 있다`, () => {
    // 왜: 마커가 없으면 툴 전용 색까지 검사해 거짓 실패가 난다. 마커 자체가 계약의 일부다.
    expect(markerIndex).toBeGreaterThan(0);
  });

  it('마커 위쪽의 모든 색 리터럴에 출처가 있다', () => {
    const missing = lines
      .slice(0, markerIndex === -1 ? lines.length : markerIndex)
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => COLOR_LITERAL.test(line) && !line.includes('출처:'))
      .map(({ line, no }) => `${PATH}:${no}  ${line.trim()}`);
    expect(missing, '게임 코드에서 옮긴 색에는 `// 출처: 파일:라인` 이 필요하다').toEqual([]);
  });

  it('검사한 색 리터럴이 하나 이상이다', () => {
    const found = lines
      .slice(0, markerIndex === -1 ? lines.length : markerIndex)
      .filter((line) => COLOR_LITERAL.test(line));
    expect(found.length).toBeGreaterThan(5);
  });
});


describe('팔레트 외부 색 리터럴 게이트', () => {
  const TS_FILES = walk('src', ['.ts']).filter(f => f !== 'src/core/palette.ts' && !f.endsWith('.test.ts') );
  it('src/core/ 밖의 .ts 파일에 hex 색 리터럴이 없다', () => {
    const problems: string[] = [];
    for (const f of TS_FILES) {
      const src = read(f);
      const m = /'#[0-9A-Fa-f]{3,8}'/g;
      let match;
      while ((match = m.exec(src)) !== null) {
        problems.push(f + ':' + (src.slice(0, match.index).split('\\n').length) + ' ' + match[0]);
      }
    }
    expect(problems, 'hex 색 리터럴은 palette.ts 에만 있어야 한다 (ADR-E09). COLOR[cell] 로 대체하라').toEqual([]);
  });
});


