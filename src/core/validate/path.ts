/**
 * 목적: 경로 검증 규칙 V-P01~V-P09 구현.
 * 왜 이 구조인가: ID 형식(P09) 먼저 검사. V-P03 코너 규칙: 일반 엣지는 축 정렬·도로 위여야 함.
 * 바꾸면 안 되는 것: 메시지 템플릿 — 임포터 C# 과 같은 문장.
 * 근거: SDD-09 §3-3 [D-09-03-3], SDD-08 §4 [D-08-04]
 */
import type { StageDocument } from '../model/stage.js';
import type { Issue } from './index.js';
import { Cell, isAllyWalkable } from '../model/cell.js';
import { cellAt, inBounds } from '../model/map.js';
import { buildGraph, AGENT_BIT } from '../graph/build.js';
import { shortestPath } from '../graph/dijkstra.js';

const CELL_NAME: Record<number, string> = {
  [Cell.Empty]: '빈칸', [Cell.Ground]: '땅', [Cell.Road]: '도로',
  [Cell.Buildable]: '배치 가능', [Cell.VillageSlot]: '마을', [Cell.Blocked]: '벽', [Cell.Water]: '물',
};

export function validatePath(doc: StageDocument): Issue[] {
  const issues: Issue[] = [];
  const { nodes, edges } = doc.path;

  // V-P09: ID 형식
  const idSet = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.id))
      issues.push({ id: 'V-P09', severity: 'error', path: `path.nodes[${i}]`, message: `id "${n.id}" 형식 위반` });
    else {
      const existing = idSet.get(n.id);
      if (existing !== undefined)
        issues.push({ id: 'V-P09', severity: 'error', path: `path.nodes[${i}]`, message: `id "${n.id}" 가 path.nodes[${existing}] 와 중복` });
      idSet.set(n.id, i);
    }
  }
  if (issues.some(i => i.severity === 'error' && i.id === 'V-P09')) return issues;

  // V-P01: 참조
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!idSet.has(e.from)) issues.push({ id: 'V-P01', severity: 'error', path: `path.edges[${i}]`, message: `노드 "${e.from}" 가 없다`, edgeIndex: i });
    if (!idSet.has(e.to)) issues.push({ id: 'V-P01', severity: 'error', path: `path.edges[${i}]`, message: `노드 "${e.to}" 가 없다`, edgeIndex: i });
  }
  for (let i = 0; i < doc.burst.triggerNodeIds.length; i++) {
    const id = doc.burst.triggerNodeIds[i]!;
    if (!idSet.has(id)) issues.push({ id: 'V-P01', severity: 'error', path: `burst.triggerNodeIds[${i}]`, message: `노드 "${id}" 가 없다` });
  }

  // V-P02: start/exit 개수
  const starts = nodes.filter(n => n.role === 'start');
  const exits = nodes.filter(n => n.role === 'exit');
  if (starts.length !== 1)
    issues.push({ id: 'V-P02', severity: 'error', path: 'path', message: `start 노드가 ${starts.length}개다. 정확히 1개여야 한다`, nodeIds: starts.map(n => n.id) });
  if (exits.length === 0)
    issues.push({ id: 'V-P02', severity: 'error', path: 'path', message: 'exit 노드가 없다' });
  else if (exits.length > 1)
    issues.push({ id: 'V-P02', severity: 'warning', path: 'path', message: `exit 노드가 ${exits.length}개다. 게임은 첫 번째(${exits[0]!.id})만 쓴다`, nodeIds: exits.map(n => n.id) });
