/**
 * 목적: 씨앗(Stage_Greybox) 왕복·셀 통계·도달 영역 검증 (SDD-06 §2).
 * 왜 이 구조인가: encode(decode(seed)) === seed (바이트 동일) 가 골든 기준.
 *   주석까지 포함한 바이트 동일이어야 git diff 가 실제 변경만 보여 준다.
 *   추가로 decode(encode(doc)) deepEqual doc 도 검증한다.
 * 바꾸면 안 되는 것: 셀 통계 기대값(게임 GreyboxMapData 렌더 2026-09-03 실측).
 *   도달 영역 기대값. encode(decode(seed)) === seed — 이게 깨지면 인코더가 주석을 재현하지 못한 것이다.
 * 근거: SDD-06 §2 [D-06-02], SDD-09 §2-5 [D-09-02-5]
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
type V = { ok: true; value: any };

describe('씨앗 골든', () => {
  it('decode(seed) 성공', () => {
    expect(decode(SEED_TEXT).ok).toBe(true);
  });

  it('encode(decode(seed)) === seed (바이트 동일)', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const enc = encode(doc, { toolVersion: 'v0.1.0 (golden)', issues: [] });
    expect(enc).toBe(SEED_TEXT);
  });

  it('decode(encode(doc)) deepEqual doc', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const enc = encode(doc, { toolVersion: 'test', issues: [] });
    const doc2 = (decode(enc) as V).value;
    expect([...doc2.map.cells]).toEqual([...doc.map.cells]);
    expect(doc2.path.nodes.length).toBe(doc.path.nodes.length);
    expect(doc2.path.edges.length).toBe(doc.path.edges.length);
  });

  it('셀 통계: B381 R51 W36 ~10 V2 .0 _96', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const c = countCells(doc.map);
    expect(c[Cell.Buildable]).toBe(381); expect(c[Cell.Road]).toBe(51);
    expect(c[Cell.Blocked]).toBe(36); expect(c[Cell.Water]).toBe(10);
    expect(c[Cell.VillageSlot]).toBe(2); expect(c[Cell.Ground]).toBe(0);
    expect(c[Cell.Empty]).toBe(96);
  });

  it('도달 가능 B203, 도달 불가 178', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    const r = computeReachability(doc.map);
    expect(r.reachableBuildable).toBe(203);
    expect(r.totalBuildable - r.reachableBuildable).toBe(178);
  });

  it('노드16, 엣지18', () => {
    const doc = (decode(SEED_TEXT) as V).value;
    expect(doc.path.nodes.length).toBe(16);
    expect(doc.path.edges.length).toBe(18);
  });
});