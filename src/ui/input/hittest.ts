/**
 * 목적: 캔버스 좌표에서 노드·엣지를 집는 히트 테스트. 도구와 컨텍스트 메뉴가 함께 쓴다.
 * 왜 이 구조인가: 같은 계산이 EdgeTool·ObjectTool·컨텍스트 메뉴 세 곳에 흩어져 있었다.
 *   임계값이 한 곳만 바뀌면 "클릭은 되는데 우클릭은 안 되는" 식으로 조용히 어긋난다.
 * 바꾸면 안 되는 것: 셀 크기 32 와 임계값. 노드가 엣지보다 **먼저** 잡혀야 한다 —
 *   노드는 항상 엣지 위에 있어서, 엣지가 이기면 노드를 영영 못 고른다.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { PathNode, PathEdge } from '../../core/model/stage.js';

/** 셀 한 칸의 픽셀 크기 (렌더러 CELL 과 같다). */
const S = 32;
const NODE_THRESHOLD = 10;
const EDGE_THRESHOLD = 6;

/** 점 (px,py) 에서 선분 (ax,ay)-(bx,by) 까지의 거리. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

/** 셀 좌표 (x,y) 근처의 노드. 없으면 null. 동률이면 더 가까운 쪽. */
export function hitTestNode(x: number, y: number, nodes: readonly PathNode[]): PathNode | null {
  let best: PathNode | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const dx = (n.x - x) * S, dy = (n.y - y) * S;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < NODE_THRESHOLD && dist < bestDist) { bestDist = dist; best = n; }
  }
  return best;
}

/** 셀 좌표 (x,y) 근처의 엣지 index. 없으면 -1. 먼저 만나는 것을 준다(그리는 순서와 같다). */
export function hitTestEdge(x: number, y: number, nodes: readonly PathNode[], edges: readonly PathEdge[]): number {
  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei]!;
    const from = nodes.find(n => n.id === e.from);
    const to = nodes.find(n => n.id === e.to);
    if (!from || !to) continue;
    if (distToSegment(x * S, y * S, from.x * S, from.y * S, to.x * S, to.y * S) < EDGE_THRESHOLD) return ei;
  }
  return -1;
}
