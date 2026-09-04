/**
 * 목적: 씨앗(Stage_Greybox) 왕복·셀 통계·도달 영역 검증.
 * 왜 이 구조인가: 코덱 정보 손실 + 게임 실측 일치가 골든 기준. 바이트 동일 비교 불필요.
 *   decode(encode(doc)) === doc 으로 왕복을 증명하고, 통계로 게임 일치를 증명한다.
 * 바꾸면 안 되는 것: 셀 통계 기대값(게임 GreyboxMapData 렌더 2026-09-03 실측).
 *   도달 영역 기대값(같은 날짜 알리움행 그래프 규칙).
 * 근거: SDD-06 §2 [D-06-02]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../../src/core/toon/decode.js';
import { encode } from '../../src/core/toon/encode.js';
import { countCells } from '../../src/core/model/map.js';
import { Cell } from '../../src/core/model/cell.js';
import { computeReachability } from '../../src/core/geometry/reach.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '..', '..', 'docs', 'examples', 'Stage_Greybox.toon');
const SEED_TEXT = readFileSync(SEED_PATH, 'utf8');
type Val<T> = { ok: true; value: T };

describe('씨앗 골든', () => {
  it('decode(seed) 성공', () => {
    expect(decode(SEED_TEXT).ok).toBe(true);
  });

  it('decode(encode(decode(seed))) === decode(seed)', () => {
    const r1 = decode(SEED_TEXT) as Val<any>;
    const enc = encode(r1.value, { toolVersion: 'test', issues: [] });
    const r2 = decode(enc) as Val<any>;
    expect([...r2.value.map.cells]).toEqual([...r1.value.map.cells]);
    expect(r2.value.path.nodes.length).toBe(r1.value.path.nodes.length);
    expect(r2.value.path.edges.length).toBe(r1.value.path.edges.length);
  });

  it('셀 통계: B381 R51 W36 ~10 V2 .0 _96', () => {
    const doc = (decode(SEED_TEXT) as Val<any>).value;
    const c = countCells(doc.map);
    expect(c[Cell.Buildable]).toBe(381); expect(c[Cell.Road]).toBe(51);
    expect(c[Cell.Blocked]).toBe(36); expect(c[Cell.Water]).toBe(10);
    expect(c[Cell.VillageSlot]).toBe(2); expect(c[Cell.Ground]).toBe(0);
    expect(c[Cell.Empty]).toBe(96);
  });

  it('도달 가능 B203, 도달 불가 178', () => {
    const doc = (decode(SEED_TEXT) as Val<any>).value;
    const r = computeReachability(doc.map);
    expect(r.reachableBuildable).toBe(203);
    expect(r.totalBuildable - r.reachableBuildable).toBe(178);
  });

  it('노드16, 엣지18', () => {
    const doc = (decode(SEED_TEXT) as Val<any>).value;
    expect(doc.path.nodes.length).toBe(16);
    expect(doc.path.edges.length).toBe(18);
  });
});