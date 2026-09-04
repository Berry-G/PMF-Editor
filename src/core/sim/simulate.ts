/**
 * 목적: 시뮬레이션 메인. 결정론적 스텝 실행.
 * 왜 이 구조인가: 스텝 순서 고정 = 결정론. 총량 보존은 게임 ExitBurst 와 동일.
 * 바꾸면 안 되는 것: 스텝 순서, 총량 보존 수식, 가정 A1(Idle 중 스폰 없음).
 * 근거: SDD-04 §3§4 [D-04-03/04], SDD-09 §7 [D-09-07]
 */
import type { StageDocument } from '../model/stage.js';
import type { EnemyCatalogEntry, SimParams } from './params.js';
import { type SimResult, type SimState, type Actor, initState } from './actors.js';
import { AGENT_BIT } from '../graph/build.js';
import { shortestPath } from '../graph/dijkstra.js';
import { nearestNode } from '../graph/nearest.js';
import { pickFromTable } from './rng.js';

function moveAlong(a: Actor | SimState['escortee'] | SimState['mother'], d: number, st: SimState): void {
  const ns = st.nodes; let r = d;
  while (r > 0.0001 && a.route && a.seg < a.route.length - 1) {
    const n0 = ns[a.route[a.seg]!]!; const n1 = ns[a.route[a.seg + 1]!]!;
    const L = Math.hypot(n1.x - n0.x, n1.y - n0.y);
    if (L < 0.001) { a.seg++; a.t = 0; continue; }
    const rem = (1 - a.t) * L;
    if (r < rem - 0.0001) { a.t += r / L; a.pos.x = n0.x + (n1.x - n0.x) * a.t; a.pos.y = n0.y + (n1.y - n0.y) * a.t; r = 0; }
    else { r -= rem; a.seg++; a.t = 0; if (a.route[a.seg] !== undefined) { const n = ns[a.route[a.seg]!]!; a.pos.x = n.x; a.pos.y = n.y; if ('currentNode' in a) (a as any).currentNode = a.route[a.seg]!; if (st.escortee === a) onEscorteeNode(st, a.route[a.seg]!); } }
  }
}
function onEscorteeNode(st: SimState, ni: number): void {
  st.escortee.lastNode = ni; if (ni === st.exitIdx) { st.escortee.arrived = true; return; }
  if (st.burstTriggerSet.has(ni) && !st.mother.firedTriggers.has(ni) && st.mother.state === 'chasing') { st.mother.firedTriggers.add(ni); enterBurst(st, ni); }
  if (st.mother.state === 'chasing') recalcMother(st); for (const e of st.enemies) recalcEnemy(e, st);
}
function enterBurst(st: SimState, ti: number): void {
  st.mother.state = 'burst'; st.mother.burstLeft = st.burst.duration; st.mother.burstSpawned = 0;
  st.paramN = st.burst.volleyCount; st.paramRest = st.burst.restSeconds;
  st.rhythm = { phase: 'volley', restLeft: 0, volleyLeft: st.burst.volleyCount, spacingLeft: 0 };
  st.bursts.push({ triggerId: st.nodes[ti]!.id, start: st.time, end: 0, spawned: 0, payback: 0 });
}
function exitBurst(st: SimState): void {
  const rate = st.spawn.volleyCount / ((st.spawn.volleyCount - 1) * st.spawn.volleySpacing + st.spawn.restSeconds);
  const exp = rate * st.burst.duration; const debt = Math.max(0, st.mother.burstSpawned - exp);
  const pb = Math.min(debt / rate, st.burst.duration * 2);
  const lb = st.bursts[st.bursts.length - 1]; if (lb) { lb.end = st.time; lb.spawned = st.mother.burstSpawned; lb.payback = pb; }
  st.rhythm = { phase: 'rest', restLeft: Math.max(st.spawn.restSeconds, pb), volleyLeft: 0, spacingLeft: 0 };
  st.mother.recoveryLeft = st.burst.recoverySeconds; st.mother.state = 'chasing';
  st.paramN = st.spawn.volleyCount; st.paramRest = st.spawn.restSeconds; recalcMother(st);
}
function tickRhythm(st: SimState, dt: number): void {
  if (st.rhythm.phase === 'rest') { st.rhythm.restLeft -= dt; if (st.rhythm.restLeft <= 0) st.rhythm = { phase: 'volley', restLeft: 0, volleyLeft: st.paramN, spacingLeft: 0 }; }
  if (st.rhythm.phase === 'volley') {
    st.rhythm.spacingLeft -= dt;
    while (st.rhythm.spacingLeft <= 0 && st.rhythm.volleyLeft > 0) {
      const name = pickFromTable(st.doc.spawn.table, st.rnd); const spd = st.cat.find(c => c.name === name)?.moveSpeed ?? 1;
      if (!st.cat.find(c => c.name === name)) st.warnings.push('카탈로그 없음: ' + name);
      const e: Actor = { name, speed: spd, pos: { ...st.mother.pos }, route: [], seg: 0, t: 0, currentNode: st.mother.currentNode };
      recalcEnemy(e, st); st.enemies.push(e); st.spawnEvents.push({ t: st.time, enemy: name, at: { ...st.mother.pos } });
      if (st.mother.state === 'burst') st.mother.burstSpawned++;
      st.rhythm.volleyLeft--; if (st.rhythm.volleyLeft > 0) st.rhythm.spacingLeft += st.spawn.volleySpacing;
    }
    if (st.rhythm.volleyLeft === 0) st.rhythm = { phase: 'rest', restLeft: st.paramRest, volleyLeft: 0, spacingLeft: 0 };
  }
}
function recalcMother(st: SimState): void {
  const t = nearestNode(st.g, st.escortee.pos, AGENT_BIT.Enemy); if (t === null) return;
  const nn = st.mother.route.length > st.mother.seg + 1 ? st.mother.route[st.mother.seg + 1] : st.mother.currentNode;
  const np = shortestPath(st.g, nn ?? st.mother.currentNode, t, AGENT_BIT.Enemy);
  if (np) { const ss = st.mother.seg >= 0 && st.mother.seg < st.mother.route.length ? st.mother.route[st.mother.seg]! : st.mother.currentNode; st.mother.route = [ss, ...np.filter(i => i !== ss)]; st.mother.seg = 0; st.mother.currentNode = st.mother.route[0] ?? st.mother.currentNode; }
}
function recalcEnemy(e: Actor, st: SimState): void {
  const t = nearestNode(st.g, st.escortee.pos, AGENT_BIT.Enemy); if (t === null) return;
  const np = shortestPath(st.g, e.currentNode, t, AGENT_BIT.Enemy);
  if (np) { e.route = [e.seg >= 0 && e.seg < e.route.length ? e.route[e.seg]! : e.currentNode, ...np.filter(i => i !== (e.route[e.seg] ?? e.currentNode))]; e.seg = 0; e.t = 0; }
}
function step(st: SimState): void {
  const dt = st.dt;
  if (st.shortOpenAt !== null && st.time >= st.shortOpenAt && !st.opened) {
    st.opened = true; const np = shortestPath(st.gOpen, st.escortee.route[st.escortee.seg] ?? st.escortee.lastNode, st.exitIdx, AGENT_BIT.Escortee);
    if (np) st.escortee.route = np; onEscorteeNode(st, st.escortee.lastNode);
  }
  moveAlong(st.escortee, st.escorteeSpeed * dt, st);
  switch (st.mother.state) {
    case 'idle': st.mother.idleLeft -= dt; if (st.mother.idleLeft <= 0) { st.mother.state = 'chasing'; recalcMother(st); } break;
    case 'chasing': {
      const spd = st.mother.followsPath ? st.motherSpeed * (st.mother.recoveryLeft > 0 ? st.burst.recoverySpeedMultiplier : 1) : st.motherSpeed;
      st.mother.recoveryLeft = Math.max(0, st.mother.recoveryLeft - dt);
      if (st.mother.followsPath) moveAlong(st.mother, spd * dt, st);
      else { const dx = st.escortee.pos.x - st.mother.pos.x, dy = st.escortee.pos.y - st.mother.pos.y; const d = Math.hypot(dx, dy); if (d > 0.001) { st.mother.pos.x += (dx / d) * spd * dt; st.mother.pos.y += (dy / d) * spd * dt; } }
      break;
    }
    case 'burst': st.mother.burstLeft -= dt; if (st.mother.burstLeft <= 0) exitBurst(st); break;
  }
  if (st.mother.state !== 'idle') tickRhythm(st, dt);
  for (let i = st.enemies.length - 1; i >= 0; i--) {
    const e = st.enemies[i]!; moveAlong(e, e.speed * dt, st);
    if (Math.hypot(e.pos.x - st.escortee.pos.x, e.pos.y - st.escortee.pos.y) <= 0.5) { st.contacts.push({ t: st.time, enemy: e.name }); st.enemies.splice(i, 1); }
  }
}

