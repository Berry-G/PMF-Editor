/**
 * 목적: 노드 편집 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: 각 커맨드는 apply/revert 쌍으로 Undo/Redo 스택을 구성한다.
 *   deleteNode 는 붙은 엣지·트리거 참조를 기억해 undo 때 복원한다.
 *   renameNode 는 엣지·트리거 참조를 함께 갱신한다 (ADR-E06).
 *   setNodeRole 에서 start 로 바꾸면 기존 start 는 waypoint 로 내린다.
 * 바꾸면 안 되는 것: deleteNode 가 노드 번호를 당기지 않는 것 (ADR-E06).
 * 근거: SDD-09 §8, SDD-08 §7, ADR-E06
 */
import type { Command } from './command.js';
import type { StageDocument, PathNode, XY } from '../model/stage.js';

export function addNode(node: PathNode): Command {
  return { label: '노드 추가 ' + node.id, apply(d: StageDocument) { return { ...d, path: { ...d.path, nodes: [...d.path.nodes, node] } }; }, revert(d: StageDocument) { return { ...d, path: { ...d.path, nodes: d.path.nodes.filter(n => n.id !== node.id) } }; } };
}

export function moveNode(id: string, to: XY): Command { let prev: any; return { label: '노드 이동 ' + id, apply(d: StageDocument) { const ns = d.path.nodes.map(n => { if (n.id === id) { prev = n; return { ...n, x: to.x, y: to.y }; } return n; }); return { ...d, path: { ...d.path, nodes: ns } }; }, revert(d: StageDocument) { if (!prev) return d; return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => n.id === id ? prev! : n) } }; } }; }

export function deleteNode(doc: StageDocument, id: string): Command {
  const re = doc.path.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === id || e.to === id);
  const rt = doc.burst.triggerNodeIds.map((t, i) => ({ t, i })).filter(({ t }) => t === id);
  const ni = doc.path.nodes.findIndex(n => n.id === id);
  return { label: '노드 삭제 ' + id, apply(d: StageDocument) {
    return { ...d, path: { nodes: d.path.nodes.filter(n => n.id !== id), edges: d.path.edges.filter(e => e.from !== id && e.to !== id) }, burst: { ...d.burst, triggerNodeIds: d.burst.triggerNodeIds.filter(t => t !== id) } };
  }, revert(d: StageDocument) {
    const nodes = [...d.path.nodes]; const found = doc.path.nodes.find(n => n.id === id);
    if (found) { if (ni >= 0 && ni <= nodes.length) nodes.splice(ni, 0, found); else nodes.push(found); }
    const edges = [...d.path.edges]; for (const { e, i } of [...re].reverse()) edges.splice(i, 0, e);
    const triggers = [...d.burst.triggerNodeIds]; for (const { t, i } of [...rt].reverse()) triggers.splice(i, 0, t);
    return { ...d, path: { nodes, edges }, burst: { ...d.burst, triggerNodeIds: triggers } };
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

export function setNodeRole(doc: StageDocument, id: string, role: PathNode['role']): Command {
  const oldRole = doc.path.nodes.find(n => n.id === id)?.role; const oldStart = doc.path.nodes.find(n => n.role === 'start');
  return { label: '노드 역할 ' + id + '→' + role, apply(d: StageDocument) {
    return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => { if (n.id === id) return { ...n, role }; if (role === 'start' && n.role === 'start' && n.id !== id) return { ...n, role: 'waypoint' as const }; return n; }) } };
  }, revert(d: StageDocument) {
    return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => { if (n.id === id) return { ...n, role: oldRole ?? 'waypoint' as const }; if (oldRole === 'start' && oldStart && n.id === oldStart.id) return { ...n, role: 'start' as const }; return n; }) } };
  } };
}