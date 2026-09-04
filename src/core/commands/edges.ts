/**
 * 목적: 엣지 편집 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: 각 커맨드는 apply/revert 쌍으로 Undo/Redo 스택을 구성한다.
 *   setEdgeProps 는 shortcut=true 면 allowed 를 자동으로 Escortee 로 강제한다 (V-P04).
 * 바꾸면 안 되는 것: apply/revert 가 새 문서 반환.
 * 근거: SDD-09 §8, SDD-08 §7
 */
import type { Command } from './command.js';
import type { StageDocument, PathEdge } from '../model/stage.js';

export function addEdge(edge: PathEdge): Command { return { label: '엣지 추가 ' + edge.from + '→' + edge.to, apply(d: StageDocument) { return { ...d, path: { ...d.path, edges: [...d.path.edges, edge] } }; }, revert(d: StageDocument) { const es = d.path.edges.filter((e, i, a) => !(e.from === edge.from && e.to === edge.to && e.shortcut === edge.shortcut && i === a.length - 1)); return { ...d, path: { ...d.path, edges: es } }; } }; }

export function deleteEdge(index: number): Command { return { label: '엣지 삭제 ' + index, apply(d: StageDocument) { return { ...d, path: { ...d.path, edges: d.path.edges.filter((_, i) => i !== index) } }; }, revert(d: StageDocument) { const es = [...d.path.edges]; es.splice(index, 0, d.path.edges[index]!); return { ...d, path: { ...d.path, edges: es } }; } }; }

export function setEdgeProps(index: number, props: Partial<Pick<PathEdge, 'allowed' | 'bidirectional' | 'shortcut'>>): Command { return { label: '엣지 속성 ' + index, apply(d: StageDocument) { const e = d.path.edges[index]; if (!e) return d; const u = { ...e, ...props }; if (u.shortcut) u.allowed = ['Escortee']; const es = [...d.path.edges]; es[index] = u; return { ...d, path: { ...d.path, edges: es } }; }, revert(d: StageDocument) { const e = d.path.edges[index]; if (!e) return d; const es = [...d.path.edges]; es[index] = e; return { ...d, path: { ...d.path, edges: es } }; } }; }