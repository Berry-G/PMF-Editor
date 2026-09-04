/**
 * 목적: 시뮬레이션 회귀 테스트. 씨앗으로 시뮬 돌려 뼈대 값 검증.
 * 왜 이 구조인가: 시뮬은 결정론적이어야 하고, 씨앗 기준값(판 길이·스폰·수입)과 맞아야 한다.
 *   SDD-04 §6 의 게임 실측과 완전히 같지는 않다 (가정 A1/A2 로 인한 차이) — M4 에서 대조 후 조정.
 * 바꾸면 안 되는 것: 결정론 검증(같은 입력 → 같은 결과).
 * 근거: SDD-04 §6 [D-04-06], SDD-06 §2 [D-06-02]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../../src/core/toon/decode.js';
import { simulate } from '../../src/core/sim/simulate.js';
import { DEFAULT_CATALOG } from '../../src/core/sim/params.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '..', '..', 'docs', 'examples', 'Stage_Greybox.toon');
const SEED_TEXT = readFileSync(SEED_PATH, 'utf8');
type V = { ok: true; value: any };

describe('시뮬 회귀', () => {
  it('파싱 성공', () => { expect(decode(SEED_TEXT).ok).toBe(true); });

  it('판 길이 100~130초, 스폰 50~60기, 수입 350~450', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const r = simulate(doc, { seed: 1, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 }, DEFAULT_CATALOG);
    expect(r.stageSeconds).toBeGreaterThanOrEqual(100);
    expect(r.stageSeconds).toBeLessThanOrEqual(130);
    expect(r.totalSpawned).toBeGreaterThanOrEqual(50);
    expect(r.totalSpawned).toBeLessThanOrEqual(60);
    expect(r.incomeCeiling.Normal).toBeGreaterThanOrEqual(350);
    expect(r.incomeCeiling.Normal).toBeLessThanOrEqual(450);
  });

  it('지름길 개방 시 판 길이 감소', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const closed = simulate(doc, { seed: 1, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 }, DEFAULT_CATALOG);
    const opened = simulate(doc, { seed: 1, dt: 1 / 30, shortcutOpenAt: 30, maxSeconds: 600 }, DEFAULT_CATALOG);
    expect(opened.stageSeconds).toBeLessThan(closed.stageSeconds);
  });

  it('결정론: 같은 입력 → 같은 결과', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const a = simulate(doc, { seed: 42, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 }, DEFAULT_CATALOG);
    const b = simulate(doc, { seed: 42, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 }, DEFAULT_CATALOG);
    expect(a.stageSeconds).toBe(b.stageSeconds);
    expect(a.totalSpawned).toBe(b.totalSpawned);
  });
});