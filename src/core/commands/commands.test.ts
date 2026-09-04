/**
 * 목적: 모든 커맨드의 왕복 검증. undo(do(doc)) === doc, do(undo(do(doc))) === do(doc).
 * 왜 이 구조인가: SDD-06 §5 가 요구한 테스트. 지난 라운드에서 setField/setTable/deleteNode
 *   가 이 테스트 없이 파손된 채로 통과했다. 먼저 쓰고 실패를 확인한 뒤 고친다.
 * 바꾸면 안 되는 것: 각 커맨드의 세 가지 단언 — undo(do) deepEqual doc, do(undo(do)) deepEqual do(doc),
 *   원본 doc 이 변경되지 않음 (in-place 금지).
 * 근거: SDD-06 §5 [D-06-05], SDD-09 §8 [D-09-08]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../toon/decode.js';
import { stageEquals } from '../model/equals.js';
import { Cell } from '../model/cell.js';
import { paintCells } from './paint.js';
import { resizeMap, setField, setTable } from './fields.js';
import { addNode, moveNode, deleteNode, renameNode, setNodeRole } from './nodes.js';
import { addEdge, deleteEdge, setEdgeProps } from './edges.js';
import type { StageDocument, PathNode, PathEdge } from '../model/stage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '..', '..', '..', 'docs', 'examples', 'Stage_Greybox.toon');
const SEED_TEXT = readFileSync(SEED_PATH, 'utf8');
const SEED = (decode(SEED_TEXT) as { ok: true; value: StageDocument }).value;

function clone(doc: StageDocument): StageDocument {
  const c = JSON.parse(JSON.stringify(doc)) as StageDocument;
  // 왜: JSON 직렬화는 Uint8Array 를 plain object 로 바꾼다. cells 는 명시적으로 복사한다.
  c.map.cells = new Uint8Array(doc.map.cells);
  return c;
}

function runRoundtrip(cmdLabel: string, doc: StageDocument, cmd: any) {
  // 왜: 세 가지 단언 — 원상 복구, 재적용 일치, in-place 금지
  const orig = clone(doc);
  const after = cmd.apply(doc);
  expect(after, `${cmdLabel}: apply 가 새 문서를 반환해야 한다`).not.toBe(doc);
  const reverted = cmd.revert(after);
  expect(stageEquals(reverted, doc), `${cmdLabel}: undo(do(doc)) deepEqual doc`).toBe(true);
  const reapplied = cmd.apply(reverted);
  expect(stageEquals(reapplied, after), `${cmdLabel}: do(undo(do(doc))) deepEqual do(doc)`).toBe(true);
  expect(stageEquals(doc, orig), `${cmdLabel}: 원본 doc 이 변경되지 않았다 (in-place 금지)`).toBe(true);
}

describe('커맨드 왕복', () => {
  // paintCells
  it('paintCells', () => {
    const doc = clone(SEED);
    const cmd = paintCells(doc.map, [{ x: 5, y: 5, cell: Cell.Water }], '테스트 칠하기');
    runRoundtrip('paintCells', doc, cmd);
  });

  // resizeMap (확대 + 축소)
  it('resizeMap 확대 (40x18, anchor w)', () => {
    const doc = clone(SEED);
    const cmd = resizeMap(doc, 40, 18, 'w');
    runRoundtrip('resizeMap 확대', doc, cmd);
  });

  it('resizeMap 축소 (24x14, anchor c)', () => {
    const doc = clone(SEED);
    const cmd = resizeMap(doc, 24, 14, 'c');
    runRoundtrip('resizeMap 축소', doc, cmd);
  });

  // addNode + moveNode + renameNode + setNodeRole
  it('addNode', () => {
    const doc = clone(SEED);
    const node: PathNode = { id: 'N99_test', x: 10, y: 10, role: 'waypoint' };
    const cmd = addNode(node);
    runRoundtrip('addNode', doc, cmd);
  });

  it('moveNode', () => {
    const doc = clone(SEED);
    const cmd = moveNode('N01', { x: 20, y: 20 });
    runRoundtrip('moveNode', doc, cmd);
  });

  it('renameNode', () => {
    const doc = clone(SEED);
    const cmd = renameNode(doc, 'N01', 'N01_renamed');
    runRoundtrip('renameNode', doc, cmd);
  });

  it('setNodeRole', () => {
    const doc = clone(SEED);
    const cmd = setNodeRole(doc, 'N01', 'branch');
    runRoundtrip('setNodeRole', doc, cmd);
  });

  // deleteNode (트리거 노드 N06 + 일반 노드 N01)
  it('deleteNode 트리거 노드 N06', () => {
    const doc = clone(SEED);
    const cmd = deleteNode(doc, 'N06');
    runRoundtrip('deleteNode N06', doc, cmd);
  });

  it('deleteNode 일반 노드 N01', () => {
    const doc = clone(SEED);
    const cmd = deleteNode(doc, 'N01');
    runRoundtrip('deleteNode N01', doc, cmd);
  });

  // addEdge + deleteEdge + setEdgeProps
  it('addEdge', () => {
    const doc = clone(SEED);
    const edge: PathEdge = { from: 'N01', to: 'N02', allowed: ['Escortee', 'Enemy', 'Ally'], bidirectional: true, shortcut: false };
    const cmd = addEdge(edge);
    runRoundtrip('addEdge', doc, cmd);
  });

  it('deleteEdge', () => {
    const doc = clone(SEED);
    const cmd = deleteEdge(0);
    runRoundtrip('deleteEdge', doc, cmd);
  });

  it('setEdgeProps', () => {
    const doc = clone(SEED);
    const cmd = setEdgeProps(0, { shortcut: true });
    runRoundtrip('setEdgeProps', doc, cmd);
  });

  // setField
  it('setField escortee.speed', () => {
    const doc = clone(SEED);
    const cmd = setField('escortee.speed', 0.99);
    runRoundtrip('setField escortee.speed', doc, cmd);
  });

  it('setField presentation.masterVolume', () => {
    const doc = clone(SEED);
    const cmd = setField('presentation.masterVolume', 0.5);
    runRoundtrip('setField presentation.masterVolume', doc, cmd);
  });

  // setTable
  it('setTable spawn.table', () => {
    const doc = clone(SEED);
    const cmd = setTable('spawn.table', [{ enemy: 'Robot_Walker', weight: 100 }]);
    runRoundtrip('setTable spawn.table', doc, cmd);
  });

  it('setTable economy.difficulties', () => {
    const doc = clone(SEED);
    const cmd = setTable('economy.difficulties', [
      { difficulty: 'Easy', displayName: '쉬움', killReward: 5, resourcePerSecond: 3 },
      { difficulty: 'Normal', displayName: '보통', killReward: 5, resourcePerSecond: 0 },
      { difficulty: 'Hard', displayName: '어려움', killReward: 4, resourcePerSecond: 0 },
    ]);
    runRoundtrip('setTable economy.difficulties', doc, cmd);
  });
});




