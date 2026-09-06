/**
 * 목적: 캔버스 좌표에서 노드·엣지를 집는 히트 테스트. 도구와 컨텍스트 메뉴가 함께 쓴다.
 * 왜 이 구조인가: 같은 계산이 EdgeTool·ObjectTool·컨텍스트 메뉴 세 곳에 흩어져 있었다.
 *   임계값이 한 곳만 바뀌면 "클릭은 되는데 우클릭은 안 되는" 식으로 조용히 어긋난다.
 * 바꾸면 안 되는 것: **소수 좌표를 넘겨라.** 정수 셀 좌표로 부르면 임계값 6px 이 0.19칸이 되어
 *   엣지를 사실상 못 맞춘다 — 2026-09-06 까지 실제로 그랬다 ("엣지 선택이 너무 어렵다").
 *   `pointerXY()` 를 써라. 노드가 엣지보다 **먼저** 잡혀야 한다 —
 *   노드는 항상 엣지 위에 있어서, 엣지가 이기면 노드를 영영 못 고른다.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { PathNode, PathEdge } from '../../core/model/stage.js';

/** 셀 한 칸의 픽셀 크기 (렌더러 CELL 과 같다). */
const S = 32;
const NODE_THRESHOLD = 10;
const EDGE_THRESHOLD = 9;

/**
 * PointerInfo 의 정수 셀 + 셀 안 소수를 **절대 소수 셀 좌표** 로 합친다.
 * 왜: `fy` 는 화면 기준(아래로 증가)이라 맵 좌표(위로 증가)로 뒤집어야 한다.
 *   이걸 안 하면 커서가 셀 아래쪽에 있을 때 위쪽으로 판정된다.
 */
export function pointerXY(cell: { x: number; y: number }, fx: number, fy: number): { px: number; py: number } {
  return { px: cell.x + fx, py: cell.y + (1 - fy) };
}

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
    // 왜 +0.5 인가: 노드는 셀의 **중심**에 그려지는데(renderer 의 `x*CELL + CELL/2`),
    //   포인터 좌표는 셀 모서리 기준 소수다. 안 맞추면 항상 반 칸(16px) 어긋나 못 집는다.
    const dx = (n.x + 0.5 - x) * S, dy = (n.y + 0.5 - y) * S;
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
    // 엣지도 노드 중심끼리 잇는 선분이다 — 같은 이유로 +0.5.
    if (distToSegment(x * S, y * S, (from.x + 0.5) * S, (from.y + 0.5) * S, (to.x + 0.5) * S, (to.y + 0.5) * S) < EDGE_THRESHOLD) return ei;
  }
  return -1;
}
