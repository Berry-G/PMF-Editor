/**
 * 목적: 모든 커맨드의 왕복 검증. undo(do(doc)) === doc, do(undo(do(doc))) === do(doc).
 * 왜 이 구조인가: SDD-06 §5 요구. runRoundtrip 첫 인자는 **커맨드 생성 함수 이름**으로 통일.
 *   commands-coverage.test.ts 게이트가 이 문자열을 파싱해 보장한다.
 * 바꾸면 안 되는 것: 세 단언 — undo(do) deepEqual doc, do(undo(do)) deepEqual do(doc), in-place 금지.
 * 근거: SDD-06 §5 [D-06-05], SDD-09 §8 [D-09-08]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../toon/decode.js';
import { stageEquals } from '../model/equals.js';
import { Cell } from '../model/cell.js';
import { paintCells, pasteCells, type Clipboard } from './paint.js';
import { resizeMap, setField, setTable } from './fields.js';
import { buildPathFromRoad } from '../geometry/roadpath.js';
import { addNode, moveNode, deleteNode, renameNode, setNodeRole, replacePath } from './nodes.js';
import { addEdge, deleteEdge, setEdgeProps } from './edges.js';
import type { Command } from './command.js';
import type { StageDocument } from '../model/stage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '..', '..', '..', 'docs', 'examples', 'Stage_Greybox.toon');
const SEED_TEXT = readFileSync(SEED_PATH, 'utf8');
const SEED = (decode(SEED_TEXT) as { ok: true; value: StageDocument }).value;

function clone(d: StageDocument): StageDocument {
  const c = JSON.parse(JSON.stringify(d)) as StageDocument;
  c.map.cells = new Uint8Array(d.map.cells);
  return c;
}

function runRoundtrip(name: string, doc: StageDocument, cmd: Command) {
  const orig = clone(doc);
  const after = cmd.apply(doc);
  expect(after, name + ': apply returns new doc').not.toBe(doc);
  expect(stageEquals(cmd.revert(after), doc), name + ': undo(do(doc)) deepEqual doc').toBe(true);
  expect(stageEquals(cmd.apply(cmd.revert(after)), after), name + ': do(undo(do(doc))) deepEqual do(doc)').toBe(true);
  expect(stageEquals(doc, orig), name + ': in-place 금지').toBe(true);
}

const clip: Clipboard = { width: 3, height: 2, cells: new Uint8Array([3, 3, 3, 5, 3, 3]) };

describe('커맨드 왕복', () => {
  it('paintCells', () => { const d = clone(SEED); runRoundtrip('paintCells', d, paintCells(d.map, [{ x: 5, y: 5, cell: Cell.Water }], 't')); });
  it('paintCells 같은 칸 두 번', () => { const d = clone(SEED); runRoundtrip('paintCells', d, paintCells(d.map, [{ x: 5, y: 5, cell: Cell.Water }, { x: 5, y: 5, cell: Cell.Water }], 't')); });
  it('pasteCells', () => { const d = clone(SEED); runRoundtrip('pasteCells', d, pasteCells(d.map, { x: 10, y: 10 }, clip)); });
  it('pasteCells 맵 밖 잘림', () => { const d = clone(SEED); runRoundtrip('pasteCells', d, pasteCells(d.map, { x: 31, y: 17 }, clip)); });
  it('resizeMap 확대', () => { const d = clone(SEED); runRoundtrip('resizeMap', d, resizeMap(d, 40, 18, 'w')); });
  it('resizeMap 축소', () => { const d = clone(SEED); runRoundtrip('resizeMap', d, resizeMap(d, 24, 14, 'c')); });
  it('resizeMap 노드 맵 밖', () => { const d = clone(SEED); runRoundtrip('resizeMap', d, resizeMap(d, 20, 12, 'sw')); });
  it('addNode', () => { const d = clone(SEED); runRoundtrip('addNode', d, addNode({ id: 'N99_test', x: 10, y: 10, role: 'waypoint' })); });
  it('moveNode', () => { const d = clone(SEED); runRoundtrip('moveNode', d, moveNode('N01', { x: 20, y: 20 })); });
  it('deleteNode N06', () => { const d = clone(SEED); runRoundtrip('deleteNode', d, deleteNode(d, 'N06')); });
  it('deleteNode N01', () => { const d = clone(SEED); runRoundtrip('deleteNode', d, deleteNode(d, 'N01')); });
  it('deleteNode N08 (4 edges)', () => { const d = clone(SEED); runRoundtrip('deleteNode', d, deleteNode(d, 'N08')); });
  it('renameNode', () => { const d = clone(SEED); runRoundtrip('renameNode', d, renameNode(d, 'N01', 'N01x')); });
  it('renameNode trigger ref', () => { const d = clone(SEED); const cmd = renameNode(d, 'N06', 'N06x'); const a = cmd.apply(d); expect(a.burst.triggerNodeIds).toContain('N06x'); runRoundtrip('renameNode', d, cmd); });
  it('replacePath (도로에서 경로 만들기)', () => {
    const d = clone(SEED);
    const r = buildPathFromRoad(d.map, { x: 1, y: 9 }, { x: 30, y: 6 });
    expect(r.ok, r.reason).toBe(true);
    const cmd = replacePath(r.nodes, r.edges);
    const after = cmd.apply(d);
    // 통째로 갈아끼운다 — 분기·지름길이 사라지는 게 정상이고, 그건 UI 가 미리 경고한다.
    expect(after.path.nodes.some(n => n.role === 'branch')).toBe(false);
    expect(after.path.edges.some(e => e.shortcut)).toBe(false);
    // burst.triggerNodeIds 는 건드리지 않는다 — 조용히 지우면 트리거를 잃은 줄도 모른다.
    expect(after.burst.triggerNodeIds).toEqual(d.burst.triggerNodeIds);
    runRoundtrip('replacePath', d, replacePath(r.nodes, r.edges));
  });
  it('setNodeRole branch', () => { const d = clone(SEED); runRoundtrip('setNodeRole', d, setNodeRole(d, 'N01', 'branch')); });
  it('setNodeRole start 강등', () => { const d = clone(SEED); runRoundtrip('setNodeRole', d, setNodeRole(d, 'N05', 'start')); });
  it('addEdge', () => { const d = clone(SEED); runRoundtrip('addEdge', d, addEdge({ from: 'N01', to: 'N02', allowed: ['Escortee', 'Enemy', 'Ally'], bidirectional: true, shortcut: false })); });
  it('addEdge 중복 모양', () => { const d = clone(SEED); runRoundtrip('addEdge', d, addEdge({ from: 'N05', to: 'N08', allowed: ['Escortee'], bidirectional: true, shortcut: true })); });
  it('deleteEdge 0', () => { const d = clone(SEED); runRoundtrip('deleteEdge', d, deleteEdge(0)); });
  it('deleteEdge 마지막', () => { const d = clone(SEED); runRoundtrip('deleteEdge', d, deleteEdge(d.path.edges.length - 1)); });
  it('setEdgeProps shortcut', () => { const d = clone(SEED); runRoundtrip('setEdgeProps', d, setEdgeProps(0, { shortcut: true })); });
  it('setEdgeProps bidirectional', () => { const d = clone(SEED); runRoundtrip('setEdgeProps', d, setEdgeProps(0, { bidirectional: false })); });
  it('setField speed', () => { const d = clone(SEED); runRoundtrip('setField', d, setField('escortee.speed', 0.99)); });
  it('setField int', () => { const d = clone(SEED); runRoundtrip('setField', d, setField('spawn.volleyCount', 6)); });
  it('setField boolean', () => { const d = clone(SEED); runRoundtrip('setField', d, setField('mother.followsPath', false)); });
  it('setTable spawn.table', () => { const d = clone(SEED); runRoundtrip('setTable', d, setTable('spawn.table', [{ enemy: 'Robot_Walker', weight: 100 }])); });
  it('setTable difficulties', () => { const d = clone(SEED); runRoundtrip('setTable', d, setTable('economy.difficulties', [{ difficulty: 'Easy', displayName: '쉬움', killReward: 5, resourcePerSecond: 3 }, { difficulty: 'Normal', displayName: '보통', killReward: 5, resourcePerSecond: 0 }, { difficulty: 'Hard', displayName: '어려움', killReward: 4, resourcePerSecond: 0 }])); });
});

