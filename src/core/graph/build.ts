/**
 * 목적: 경로 데이터 → 내비게이션 그래프. 엣지 비용은 유클리드 거리(셀 중심 기준).
 * 왜 이 구조인가: 게임 `PathGraph` 와 같은 구조다. bidirectional 은 역방향 엣지를 그래프에 하나 더 만든다
 *   (파일에는 한 번만 적는다 — V-P08 검증). 지름길은 `openShortcuts` 옵션으로 끄거나 켠다.
 * 바꾸면 안 되는 것: `cost = hypot(dx,dy)` — 게임 `PathEdge.cs:28` `Vector3.Distance` 와 같다.
 *   노드 index = 파일 순서 (정렬하지 않는다 — 게임 씬 계층 순서와 같다).
 * 근거: SDD-09 §5 [D-09-05], SDD-08 §5 [D-08-05]
 */
import type { PathData, NodeRole, Agent } from '../model/stage.js';
import { dist, xy } from '../geometry/xy.js';

export interface GraphNode {
  id: string; index: number; x: number; y: number; role: NodeRole;
}

export interface GraphEdge {
  from: number; to: number; cost: number;
  allowed: number;        // 비트: Escortee=1, Enemy=2, Ally=4
  shortcut: boolean;
  sourceIndex: number;    // path.edges[] 인덱스
}

export interface Graph {
  nodes: GraphNode[];
  out: GraphEdge[][];
  byId: Map<string, number>;
}

export const AGENT_BIT: Readonly<Record<Agent, number>> = {
  Escortee: 1, Enemy: 2, Ally: 4,
};

function bitsFromAllowed(allowed: ReadonlyArray<string>): number {
  let bits = 0;
  for (const a of allowed) {
    bits |= AGENT_BIT[a as Agent] ?? 0;
  }
  return bits;
}

export function buildGraph(path: PathData, opts: { openShortcuts: boolean }): Graph {
  const nodes: GraphNode[] = path.nodes.map((n, i) => ({
    id: n.id, index: i, x: n.x, y: n.y, role: n.role,
  }));
  const byId = new Map<string, number>(nodes.map((n) => [n.id, n.index]));
  const out: GraphEdge[][] = nodes.map(() => []);

  for (let si = 0; si < path.edges.length; si++) {
    const e = path.edges[si]!;
    const f = byId.get(e.from); if (f === undefined) throw new Error(`노드 없음: ${e.from}`);
    const t = byId.get(e.to); if (t === undefined) throw new Error(`노드 없음: ${e.to}`);
    if (e.shortcut && !opts.openShortcuts) continue;

    const cost = dist(xy(nodes[f]!.x, nodes[f]!.y), xy(nodes[t]!.x, nodes[t]!.y));
    const bits = e.allowed.length === 3 ? 7 : bitsFromAllowed(e.allowed as readonly string[]);

    out[f]!.push({ from: f, to: t, cost, allowed: bits, shortcut: e.shortcut, sourceIndex: si });
    if (e.bidirectional) {
      out[t]!.push({ from: t, to: f, cost, allowed: bits, shortcut: e.shortcut, sourceIndex: si });
    }
  }

  return { nodes, out, byId };
}