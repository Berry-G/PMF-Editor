/**
 * 목적: RULE_IDS 집합과 docs/fixtures/invalid/*.toon 파일명 집합의 일치 검사.
 * 왜 이 구조인가: 규칙을 추가·삭제하면 픽스처도 함께 바뀌어야 한다.
 *   이 테스트가 어긋나면 둘 중 하나가 빠졌거나 불필요한 파일이 있는 것이다.
 * 바꾸면 안 되는 것: 픽스처 폴더가 없으면 skip.
 * 근거: SDD-06 §3§4 [D-06-03/04]
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_IDS } from '../../src/core/validate/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INVALID_DIR = join(__dirname, '..', '..', 'docs', 'fixtures', 'invalid');

describe('규칙-픽스처 일치 게이트', () => {
  it('RULE_IDS 와 invalid/*.toon 파일명이 같다', (ctx) => {
    if (!existsSync(INVALID_DIR)) { ctx.skip('픽스처 폴더 없음'); return; }
    const entries = readdirSync(INVALID_DIR).filter(f => f.endsWith('.toon'));
    if (entries.length === 0) { ctx.skip('픽스처 파일 없음'); return; }
    const fileIds = new Set(entries.map(f => f.replace('.toon', '')));
    const ruleIds = new Set(RULE_IDS);
    const missing = [...ruleIds].filter(id => !fileIds.has(id));
    const extra = [...fileIds].filter(id => !ruleIds.has(id));
    const problems: string[] = [];
    if (missing.length > 0) problems.push('픽스처 없음: ' + missing.join(', '));
    if (extra.length > 0) problems.push('규칙 없음: ' + extra.join(', '));
    expect(problems, '규칙과 픽스처가 일치하지 않는다').toEqual([]);
  });
});