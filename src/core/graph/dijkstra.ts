/**
 * 목적: 배열 스캔 다익스트라 (O(n²)). 노드 수십 개라 충분하다.
 * 왜 이 구조인가: 힙(priority queue)은 동률 순서가 구현마다 달라져 결정론이 깨진다.
 *   배열 스캔은 동률 시 낮은 index 를 먼저 선택하므로 결과가 항상 같다.
 *   부동소수 비교에 1e-9 여유를 둔다 — 같은 값은 "먼저 온 것" 으로 고정된다.
 * 바꾸면 안 되는 것: 동률 처리 규칙(낮은 index 우선). 1e-9 여유를 없애면 부동소수 오차로 순서가 흔들린다.
 * 근거: SDD-09 §5-2 [D-09-05-2], SDD-08 §5 [D-08-05]
 */
import type { Graph } from './build.js';

/** 다익스트라. 도달 불가 = dist Infinity / prev -1. */
export function dijkstra(g: Graph, from: number, agent: number): { dist: Float64Array; prev: Int32Array } {
  const n = g.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] === 0 && dist[i]! < Infinity && (u === -1 || dist[i]! < dist[u]! - 1e-9)) {
        u = i;
      }
    }
    if (u === -1) break;
    done[u] = 1;

    for (const e of g.out[u]!) {
      if ((e.allowed & agent) === 0) continue;
      const nd = dist[u]! + e.cost;
      if (nd < dist[e.to]! - 1e-9) {
        dist[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }

  return { dist, prev };
}

/** `from` 에서 `to` 까지의 경로 (노드 index 열). 없으면 null. */
export function shortestPath(g: Graph, from: number, to: number, agent: number): number[] | null {
  const { dist, prev } = dijkstra(g, from, agent);
  if (dist[to] === Infinity) return null;
  const path: number[] = [];
  let c: number = to;
  while (c !== -1) { path.push(c); c = prev[c]!; }
  path.reverse();
  return path;
}