const SSI = 0.5;
export function simulate(doc: StageDocument, params: SimParams, catalog: readonly EnemyCatalogEntry[]): SimResult {
  const st = initState(doc, params, catalog);
  while (!st.escortee.arrived && st.time < st.maxSeconds) {
    step(st); st.time += st.dt;
    const si = Math.round(st.time / SSI);
    if (st.samples.length === 0 || Math.abs(st.samples[st.samples.length - 1]!.t / SSI - si) > 0.01) {
      st.samples.push({ t: st.time, escortee: { ...st.escortee.pos }, mother: { ...st.mother.pos }, distance: Math.hypot(st.escortee.pos.x - st.mother.pos.x, st.escortee.pos.y - st.mother.pos.y), alive: st.enemies.length });
    }
  }
  const total = st.spawnEvents.length; const sbe: Record<string, number> = {};
  for (const se of st.spawnEvents) sbe[se.enemy] = (sbe[se.enemy] ?? 0) + 1;
  const ic: Record<string, number> = {};
  for (const d of doc.economy.difficulties) ic[d.difficulty] = doc.economy.startingResource + d.killReward * total + d.resourcePerSecond * st.time;
  if (st.time >= st.maxSeconds) st.warnings.push('보호대상이 도착하지 못했다');
  return { seed: params.seed, dt: params.dt, stageSeconds: st.time, totalSpawned: total, spawnedByEnemy: sbe, incomeCeiling: ic, bursts: st.bursts, samples: st.samples, spawnEvents: st.spawnEvents, contacts: st.contacts, warnings: st.warnings };
}