// V-P07: 노드 위치
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!; const c = cellAt(doc.map, n.x, n.y);
    const inside = inBounds(doc.map, n.x, n.y);
    if (!inside) { issues.push({ id: 'V-P07', severity: 'error', path: `path.nodes[${i}]`, message: `"${n.id}" 맵 밖`, nodeIds: [n.id] }); continue; }
    if (n.role === 'branch') {
      if (!isAllyWalkable(c)) issues.push({ id: 'V-P07', severity: 'error', path: `path.nodes[${i}]`, message: `"${n.id}" (${n.x},${n.y}) 은 ${CELL_NAME[c]??'?'}. branch 노드는 통행 가능 칸(. B V)에 있어야 함`, nodeIds: [n.id] });
    } else if (c !== Cell.Road) {
      issues.push({ id: 'V-P07', severity: 'error', path: `path.nodes[${i}]`, message: `"${n.id}" (${n.x},${n.y}) 은 ${CELL_NAME[c]??'?'}. start/exit/waypoint 노드는 도로(R) 위에 있어야 함`, nodeIds: [n.id] });
    }
  }

  // V-P03: 도로 검사
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!; if (e.shortcut) continue;
    const fn = nodes.find(n => n.id === e.from); const tn = nodes.find(n => n.id === e.to);
    if (!fn || !tn) continue; if (fn.role === 'branch' || tn.role === 'branch') continue;
    if (fn.x !== tn.x && fn.y !== tn.y) {
      issues.push({ id: 'V-P03', severity: 'error', path: `path.edges[${i}]`, message: `"${e.from}→${e.to}" 대각선 엣지`, edgeIndex: i });
    } else {
      const offRoad: Array<{ x: number; y: number }> = [];
      if (fn.x === tn.x) { const x = fn.x; for (let y = Math.min(fn.y, tn.y); y <= Math.max(fn.y, tn.y); y++) { if (cellAt(doc.map, x, y) !== Cell.Road) offRoad.push({ x, y }); } }
      else { const y = fn.y; for (let x = Math.min(fn.x, tn.x); x <= Math.max(fn.x, tn.x); x++) { if (cellAt(doc.map, x, y) !== Cell.Road) offRoad.push({ x, y }); } }
      if (offRoad.length > 0) issues.push({ id: 'V-P03', severity: 'error', path: `path.edges[${i}]`, message: `"${e.from}→${e.to}" 도로 밖 칸 (${offRoad[0]!.x},${offRoad[0]!.y})`, edgeIndex: i });
    }
  }

  // V-P04: 지름길 권한
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (e.shortcut && !(e.allowed.length === 1 && e.allowed[0] === 'Escortee'))
      issues.push({ id: 'V-P04', severity: 'error', path: `path.edges[${i}]`, message: `지름길 allowed "${e.allowed.join('+')}"`, edgeIndex: i });
  }

  // V-P08: 엣지 중복
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i]!; const b = edges[j]!;
    const ak = a.bidirectional ? [a.from, a.to].sort().join('|') : `${a.from}>${a.to}`;
    const bk = b.bidirectional ? [b.from, b.to].sort().join('|') : `${b.from}>${b.to}`;
    if (ak === bk) issues.push({ id: 'V-P08', severity: 'error', path: `path.edges[${j}]`, message: `"${b.from}↔${b.to}" 가 path.edges[${i}] 와 중복`, edgeIndex: j });
  }

  // V-P05: 경로 존재
  if (starts.length === 1 && exits.length >= 1 && idSet.size === nodes.length) {
    try {
      const g = buildGraph(doc.path, { openShortcuts: false });
      const si = idSet.get(starts[0]!.id)!; const ei = idSet.get(exits[0]!.id)!;
      if (shortestPath(g, si, ei, AGENT_BIT.Escortee) === null)
        issues.push({ id: 'V-P05', severity: 'error', path: 'path', message: `start→exit 보호대상 경로 없음` });
      if (shortestPath(g, si, ei, AGENT_BIT.Enemy) === null)
        issues.push({ id: 'V-P05', severity: 'error', path: 'path', message: `start→exit 적(Enemy) 경로 없음. 모체가 얼어붙는다` });
    } catch { /* 그래프 빌드 실패 */ }
  }

  // V-P06: 트리거가 start/exit
  for (let i = 0; i < doc.burst.triggerNodeIds.length; i++) {
    const n = nodes.find(n => n.id === doc.burst.triggerNodeIds[i]);
    if (n && (n.role === 'start' || n.role === 'exit'))
      issues.push({ id: 'V-P06', severity: 'warning', path: `burst.triggerNodeIds[${i}]`, message: `"${n.id}" 는 ${n.role} 노드다` });
  }

  return issues;
}