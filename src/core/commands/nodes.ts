/**
 * 목적: 노드 편집 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: deleteNode 의 revert 는 제거된 엣지를 원래 인덱스 순서(오름차순)로 복원한다.
 *   splice 가 인덱스를 밀지 않도록 내림차순이 아닌, 정렬 후 순서대로 빈 배열에 채워 넣는다.
 *   renameNode 는 엣지·트리거 참조를 함께 갱신 (ADR-E06).
 *   setNodeRole 은 start 로 바꾸면 기존 start 를 waypoint 로 강등한다.
 *   revert 는 **apply 전에 바뀐 노드 전부를 캡처**해서 통째로 복원한다 — 조건으로 유추하지 않는다
 *   (setNodeRole 'start' 강등 시 undo 가 waypoint 로 내려간 채 돌아오지 않던 버그가 원인).
 * 바꾸면 안 되는 것: deleteNode revert 의 엣지 순서 유지. setNodeRole revert 의 apply 전 스냅샷 복원.
 * 근거: SDD-09 §8, SDD-08 §7, ADR-E06
 */
import type { Command } from './command.js';
import type { StageDocument, PathNode, XY } from '../model/stage.js';

export function addNode(node: PathNode): Command {
  return { label: '노드 추가 ' + node.id, apply(d: StageDocument) { return { ...d, path: { ...d.path, nodes: [...d.path.nodes, node] } }; }, revert(d: StageDocument) { return { ...d, path: { ...d.path, nodes: d.path.nodes.filter(n => n.id !== node.id) } }; } };
}

export function moveNode(id: string, to: XY): Command { let prev: any; return { label: '노드 이동 ' + id, apply(d: StageDocument) { const ns = d.path.nodes.map(n => { if (n.id === id) { prev = n; return { ...n, x: to.x, y: to.y }; } return n; }); return { ...d, path: { ...d.path, nodes: ns } }; }, revert(d: StageDocument) { if (!prev) return d; return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => n.id === id ? prev! : n) } }; } }; }

export function deleteNode(doc: StageDocument, id: string): Command {
  // 왜: 제거된 엣지와 트리거 참조를 기억해 revert 에서 복원한다.
  const removedEdges = doc.path.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === id || e.to === id);
  const removedTriggers = doc.burst.triggerNodeIds.map((t, i) => ({ t, i })).filter(({ t }) => t === id);
  const nodeIndex = doc.path.nodes.findIndex(n => n.id === id);
  return { label: '노드 삭제 ' + id, apply(d: StageDocument) {
    return { ...d, path: { nodes: d.path.nodes.filter(n => n.id !== id), edges: d.path.edges.filter(e => e.from !== id && e.to !== id) }, burst: { ...d.burst, triggerNodeIds: d.burst.triggerNodeIds.filter(t => t !== id) } };
  }, revert(d: StageDocument) {
    // 왜: 엣지를 오름차순 인덱스 순서로 복원한다. splice + reverse 는 순서가 달라진다.
    const node = doc.path.nodes.find(n => n.id === id);
    const nodes = node ? (nodeIndex >= 0 && nodeIndex <= d.path.nodes.length ? [...d.path.nodes.slice(0, nodeIndex), node, ...d.path.nodes.slice(nodeIndex)] : [...d.path.nodes, node]) : [...d.path.nodes];
    const re = [...removedEdges].sort((a, b) => a.i - b.i);
    
    const edgesOut: typeof doc.path.edges = [];
    let ri = 0;
    for (let i = 0; i <= d.path.edges.length; i++) {
      while (ri < re.length && re[ri]!.i === edgesOut.length) { edgesOut.push(re[ri]!.e); ri++; }
      if (i < d.path.edges.length) edgesOut.push(d.path.edges[i]!);
    }
    const triggers = [...d.burst.triggerNodeIds];
    for (const { t, i } of [...removedTriggers].sort((a, b) => a.i - b.i)) triggers.splice(i, 0, t);
    return { ...d, path: { nodes, edges: edgesOut }, burst: { ...d.burst, triggerNodeIds: triggers } };
  } };
}

export function renameNode(doc: StageDocument, id: string, newId: string): Command {
  if (doc.path.nodes.some(n => n.id === newId)) throw new Error('이미 있는 ID');
  const r = (s: string) => s === id ? newId : s; const rr = (s: string) => s === newId ? id : s;
  return { label: '노드 이름 ' + id + '→' + newId, apply(d: StageDocument) {
    return { ...d, path: { nodes: d.path.nodes.map(n => n.id === id ? { ...n, id: newId } : n), edges: d.path.edges.map(e => ({ ...e, from: r(e.from), to: r(e.to) })) }, burst: { ...d.burst, triggerNodeIds: d.burst.triggerNodeIds.map(r) } };
  }, revert(d: StageDocument) {
    return { ...d, path: { nodes: d.path.nodes.map(n => n.id === newId ? { ...n, id } : n), edges: d.path.edges.map(e => ({ ...e, from: rr(e.from), to: rr(e.to) })) }, burst: { ...d.burst, triggerNodeIds: d.burst.triggerNodeIds.map(rr) } };
  } };
}

export function setNodeRole(_doc: StageDocument, id: string, role: PathNode["role"]): Command {
  // 왜: apply 전 전체 nodes 배열을 캡처해 revert 에서 통째로 복원한다.
  //   이전에는 revert 가 `oldRole === 'start'` 같은 조건으로 유추해, N05→start 강등의
  //   undo 에서 기존 start(N00)가 waypoint 로 강등된 채 남는 버그가 있었다.
  let prevNodes: PathNode[] = [];
  return { label: '노드 역할 ' + id + '→' + role, apply(d: StageDocument) {
    prevNodes = d.path.nodes.map(n => ({ ...n }));
    return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => { if (n.id === id) return { ...n, role }; if (role === 'start' && n.role === 'start' && n.id !== id) return { ...n, role: 'waypoint' as const }; return n; }) } };
  }, revert(d: StageDocument) {
    if (prevNodes.length === 0) return d;
    return { ...d, path: { ...d.path, nodes: prevNodes.map(n => ({ ...n })) } };
  } };
}

