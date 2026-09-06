/**
 * 목적: 오브젝트 도구 — 히트 테스트 (노드 10px → 엣지 6px → 마을 셀) + Ctrl 다중 선택.
 * 왜 이 구조인가: SDD-09 §10. 편집할 대상을 고르는 유일한 선택 도구.
 * 바꾸면 안 되는 것: 히트 테스트 순서. Ctrl = add to selection.
 * 근거: SDD-03 §3 [D-03-03], SDD-09 §10 [D-09-10]
 */
import type { Tool, PointerInfo, ToolContext } from './tool.js';
import { hitTestNode, hitTestEdge } from '../hittest.js';

import { cellAt } from '../../../core/model/map.js';
import { Cell } from '../../../core/model/cell.js';

export class ObjectTool implements Tool {
  readonly id = 'object' as const;

  onDown(p: PointerInfo, ctx: ToolContext): void {
    const map = ctx.store.state.history.doc.map;
    const nodes = ctx.store.state.history.doc.path.nodes;
    const edges = ctx.store.state.history.doc.path.edges;

    // 1. 노드 히트 (10px)
    const node = hitTestNode(p.cell.x, p.cell.y, nodes);
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
    const edgeIndex = hitTestEdge(p.cell.x, p.cell.y, nodes, edges);
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

}