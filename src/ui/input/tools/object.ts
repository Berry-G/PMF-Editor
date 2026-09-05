/**
 * 목적: 오브젝트 도구 — 히트 테스트 (노드 10px → 엣지 6px → 마을 셀) + Ctrl 다중 선택.
 * 왜 이 구조인가: SDD-09 §10. 편집할 대상을 고르는 유일한 선택 도구.
 * 바꾸면 안 되는 것: 히트 테스트 순서. Ctrl = add to selection.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import type { PathNode, PathEdge } from '../../../core/model/stage.js';
import { cellAt } from '../../../core/model/map.js';
import { Cell } from '../../../core/model/cell.js';

export class ObjectTool implements Tool {
  readonly id = 'object' as const;

  onDown(p: PointerInfo, ctx: ToolContext): void {
    const map = ctx.store.state.history.doc.map;
    const nodes = ctx.store.state.history.doc.path.nodes;
    const edges = ctx.store.state.history.doc.path.edges;

    // 1. 노드 히트 (10px)
    const node = this.hitTestNode(p.cell.x, p.cell.y, nodes);
    if (node) {
      if (p.ctrl) {
        const cur = ctx.store.state.selection;
        if (cur.kind === 'nodes') {
          const ids = cur.ids.includes(node.id) ? cur.ids.filter(id => id !== node.id) : [...cur.ids, node.id];
          ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids } }));
        } else {
          ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids: [node.id] } }));
        }
      } else {
        ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids: [node.id] } }));
      }
      return;
    }

    // 2. 엣지 히트 (선분 거리 6px)
    const edgeIndex = this.hitTestEdge(p.cell.x, p.cell.y, nodes, edges);
    if (edgeIndex !== -1) {
      ctx.store.update((_s) => ({ selection: { kind: 'edge', index: edgeIndex } }));
      return;
    }

    // 3. 마을 셀
    const c = cellAt(map, p.cell.x, p.cell.y);
    if (c === Cell.VillageSlot) {
      ctx.store.update((_s) => ({ selection: { kind: 'village', x: p.cell.x, y: p.cell.y } }));
      return;
    }

    // 4. 없음
    ctx.store.update((_s) => ({ selection: { kind: 'none' as const } }));
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void { /* nothing */ }
  onUp(_p: PointerInfo, _ctx: ToolContext): void { /* nothing */ }
  onCancel(_ctx: ToolContext): void { /* nothing */ }

  private hitTestNode(x: number, y: number, nodes: PathNode[]): PathNode | null {
    const S = 32;
    const threshold = 10;
    let best: PathNode | null = null;
    let bestDist = Infinity;
    for (const n of nodes) {
      const dx = Math.abs(n.x - x) * S, dy = Math.abs(n.y - y) * S;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < bestDist) { bestDist = dist; best = n; }
    }
    return best;
  }

  private hitTestEdge(x: number, y: number, nodes: PathNode[], edges: PathEdge[]): number {
    const S = 32;
    const threshold = 6; // px
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei]!;
      const from = nodes.find(n => n.id === e.from);
      const to = nodes.find(n => n.id === e.to);
      if (!from || !to) continue;
      const d = this.distToSegment(x * S, y * S, from.x * S, from.y * S, to.x * S, to.y * S);
      if (d < threshold) return ei;
    }
    return -1;
  }

  /** 점 (px,py) 에서 선분 (ax,ay)-(bx,by) 까지의 거리 */
  private distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  }
}