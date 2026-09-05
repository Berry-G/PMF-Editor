/**
 * 목적: 엣지 도구 — 노드→노드 클릭 = 엣지 추가. Shift = 지름길.
 * 왜 이 구조인가: SDD-09 §10. addEdge/setEdgeProps/deleteEdge 커맨드 사용.
 * 바꾸면 안 되는 것: Shift = shortcut. delete = Delete 키.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { addEdge, deleteEdge } from '../../../core/commands/edges.js';
import type { PathNode } from '../../../core/model/stage.js';

export class EdgeTool implements Tool {
  readonly id = 'edge' as const;
  private firstNode: PathNode | null = null;

  onDown(p: PointerInfo, ctx: ToolContext): void {
    // 히트 테스트
    const nodes = ctx.store.state.history.doc.path.nodes;
    const node = this.hitTestNode(p.cell.x, p.cell.y, nodes);
    if (!node) {
      // 빈 곳: 선택 해제
      this.firstNode = null;
      ctx.store.update((_s) => ({ selection: { kind: 'none' as const } }));
      return;
    }

    if (this.firstNode === null) {
      // 첫 번째 노드 선택
      this.firstNode = node;
      ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids: [node.id] } }));
    } else {
      // 두 번째 노드 클릭 = 엣지 추가
      if (this.firstNode.id !== node.id) {
        const shortcut = p.shift;
        const edge = { from: this.firstNode.id, to: node.id, allowed: shortcut ? ['Escortee'] as const : ['Escortee', 'Enemy', 'Ally'] as const, bidirectional: true, shortcut };
        ctx.store.state.history.beginStroke();
        const cmd = addEdge(edge);
        ctx.store.dispatch(cmd);
        ctx.store.state.history.endStroke();
        ctx.store.update((_s) => ({ selection: { kind: 'edge', index: ctx.store.state.history.doc.path.edges.length - 1 } }));
      }
      this.firstNode = null;
    }
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void { /* 프리뷰: 첫 노드→휘발 선 (추후 구현) */ }
  onUp(_p: PointerInfo, _ctx: ToolContext): void { /* 단일 클릭 — onDown 에서 처리 */ }
  onCancel(_ctx: ToolContext): void { this.firstNode = null; }

  /** Delete: 선택한 엣지 삭제 */
  deleteSelected(ctx: ToolContext): void {
    const sel = ctx.store.state.selection;
    if (sel.kind !== 'edge') return;
    ctx.store.state.history.beginStroke();
    const cmd = deleteEdge(sel.index);
    ctx.store.dispatch(cmd);
    ctx.store.state.history.endStroke();
    ctx.store.update((_s) => ({ selection: { kind: 'none' as const } }));
  }

  private hitTestNode(x: number, y: number, nodes: PathNode[]): PathNode | null {
    const S = 32;
    const threshold = 10;
    let best: PathNode | null = null;
    let bestDist = Infinity;
    for (const n of nodes) {
      const dx = (n.x - x) * S, dy = (n.y - y) * S;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    return best;
  }
}