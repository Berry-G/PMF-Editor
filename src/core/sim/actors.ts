/**
 * 목적: 시뮬레이션 상태 타입과 헬퍼 함수.
 * 왜 이 구조인가: initState 가 모든 초기값을 한 곳에서 설정한다.
 *   simulate.ts 와 SimState 타입을 공유한다.
 * 바꾸면 안 되는 것: SimState 타입 구조 — simulate.ts 와 동기화.
 * 근거: SDD-09 §7 [D-09-07]
 */
import type { StageDocument } from '../model/stage.js';
import type { EnemyCatalogEntry } from './params.js';
import { buildGraph, AGENT_BIT } from '../graph/build.js';
import { shortestPath } from '../graph/dijkstra.js';
import { mulberry32 } from './rng.js';

export interface SimResult {
  seed: number; dt: number;
  stageSeconds: number; totalSpawned: number;
  spawnedByEnemy: Record<string, number>;
  incomeCeiling: Record<string, number>;
  bursts: Array<{ triggerId: string; start: number; end: number; spawned: number; payback: number }>;
  samples: Array<{ t: number; escortee: XY; mother: XY; distance: number; alive: number }>;
  spawnEvents: Array<{ t: number; enemy: string; at: XY }>;
  contacts: Array<{ t: number; enemy: string }>;
  warnings: string[];
}

export interface XY { x: number; y: number }

export interface SimState {
  doc: StageDocument; cat: readonly EnemyCatalogEntry[];
  g: ReturnType<typeof buildGraph>; gOpen: ReturnType<typeof buildGraph>;
  startIdx: number; exitIdx: number;
  nodes: readonly { x: number; y: number; id: string }[];
  escortee: { pos: XY; route: number[]; seg: number; t: number; arrived: boolean; lastNode: number };
  mother: { pos: XY; state: 'idle'|'chasing'|'burst'; idleLeft: number; route: number[]; seg: number; t: number; currentNode: number; burstLeft: number; recoveryLeft: number; burstSpawned: number; firedTriggers: Set<number>; followsPath: boolean };
  rhythm: { phase: 'rest'|'volley'; restLeft: number; volleyLeft: number; spacingLeft: number };
  enemies: Actor[];
  rnd: () => number; time: number;
  samples: SimResult['samples']; spawnEvents: SimResult['spawnEvents']; contacts: SimResult['contacts']; bursts: SimResult['bursts']; warnings: string[];
  opened: boolean; burstTriggerSet: Set<number>;
  paramN: number; paramRest: number;
  spawn: { volleyCount: number; volleySpacing: number; restSeconds: number };
  burst: { volleyCount: number; restSeconds: number; duration: number; recoverySeconds: number; recoverySpeedMultiplier: number };
  escorteeSpeed: number; motherSpeed: number;
  shortOpenAt: number | null; maxSeconds: number; dt: number;
}

export interface Actor { name: string; speed: number; pos: XY; route: number[]; seg: number; t: number; currentNode: number }

export function initState(doc: StageDocument, params: { seed: number; dt: number; shortcutOpenAt: number | null; maxSeconds: number }, catalog: readonly EnemyCatalogEntry[]): SimState {
  const nodes = doc.path.nodes;
  const startIdx = nodes.findIndex((n: { role: string }) => n.role === 'start')!;
  const exitIdx = nodes.findIndex((n: { role: string }) => n.role === 'exit')!;
  const g = buildGraph(doc.path, { openShortcuts: false }); const gOpen = buildGraph(doc.path, { openShortcuts: true });
  if (startIdx === -1 || exitIdx === -1) throw new Error('start/exit 없음');
  const sPos: XY = { x: nodes[startIdx]!.x, y: nodes[startIdx]!.y };
  const escRoute = shortestPath(g, startIdx, exitIdx, AGENT_BIT.Escortee);
  if (escRoute === null) throw new Error('Escortee 경로 없음');
  const btSet = new Set<number>();
  for (const id of doc.burst.triggerNodeIds) { const idx = nodes.findIndex((n: { id: string }) => n.id === id); if (idx !== -1) btSet.add(idx); }
  return {
    doc, cat: catalog, g, gOpen, startIdx, exitIdx, nodes,
    escortee: { pos: { ...sPos }, route: escRoute, seg: 0, t: 0, arrived: false, lastNode: startIdx },
    mother: { pos: { ...sPos }, state: 'idle', idleLeft: doc.mother.spawnDelay, route: [], seg: 0, t: 0, currentNode: startIdx, burstLeft: 0, recoveryLeft: 0, burstSpawned: 0, firedTriggers: new Set(), followsPath: doc.mother.followsPath },
    rhythm: { phase: 'rest', restLeft: doc.spawn.restSeconds, volleyLeft: 0, spacingLeft: 0 },
    enemies: [], rnd: mulberry32(params.seed), time: 0,
    samples: [], spawnEvents: [], contacts: [], bursts: [], warnings: [], opened: false, burstTriggerSet: btSet,
    paramN: doc.spawn.volleyCount, paramRest: doc.spawn.restSeconds,
    spawn: { volleyCount: doc.spawn.volleyCount, volleySpacing: doc.spawn.volleySpacing, restSeconds: doc.spawn.restSeconds },
    burst: { volleyCount: doc.burst.volleyCount, restSeconds: doc.burst.restSeconds, duration: doc.burst.duration, recoverySeconds: doc.burst.recoverySeconds, recoverySpeedMultiplier: doc.burst.recoverySpeedMultiplier },
    escorteeSpeed: doc.escortee.speed, motherSpeed: doc.mother.speed,
    shortOpenAt: params.shortcutOpenAt, maxSeconds: params.maxSeconds, dt: params.dt,
  };
}