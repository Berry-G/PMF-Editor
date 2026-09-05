/**
 * 목적: 노드 도구 — 빈 곳 클릭 = 노드 추가, 노드 드래그 = 이동, Delete = 삭제.
 * 왜 이 구조인가: SDD-09 §10. addNode/moveNode/deleteNode 커맨드 사용.
 *   자동 id 는 비어 있는 가장 작은 N%02d (ADR-E06: 기존 노드 재번호 금지).
 * 바꾸면 안 되는 것: Delete = deleteNode. 드래그 = moveNode.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { addNode, moveNode, deleteNode } from '../../../core/commands/nodes.js';
import type { PathNode } from '../../../core/model/stage.js';

export class NodeTool implements Tool {
  readonly id = 'node' as const;
  private dragging = false;
  private dragNodeId: string | null = null;
  private moveStart = { x: 0, y: 0 };

  onDown(p: PointerInfo, ctx: ToolContext): void {
    // 히트 테스트: 클릭한 위치에 노드가 있는가?
    const node = this.hitTestNode(p.cell.x, p.cell.y, ctx);
    if (node) {
      // 노드 선택 + 드래그 준비
      this.dragging = true;
      this.dragNodeId = node.id;
      this.moveStart = p.cell;
      ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids: [node.id] } }));
    } else {
      // 빈 곳: 노드 추가
      this.dragNodeId = null;
      const id = this.nextNodeId(ctx);
      ctx.store.state.history.beginStroke();
      const cmd = addNode({ id, x: p.cell.x, y: p.cell.y, role: 'waypoint' });
      ctx.store.dispatch(cmd);
      ctx.store.state.history.endStroke();
      ctx.store.update((_s) => ({ selection: { kind: 'nodes', ids: [id] } }));
    }
  }

  onMove(_p: PointerInfo, _ctx: ToolContext): void {
    // 드래그 중 실시간 이동 없음 — onUp 에서 한 번에 moveNode
  }

  onUp(p: PointerInfo, ctx: ToolContext): void {
    if (this.dragging && this.dragNodeId && (p.cell.x !== this.moveStart.x || p.cell.y !== this.moveStart.y)) {
      // 드래그 끝에서 한 번만 moveNode
      ctx.store.state.history.beginStroke();
      const cmd = moveNode(this.dragNodeId, { x: p.cell.x, y: p.cell.y });
      ctx.store.dispatch(cmd);
      ctx.store.state.history.endStroke();
    }
    this.dragging = false;
    this.dragNodeId = null;
  }

  onCancel(_ctx: ToolContext): void {
    this.dragging = false;
    this.dragNodeId = null;
  }

  /** Delete: 선택한 노드 삭제 */
  deleteSelected(ctx: ToolContext): void {
    const sel = ctx.store.state.selection;
    if (sel.kind !== 'nodes' || sel.ids.length === 0) return;
    ctx.store.state.history.beginStroke();
    for (const id of sel.ids) {
      const cmd = deleteNode(ctx.store.state.history.doc, id);
      ctx.store.dispatch(cmd);
    }
    ctx.store.state.history.endStroke();
    ctx.store.update((_s) => ({ selection: { kind: 'none' as const } }));
  }

  /** (x,y) 근처 10px 이내 노드를 찾는다. 없으면 null. */
  private hitTestNode(x: number, y: number, ctx: ToolContext): PathNode | null {
    const nodes = ctx.store.state.history.doc.path.nodes;
    const S = 32; // CELL_PX constant
    const threshold = 10; // px
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

  /** 비어 있는 가장 작은 N%02d 를 찾는다. */
  private nextNodeId(ctx: ToolContext): string {
    const existing = new Set(ctx.store.state.history.doc.path.nodes.map(n => n.id));
    // N00~N99 에서 비어 있는 가장 작은 번호
    for (let i = 0; i < 100; i++) {
      const id = 'N' + String(i).padStart(2, '0');
      if (!existing.has(id)) return id;
    }
    return 'N' + Date.now(); // 100개 넘으면 타임스탬프
  }
}