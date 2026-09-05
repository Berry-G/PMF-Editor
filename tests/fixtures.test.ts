/**
 * 목적: 검증 픽스처 테스트. valid 는 error·warning 0건, invalid/<ID> 는 정확히 그 ID 만 낸다.
 *   그리고 **규칙 28개가 실제로 실행되는지** 감사한다.
 * 왜 이 구조인가: "픽스처 파일이 있다" 와 "규칙이 돈다" 는 다르다. 파일 이름만 대조하던 시절에
 *   규칙 6개가 한 번도 실행되지 않은 채 초록불이었다. 마지막 감사 테스트가 그 구멍을 막는다 —
 *   픽스처를 구조적으로 깨뜨려 decode 에서 죽게 만들면 이 감사가 즉시 잡는다.
 * 바꾸면 안 되는 것: DECODE_BLOCKED 는 넷뿐이다. 여기에 규칙을 추가해서 통과시키지 마라 —
 *   그건 그 규칙을 영영 실행하지 않겠다는 뜻이다. COMPANION 도 "논리적으로 필연" 인 것만 넣는다.
 *   자기 ID 미발화는 언제나 실패다.
 * 근거: SDD-06 §3 [D-06-03], SDD-09 §3-6 [D-09-03], SDD-02 §5 [D-02-06]
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from '../src/core/toon/decode.js';
import { validate } from '../src/core/validate/index.js';
import { RULE_IDS } from '../src/core/validate/rules.js';

const ROOT = process.cwd();
const VALID_DIR = join(ROOT, 'docs', 'fixtures', 'valid');
const INVALID_DIR = join(ROOT, 'docs', 'fixtures', 'invalid');
const CTX = { mode: 'tool' as const, enemyCatalog: new Set(['Robot_Walker', 'Robot_Scout']) };

/**
 * 디코더가 소관인 규칙. 구조가 깨진 문서는 `StageDocument` 를 만들 수조차 없으므로
 * validate 가 아니라 decode 가 거부한다 (SDD-02 §5-1·§5-2).
 * **넷뿐이다.** 여기에 더 넣는 것은 그 규칙을 실행하지 않겠다는 뜻이다.
 */
const DECODE_BLOCKED = new Set(['V-F01', 'V-F03', 'V-M01', 'V-M02']);

/**
 * 동반 규칙 — 위반 하나가 논리적으로 다른 하나를 반드시 끌고 오는 경우만 적는다.
 * 픽스처를 고쳐서 없앨 수 있는 동반은 넣지 말고 픽스처를 고쳐라.
 */
const COMPANION: Record<string, readonly string[]> = {
  // 마을이 0개면 도달 가능한 배치 칸도 0개가 되어 V-M06 이 100% 로 뜬다.
  'V-M03': ['V-M06'],
  // 배치 칸이 0개면 어느 마을에서도 갈 수 있는 배치 칸이 0개다.
  'V-M04': ['V-M07'],
};

const isSignificant = (severity: string): boolean => severity !== 'info';
const read = (dir: string, file: string): string => readFileSync(join(dir, file), 'utf8');
const listToon = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.toon')).sort() : [];

describe('검증 픽스처', () => {
  const validFiles = listToon(VALID_DIR);
  const invalidFiles = listToon(INVALID_DIR);

  it('픽스처 폴더가 비어 있지 않다', () => {
    expect(validFiles.length).toBeGreaterThan(0);
    expect(invalidFiles.length).toBe(RULE_IDS.length);
  });

  for (const file of validFiles) {
    it(`valid/${file} — decode 성공, error·warning 0건`, () => {
      const r = decode(read(VALID_DIR, file));
      expect(r.ok, `decode 실패`).toBe(true);
      if (!r.ok) return;
      const issues = validate(r.value, CTX);
      const significant = issues.filter((i) => isSignificant(i.severity));
      expect(
        significant.map((i) => `${i.id}[${i.severity}] ${i.message}`),
        `valid/${file} 은 유효해야 한다`,
      ).toEqual([]);
      // 왜 info 를 세는가: V-M06 은 도달 불가가 0이어도 항상 한 줄을 낸다 (SDD-02 §5-2 상시 표시).
      //   침묵하면 기획자는 계기가 죽은 것인지 0 인 것인지 구분할 수 없다.
      expect(issues.filter((i) => i.severity === 'info').map((i) => i.id)).toEqual(['V-M06']);
    });
  }

  for (const file of invalidFiles) {
    const expectedId = file.replace('.toon', '');
    it(`invalid/${file} — 정확히 ${expectedId}`, () => {
      const r = decode(read(INVALID_DIR, file));
      if (!r.ok) {
        expect(
          DECODE_BLOCKED.has(expectedId),
          `invalid/${file}: decode 가 거부했다 (${r.error.line}행 "${r.error.message}"). ` +
            `${expectedId} 는 decode 소관 규칙이 아니다 — 픽스처가 구조적으로 깨져 규칙이 실행되지 않는다.`,
        ).toBe(true);
        return;
      }
      expect(
        DECODE_BLOCKED.has(expectedId),
        `invalid/${file}: decode 소관 규칙인데 decode 를 통과했다`,
      ).toBe(false);

      const significant = [
        ...new Set(validate(r.value, CTX).filter((i) => isSignificant(i.severity)).map((i) => i.id)),
      ];
      expect(significant, `invalid/${file}: 자기 규칙이 발화하지 않았다`).toContain(expectedId);
      const allowed = [expectedId, ...(COMPANION[expectedId] ?? [])];
      expect(
        significant.filter((id) => !allowed.includes(id)),
        `invalid/${file}: 기대 ${allowed.join('+')} 인데 실제 ${significant.join(',')}`,
      ).toEqual([]);
    });
  }

  it('규칙 28개가 실제로 실행된다 (decode 소관 4개 제외)', () => {
    const fired = new Set<string>();
    for (const dir of [VALID_DIR, INVALID_DIR]) {
      for (const file of listToon(dir)) {
        const r = decode(read(dir, file));
        if (!r.ok) continue;
        for (const issue of validate(r.value, CTX)) fired.add(issue.id);
      }
    }
    const never = (RULE_IDS as readonly string[]).filter((id) => !fired.has(id));
    expect(
      never.sort(),
      '이 규칙들은 픽스처 전체를 돌려도 한 번도 발화하지 않는다 = 검증 코드가 실행된 적이 없다',
    ).toEqual([...DECODE_BLOCKED].sort());
  });
});
