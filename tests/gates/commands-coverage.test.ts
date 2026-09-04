/**
 * 목적: src/core/commands/ 의 커맨드 생성 함수와 왕복 테스트 커버리지가 일치하는지 검사.
 * 왜 이 구조인가: "명세에 있는데 구현이 없다" / "구현은 있는데 테스트가 없다" 를 사람이 세지 않게
 *   한다. 함수 이름을 **코드에서 정규식으로 추출**한다 — 손으로 적은 배열은 또 빠진다.
 *   왕복 테스트(commands.test.ts) 의 runRoundtrip 첫 인자(함수 이름) 집합과 비교한다.
 *   parseToon 을 import 하지 않고 파일 텍스트만 읽는다 (게이트이므로 실행 비용 0).
 * 바꾸면 안 되는 것: 커맨드 파일에서 `export function` 정규식으로 추출하는 것.
 *   command.ts 의 History 클래스·Command interface 는 커맨드 생성 함수가 아니므로 제외.
 *   커맨드를 추가하면 왕복 테스트도 같이 추가해야 이 게이트가 통과한다.
 * 근거: SDD-06 §4 [D-06-04], SDD-08 §7 [D-08-07]
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CMD_DIR = join(__dirname, '..', '..', 'src', 'core', 'commands');
const ROUNDTRIP_FILE = join(CMD_DIR, 'commands.test.ts');

/** 커맨드 생성 함수 이름을 코드에서 추출한다 (command.ts 의 History/Command 제외). */
function extractImplemented(): string[] {
  const files = readdirSync(CMD_DIR).filter(f =>
    f.endsWith('.ts') && f !== 'command.ts' && !f.endsWith('.test.ts'),
  );
  const names: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(CMD_DIR, f), 'utf8');
    const re = /export function (\w+)/g;
    let m;
    while ((m = re.exec(src)) !== null) names.push(m[1]!);
  }
  return [...new Set(names)].sort();
}

/** 왕복 테스트가 runRoundtrip(함수 이름, ...) 로 다루는 커맨드 이름을 추출한다. */
function extractCovered(): string[] {
  const src = readFileSync(ROUNDTRIP_FILE, 'utf8');
  const names: string[] = [];
  const re = /runRoundtrip\('([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]!);
  return [...new Set(names)].sort();
}

describe('커맨드 커버리지 게이트', () => {
  it('구현된 커맨드가 비어 있지 않다', () => {
    expect(extractImplemented().length).toBeGreaterThan(5);
  });

  it('구현된 모든 커맨드가 왕복 테스트에서 다뤄진다', () => {
    const implemented = extractImplemented();
    const covered = extractCovered();
    const missing = implemented.filter(n => !covered.includes(n));
    expect(
      missing,
      '다음 커맨드에 왕복 테스트가 없다 (commands.test.ts 의 runRoundtrip 호출 추가)',
    ).toEqual([]);
  });

  it('왕복 테스트의 runRoundtrip 이름이 모두 실제 함수다', () => {
    const implemented = extractImplemented();
    const covered = extractCovered();
    const phantom = covered.filter(n => !implemented.includes(n));
    expect(
      phantom,
      '다음 runRoundtrip 이름에 대응하는 커맨드 함수가 없다 (스펠링 확인)',
    ).toEqual([]);
  });
});