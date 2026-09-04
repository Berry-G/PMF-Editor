/**
 * 목적: 시뮬레이션 회귀 테스트 (SDD-04 §6, SDD-09 §7-8).
 * 왜 이 구조인가: 씨앗 기준값(119±3%, 56±2, 402±10)은 게임 실측(2026-09-02)이다.
 *   enterBurst·묶음 종료 규칙을 게임 코드로 맞춘 뒤에도 실측이 어긋나면
 *   경로 재계산 또는 nearestNode 필터가 원인 후보다. 범위를 넓혀 통과시키지 마라.
 * 바꾸면 안 되는 것: 기대값(119초, 56기, 402 수입 천장).
 *   회귀가 어긋나면 가정을 좁히거나 SDD 를 고친다. 기대값을 슬쩍 넓히지 마라.
 * 근거: SDD-04 §6 [D-04-06], SDD-09 §7-8 [D-09-07-8]
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

  // 왜: SDD-04 §6 기준 — 게임 실측 2026-09-02 (119초, 56기, 402).
  //   현재 이 테스트는 실패할 수 있다 (enterBurst·묶음 종료를 게임 코드로 맞춰도
  //   경로 재계산·nearestNode 차이가 남아 있다). 기대값을 넓히지 마라.
  it('판 길이 119±3% (115.4~122.6), 스폰 56±2 (54~58), 수입 402±10 (392~412)', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const r = simulate(doc, { seed: 1, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 }, DEFAULT_CATALOG);
    expect(r.stageSeconds).toBeGreaterThanOrEqual(115.4);
    expect(r.stageSeconds).toBeLessThanOrEqual(122.6);
    expect(r.totalSpawned).toBeGreaterThanOrEqual(54);
    expect(r.totalSpawned).toBeLessThanOrEqual(58);
    expect(r.incomeCeiling.Normal).toBeGreaterThanOrEqual(392);
    expect(r.incomeCeiling.Normal).toBeLessThanOrEqual(412);
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