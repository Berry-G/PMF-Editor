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
import { buildPathFromRoad } from './roadpath.js';
import { cellAt } from '../model/map.js';

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
describe('buildPathFromRoad (도로에서 경로 초안)', () => {
  const __d = dirname(fileURLToPath(import.meta.url));
  const decoded = decode(readFileSync(join(__d, '..', '..', '..', 'docs', 'examples', 'Stage_Greybox.toon'), 'utf8'));
  if (!decoded.ok) throw new Error('씨앗 decode 실패');
  const SEED = decoded.value;

  // 씨앗으로 돈다 — 실제 맵에서 코너가 몇 개 나오는지가 이 함수의 값어치다.
  it('씨앗: 시작(1,9)→탈출(30,6) 이 이어지고 코너마다 노드가 선다', () => {
    const r = buildPathFromRoad(SEED.map, { x: 1, y: 9 }, { x: 30, y: 6 });
    expect(r.ok, r.reason).toBe(true);
    expect(r.nodes[0]!.role).toBe('start');
    expect(r.nodes[r.nodes.length - 1]!.role).toBe('exit');
    expect(r.nodes.length).toBeGreaterThan(2);
    expect(r.edges.length).toBe(r.nodes.length - 1);
  });

  it('만든 엣지는 전부 축 정렬이고 사이가 모두 도로다 (V-P03 을 스스로 만족한다)', () => {
    const r = buildPathFromRoad(SEED.map, { x: 1, y: 9 }, { x: 30, y: 6 });
    expect(r.ok).toBe(true);
    const byId = new Map(r.nodes.map(n => [n.id, n]));
    for (const e of r.edges) {
      const a = byId.get(e.from)!, b = byId.get(e.to)!;
      expect(a.x === b.x || a.y === b.y, `${e.from}→${e.to} 가 대각선`).toBe(true);
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      for (let x = a.x, y = a.y; ; x += dx, y += dy) {
        expect(cellAt(SEED.map, x, y), `(${x},${y}) 가 도로가 아니다`).toBe(Cell.Road);
        if (x === b.x && y === b.y) break;
      }
    }
  });

  it('지름길·분기는 만들지 않는다 — 도로만 봐서는 알 수 없다', () => {
    const r = buildPathFromRoad(SEED.map, { x: 1, y: 9 }, { x: 30, y: 6 });
    expect(r.edges.some(e => e.shortcut)).toBe(false);
    expect(r.nodes.some(n => n.role === 'branch')).toBe(false);
  });

  it('도로가 아닌 칸을 주면 거절하고 이유를 말한다', () => {
    const r = buildPathFromRoad(SEED.map, { x: 0, y: 0 }, { x: 30, y: 6 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('도로');
  });

  it('이어져 있지 않으면 거절한다', () => {
    const r = buildPathFromRoad(SEED.map, { x: 1, y: 9 }, { x: 1, y: 9 });
    expect(r.ok).toBe(false);
  });
});
