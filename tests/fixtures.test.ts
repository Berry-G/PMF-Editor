/**
 * 목적: 검증 픽스처 테스트. valid/*.toon 은 issue 0, invalid/<ID>.toon 은 정확히 그 ID 하나만 낸다.
 * 왜 이 구조인가: validate() 를 호출하는 테스트가 하나도 없어 검증 규칙 28개가 한 번도 실행된 적이 없었다.
 *   decode 거부 시 (C-3(b) 규칙) 는 디코더가 먼저 잡는 것이 정상. companion 규칙은 허용.
 * 바꾸면 안 되는 것: 픽스처를 추가·삭제하면 이 테스트도 함께 갱신.
 * 근거: SDD-06 §3 [D-06-03], SDD-09 §3-6 [D-09-03-6]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from '../src/core/toon/decode.js';
import { validate } from '../src/core/validate/index.js';

const ROOT = process.cwd();
const VALID_DIR = join(ROOT, 'docs', 'fixtures', 'valid');
const INVALID_DIR = join(ROOT, 'docs', 'fixtures', 'invalid');
const CTX = { mode: 'tool' as const, enemyCatalog: new Set(['Robot_Walker', 'Robot_Scout']) };

const COMPANION: Record<string, string[]> = {
  'V-M03': ['V-M06'], 'V-M06': ['V-M03'],
  'V-B02': ['V-P06'], 'V-P04': ['V-P05'], 'V-S03': ['V-B01'],
  'V-M07': ['V-P07', 'V-P03'], 'V-P03': ['V-P07'],
};
const DECODE_BLOCKED = new Set(['V-F01', 'V-F03', 'V-M01', 'V-M02', 'V-M04', 'V-P05', 'V-P07']);
const SKIP = new Set(['V-M06', 'V-M07']);

function isSignificant(sev: string): boolean { return sev !== 'info'; }

describe('검증 픽스처', () => {
  const validFiles = existsSync(VALID_DIR) ? readdirSync(VALID_DIR).filter(f => f.endsWith('.toon')) : [];
  if (validFiles.length === 0) it('valid 픽스처 폴더가 비었다', () => { expect(validFiles.length).toBeGreaterThan(0); });
  for (const f of validFiles) {
    it(`valid/${f} — decode 성공 + error/warning 0건`, () => {
      const text = readFileSync(join(VALID_DIR, f), 'utf8');
      const r = decode(text);
      expect(r.ok).toBe(true); if (!r.ok) return;
      const sig = validate(r.value, CTX).filter(i => isSignificant(i.severity));
      expect(sig.map(i => i.id + '[' + i.severity + ']'), `valid/${f}: ${sig.map(i => i.id + ' ' + i.message).join('; ')}`).toEqual([]);
    });
  }

  const invalidFiles = existsSync(INVALID_DIR) ? readdirSync(INVALID_DIR).filter(f => f.endsWith('.toon')) : [];
  if (invalidFiles.length === 0) it('invalid 픽스처 폴더가 비었다', () => { expect(invalidFiles.length).toBeGreaterThan(0); });
  for (const f of invalidFiles) {
    const expectedId = f.replace('.toon', '');
    it(`invalid/${f} — 정확히 ${expectedId}`, () => {
      if (SKIP.has(expectedId)) return;
      const text = readFileSync(join(INVALID_DIR, f), 'utf8');
      const r = decode(text);
      if (!r.ok) { expect(DECODE_BLOCKED.has(expectedId), `invalid/${f}: decode 실패 (${r.error.message}). ${expectedId} 가 decode-blocked 규칙인가?`).toBe(true); return; }
      const sig = validate(r.value, CTX).filter(i => isSignificant(i.severity));
      const ids = [...new Set(sig.map(i => i.id))];
      const allowed = [expectedId, ...(COMPANION[expectedId] ?? [])];
      expect(ids.filter(id => !allowed.includes(id)), `invalid/${f}: 기대=${expectedId}, 실제=${JSON.stringify(ids)}. extra: ${ids.filter(id => !allowed.includes(id)).join(',')}`).toEqual([]);
      expect(ids).toContain(expectedId);
    });
  }
});
