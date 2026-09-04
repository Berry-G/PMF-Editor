/**
 * 목적: 기하 함수 단위 테스트. SDD-09 §4 검증.
 * 왜 이 구조인가: brushCells 1·3·5(경계), lineCells(대각·역방향), rectCells(채움·테두리),
 *   floodFill(재귀 아님), computeReachability(씨앗 기준)를 검증한다.
 * 바꾸면 안 되는 것: brushCells 순서, floodFill 4-연결.
 * 근거: SDD-09 §4 [D-09-04]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brushCells, lineCells, rectCells } from './shapes.js';
import { floodFill } from './flood.js';
import { computeReachability } from './reach.js';
import { createMap } from '../model/map.js';
import { Cell } from '../model/cell.js';
import { decode } from '../toon/decode.js';

const m = createMap(8, 8, Cell.Buildable);

describe('brushCells', () => {
  it('size 1', () => { const r = brushCells(m, 4, 4, 1); expect(r.length).toBe(1); expect(r[0]?.x).toBe(4); });
  it('size 3', () => { const r = brushCells(m, 4, 4, 3); expect(r.length).toBe(9); });
  it('size 5', () => { const r = brushCells(m, 4, 4, 5); expect(r.length).toBe(25); });
  it('맵 경계 좌상단', () => { const r = brushCells(m, 0, 0, 1); expect(r[0]?.x).toBe(0); });
  it('맵 경계 모서리 3', () => { const r = brushCells(m, 0, 0, 3); expect(r.length).toBe(4); });
});

describe('lineCells', () => {
  it('수평', () => { const r = lineCells(m, 0, 0, 5, 0); expect(r.length).toBe(6); });
  it('수직', () => { const r = lineCells(m, 0, 0, 0, 5); expect(r.length).toBe(6); });
  it('대각', () => { const r = lineCells(m, 0, 0, 5, 5); expect(r.length).toBe(6); });
  it('역방향', () => { const r = lineCells(m, 5, 5, 0, 0); expect(r.length).toBe(6); });
  it('양 끝 포함', () => { const r = lineCells(m, 0, 0, 0, 0); expect(r.length).toBe(1); });
});

describe('rectCells', () => {
  it('채움', () => { const r = rectCells(m, 0, 0, 2, 2, false); expect(r.length).toBe(9); });
  it('테두리', () => { const r = rectCells(m, 0, 0, 2, 2, true); expect(r.length).toBe(8); });
});

describe('floodFill', () => {
  it('4-연결 시작 칸 포함', () => { const r = floodFill(m, 4, 4, c => c === Cell.Buildable); expect(r.length).toBe(64); });
  it('같은 칸 없으면 빈 배열', () => { const r = floodFill(m, 4, 4, c => c === Cell.Water); expect(r).toEqual([]); });
  it('재귀 아님 256x256', () => { const big = createMap(256, 256, Cell.Buildable); const r = floodFill(big, 128, 128, c => c === Cell.Buildable); expect(r.length).toBe(65536); });
});

describe('computeReachability', () => {
  it('씨앗: 도달 B203 불가 178', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const seed = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'examples', 'Stage_Greybox.toon'), 'utf8');
    const r = decode(seed);
    if (!r.ok) { expect(r.ok).toBe(true); return; }
    const reach = computeReachability(r.value.map);
    expect(reach.reachableBuildable).toBe(203);
    expect(reach.totalBuildable - reach.reachableBuildable).toBe(178);
  });
});