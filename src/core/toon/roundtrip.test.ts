/**
 * 목적: 임의 문서 20개에 대해 `decode(encode(doc))` 이 원본과 같은지 확인한다 (SDD-09 §2-5).
 * 왜 이 구조인가: 씨앗 하나만으로는 인코더가 "그 파일에만 맞는" 상태여도 초록불이다.
 *   크기·노드 수·까다로운 문자열을 흔들어 봐야 정보 손실이 드러난다.
 *   시드를 고정해 실패를 재현할 수 있게 한다 — 랜덤 테스트가 재현 불가면 쓸모가 없다.
 * 바꾸면 안 되는 것: 시드 고정. 그리고 인용이 필요한 이름을 반드시 섞는 것
 *   (기획자가 난이도 표시명에 콤마를 넣는 일이 실제로 일어난다).
 * 근거: SDD-09 §2-5 [D-09-02], SDD-06 §2 [D-06-02]
 */
import { describe, expect, it } from 'vitest';
import { decode } from './decode.js';
import { encode } from './encode.js';
import { mulberry32 } from '../sim/rng.js';
import { createEmptyStage } from '../model/factory.js';
import { Cell } from '../model/cell.js';
import { withCells } from '../model/map.js';
import type { NodeRole, StageDocument } from '../model/stage.js';

const CELLS = [Cell.Empty, Cell.Ground, Cell.Road, Cell.Buildable, Cell.VillageSlot, Cell.Blocked, Cell.Water];
const ROLES: NodeRole[] = ['start', 'exit', 'branch', 'waypoint'];
// 왜 이런 이름들인가: 전부 인용 판정에 걸리는 값이다. 인코더가 인용을 빠뜨리면 여기서 깨진다.
const TRICKY = ['보통', 'a,b', 'x: y', '12', '-dash', '#hash', 'true', ' pad ', ''];

function randomDoc(seed: number): StageDocument {
  const rnd = mulberry32(seed);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

  const w = int(8, 40);
  const h = int(8, 40);
  const base = createEmptyStage('Stage' + seed, w, h);
  const changes: Array<{ x: number; y: number; cell: Cell }> = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) changes.push({ x, y, cell: pick(CELLS) });

  const nodeCount = int(0, 10);
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `N${String(i).padStart(2, '0')}`,
    x: int(0, w - 1),
    y: int(0, h - 1),
    role: pick(ROLES),
  }));
  const edges = nodes.slice(1).map((n, i) => ({
    from: nodes[i]!.id,
    to: n.id,
    allowed: pick([['Escortee'], ['Enemy'], ['Escortee', 'Ally'], ['Escortee', 'Enemy', 'Ally']] as const),
    bidirectional: rnd() < 0.5,
    shortcut: rnd() < 0.3,
  }));

  return {
    ...base,
    name: 'Stage' + seed,
    map: withCells(base.map, changes),
    path: { nodes, edges },
    spawn: {
      ...base.spawn,
      volleySpacing: Math.round(rnd() * 1000) / 1000,
      restSeconds: Math.round(rnd() * 10000) / 100,
      table: [{ enemy: pick(TRICKY) || 'Robot_Walker', weight: int(0, 100) }],
    },
    burst: { ...base.burst, triggerNodeIds: nodes.slice(0, int(0, Math.min(2, nodeCount))).map((n) => n.id) },
    economy: {
      ...base.economy,
      startingResource: int(0, 9999),
      difficulties: base.economy.difficulties.map((d) => ({ ...d, displayName: pick(TRICKY) })),
    },
  };
}

describe('임의 문서 왕복', () => {
  for (let seed = 1; seed <= 20; seed++) {
    it(`시드 ${seed}: decode(encode(doc)) === doc`, () => {
      const doc = randomDoc(seed);
      const text = encode(doc, { toolVersion: 'test' });
      const back = decode(text);
      expect(back.ok, back.ok ? '' : `${back.error.line}행 ${back.error.message}\n---\n${text}`).toBe(true);
      if (!back.ok) return;
      const got = back.value;
      expect(got.name).toBe(doc.name);
      expect([...got.map.cells]).toEqual([...doc.map.cells]);
      expect(got.map.width).toBe(doc.map.width);
      expect(got.map.height).toBe(doc.map.height);
      expect(got.path.nodes).toEqual(doc.path.nodes);
      expect(got.path.edges).toEqual(doc.path.edges);
      expect(got.spawn.table).toEqual(doc.spawn.table);
      expect(got.spawn.volleySpacing).toBe(doc.spawn.volleySpacing);
      expect(got.spawn.restSeconds).toBe(doc.spawn.restSeconds);
      expect(got.burst.triggerNodeIds).toEqual(doc.burst.triggerNodeIds);
      expect(got.economy.difficulties).toEqual(doc.economy.difficulties);
      expect(got.economy.startingResource).toBe(doc.economy.startingResource);
    });
  }
});
