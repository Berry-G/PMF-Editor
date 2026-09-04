/**
 * 목적: 주어진 위치에서 특정 에이전트가 사용 가능한 가장 가까운 노드를 찾는다.
 * 왜 이 구조인가: 게임 `PathGraph.FindNearestNode` 의 단순화 버전.
 *   "사용 가능" = agent 가 통과할 수 있는 엣지가 하나라도 연결된 노드.
 *   ⚠️ 게임의 정확한 필터 규칙은 M4 에서 대조한다 (SDD-09 §5-3).
 * 바꾸면 안 되는 것: 동률 처리 — `dist < bestD - 1e-9`.
 * 근거: SDD-09 §5-3 [D-09-05-3], SDD-08 §5 [D-08-05]
 */
import type { Graph } from './build.js';
import { dist, xy } from '../geometry/xy.js';

export function nearestNode(g: Graph, pos: { x: number; y: number }, agent: number): number | null {
  let best = -1;
  let bestD = Infinity;
  for (const node of g.nodes) {
    // agent 가 이 노드를 드나들 수 있는 엣지가 하나라도 있는가
    const usable = g.out[node.index]!.some(e => (e.allowed & agent) !== 0)
      || g.nodes.some((_, i) => g.out[i]!.some(e => e.to === node.index && (e.allowed & agent) !== 0));
    if (!usable) continue;
    const d = dist(xy(node.x, node.y), xy(pos.x, pos.y));
    if (d < bestD - 1e-9) { best = node.index; bestD = d; }
  }
  return best === -1 ? null : best;
}