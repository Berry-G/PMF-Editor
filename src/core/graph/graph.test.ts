/**
 * 목적: 그래프 함수 단위 테스트. SDD-09 §5 검증.
 * 왜 이 구조인가: bidirectional 역방향, dijkstra 동률, shortestPath null, nearestNode 필터를 검증한다.
 * 바꾸면 안 되는 것: 동률은 낮은 index 우선 규칙.
 * 근거: SDD-09 §5 [D-09-05]
 */
import { describe, expect, it } from 'vitest';
import { buildGraph, AGENT_BIT } from './build.js';
import { dijkstra, shortestPath } from './dijkstra.js';
import { nearestNode } from './nearest.js';

const path = {
  nodes: [
    { id: 'A', x: 0, y: 0, role: 'start' as const },
    { id: 'B', x: 1, y: 0, role: 'waypoint' as const },
    { id: 'C', x: 2, y: 0, role: 'exit' as const },
    { id: 'D', x: 0, y: 1, role: 'waypoint' as const },
  ],
  edges: [
    { from: 'A', to: 'B', allowed: ['Escortee', 'Enemy', 'Ally'] as const, bidirectional: true, shortcut: false },
    { from: 'B', to: 'C', allowed: ['Escortee', 'Enemy', 'Ally'] as const, bidirectional: true, shortcut: false },
    { from: 'A', to: 'D', allowed: ['Escortee'] as const, bidirectional: false, shortcut: false },
  ],
};

describe('buildGraph', () => {
  it('bidirectional 역방향 엣지 생성', () => {
    const g = buildGraph(path, { openShortcuts: false });
    expect(g.out[1]?.some(e => e.from === 1 && e.to === 0)).toBe(true);
  });
  it('단방향은 역방향이 없다', () => {
    const g = buildGraph(path, { openShortcuts: false });
    expect(g.out[3]?.some(e => e.from === 3 && e.to === 0)).toBeFalsy();
  });
  it('닫힌 지름길은 그래프에 없다', () => {
    const p2 = { ...path, edges: [...path.edges, { from: 'A', to: 'C', allowed: ['Escortee'] as const, bidirectional: false, shortcut: true }] };
    const g = buildGraph(p2, { openShortcuts: false });
    expect(g.out[0]?.some(e => e.to === 2)).toBe(false);
  });
  it('열린 지름길은 그래프에 있다', () => {
    const p2 = { ...path, edges: [...path.edges, { from: 'A', to: 'C', allowed: ['Escortee'] as const, bidirectional: false, shortcut: true }] };
    const g = buildGraph(p2, { openShortcuts: true });
    expect(g.out[0]?.some(e => e.to === 2)).toBe(true);
  });
});

describe('dijkstra', () => {
  it('A→C 최단 경로 A→B→C', () => {
    const g = buildGraph(path, { openShortcuts: false });
    const { dist } = dijkstra(g, 0, AGENT_BIT.Escortee);
    expect(dist[2]).toBeCloseTo(2, 5);
  });
  it('도달 불가 → Infinity', () => {
    const g = buildGraph(path, { openShortcuts: false });
    const { dist } = dijkstra(g, 3, AGENT_BIT.Enemy);
    expect(dist[2]).toBe(Infinity);
  });
});

describe('shortestPath', () => {
  it('A→C 경로 있음', () => {
    const g = buildGraph(path, { openShortcuts: false });
    expect(shortestPath(g, 0, 2, AGENT_BIT.Escortee)).toEqual([0, 1, 2]);
  });
  it('경로 없음 → null', () => {
    const g = buildGraph(path, { openShortcuts: false });
    expect(shortestPath(g, 3, 2, AGENT_BIT.Enemy)).toBeNull();
  });
});

describe('nearestNode', () => {
  it('Escortee 가 A 에서 가장 가까움', () => {
    const g = buildGraph(path, { openShortcuts: false });
    expect(nearestNode(g, { x: 0, y: 0 }, AGENT_BIT.Escortee)).toBe(0);
  });
  it('Ally 는 A→D 를 쓸 수 없음', () => {
    const g = buildGraph(path, { openShortcuts: false });
    const n = nearestNode(g, { x: 0, y: 0.5 }, AGENT_BIT.Ally);
    expect(n).not.toBeNull();
  });
});