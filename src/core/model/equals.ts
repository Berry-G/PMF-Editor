/**
 * 목적: 두 `StageDocument` 의 깊은 비교.
 * 왜 이 구조인가: JS 객체의 `===` 는 참조 비교라서, 커맨드가 새 문서를 돌려줬을 때 내용이 같은지 알 수 없다.
 *   이 함수는 `cells` 의 `Uint8Array` 와 중첩 객체·배열까지 재귀 비교한다.
 * 바꾸면 안 되는 것: `cells` 비교에 `Buffer.compare` 또는 `toString()` 을 쓰지 마라 — 환경에 따라
 *   결과가 다를 수 있다. `Uint8Array` 바이트 단위 비교. 필드가 추가되면 여기도 함께 추가해야 한다.
 * 근거: SDD-08 §2 [D-08-02], SDD-06 §2 [D-06-02]
 */
import type { StageDocument, PathNode, PathEdge, SpawnEntry, CurveKey, DifficultyTier } from './stage.js';

export function stageEquals(a: StageDocument, b: StageDocument): boolean {
  if (a.schema !== b.schema) return false;
  if (a.name !== b.name) return false;
  if (!mapEquals(a.map, b.map)) return false;
  if (!pathEquals(a.path, b.path)) return false;
  if (!spawnEquals(a.spawn, b.spawn)) return false;
  if (!burstEquals(a.burst, b.burst)) return false;
  if (!economyEquals(a.economy, b.economy)) return false;
  if (!escorteeEquals(a.escortee, b.escortee)) return false;
  if (!motherEquals(a.mother, b.mother)) return false;
  if (!presentationEquals(a.presentation, b.presentation)) return false;
  if (!togglesEquals(a.toggles, b.toggles)) return false;
  return true;
}

function mapEquals(a: { width: number; height: number; origin: [number, number]; cells: Uint8Array }, b: { width: number; height: number; origin: [number, number]; cells: Uint8Array }): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.origin[0] !== b.origin[0] || a.origin[1] !== b.origin[1]) return false;
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
}
function pathEquals(a: { nodes: PathNode[]; edges: PathEdge[] }, b: { nodes: PathNode[]; edges: PathEdge[] }): boolean {
  if (a.nodes.length !== b.nodes.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const na = a.nodes[i]!; const nb = b.nodes[i]!;
    if (na.id !== nb.id || na.x !== nb.x || na.y !== nb.y || na.role !== nb.role) return false;
  }
  if (a.edges.length !== b.edges.length) return false;
  for (let i = 0; i < a.edges.length; i++) {
    const ea = a.edges[i]!; const eb = b.edges[i]!;
    if (ea.from !== eb.from || ea.to !== eb.to || ea.bidirectional !== eb.bidirectional || ea.shortcut !== eb.shortcut) return false;
    if (ea.allowed.length !== eb.allowed.length) return false;
    for (let j = 0; j < ea.allowed.length; j++) {
      if (ea.allowed[j] !== eb.allowed[j]) return false;
    }
  }
  return true;
}

function spawnEquals(a: { volleyCount: number; volleySpacing: number; restSeconds: number; telegraphSeconds: number; table: SpawnEntry[]; healthByProgress: CurveKey[] }, b: { volleyCount: number; volleySpacing: number; restSeconds: number; telegraphSeconds: number; table: SpawnEntry[]; healthByProgress: CurveKey[] }): boolean {
  if (a.volleyCount !== b.volleyCount || a.volleySpacing !== b.volleySpacing || a.restSeconds !== b.restSeconds || a.telegraphSeconds !== b.telegraphSeconds) return false;
  if (a.table.length !== b.table.length) return false;
  for (let i = 0; i < a.table.length; i++) {
    if (a.table[i]!.enemy !== b.table[i]!.enemy || a.table[i]!.weight !== b.table[i]!.weight) return false;
  }
  if (a.healthByProgress.length !== b.healthByProgress.length) return false;
  for (let i = 0; i < a.healthByProgress.length; i++) {
    if (a.healthByProgress[i]!.t !== b.healthByProgress[i]!.t || a.healthByProgress[i]!.mul !== b.healthByProgress[i]!.mul) return false;
  }
  return true;
}

function burstEquals(a: { triggerNodeIds: string[]; duration: number; volleyCount: number; restSeconds: number; recoverySpeedMultiplier: number; recoverySeconds: number }, b: { triggerNodeIds: string[]; duration: number; volleyCount: number; restSeconds: number; recoverySpeedMultiplier: number; recoverySeconds: number }): boolean {
  if (a.duration !== b.duration || a.volleyCount !== b.volleyCount || a.restSeconds !== b.restSeconds || a.recoverySpeedMultiplier !== b.recoverySpeedMultiplier || a.recoverySeconds !== b.recoverySeconds) return false;
  if (a.triggerNodeIds.length !== b.triggerNodeIds.length) return false;
  for (let i = 0; i < a.triggerNodeIds.length; i++) {
    if (a.triggerNodeIds[i] !== b.triggerNodeIds[i]) return false;
  }
  return true;
}

function economyEquals(a: { startingResource: number; shortcutCost: number; difficulties: DifficultyTier[] }, b: { startingResource: number; shortcutCost: number; difficulties: DifficultyTier[] }): boolean {
  if (a.startingResource !== b.startingResource || a.shortcutCost !== b.shortcutCost) return false;
  if (a.difficulties.length !== b.difficulties.length) return false;
  for (let i = 0; i < a.difficulties.length; i++) {
    const da = a.difficulties[i]!; const db = b.difficulties[i]!;
    if (da.difficulty !== db.difficulty || da.displayName !== db.displayName || da.killReward !== db.killReward || da.resourcePerSecond !== db.resourcePerSecond) return false;
  }
  return true;
}

function escorteeEquals(a: { speed: number; maxHealth: number }, b: { speed: number; maxHealth: number }): boolean {
  return a.speed === b.speed && a.maxHealth === b.maxHealth;
}

function motherEquals(a: { speed: number; spawnDelay: number; followsPath: boolean }, b: { speed: number; spawnDelay: number; followsPath: boolean }): boolean {
  return a.speed === b.speed && a.spawnDelay === b.spawnDelay && a.followsPath === b.followsPath;
}

function presentationEquals(a: { uiSlowMotionScale: number; shotLineSeconds: number; magicMissileSpeed: number; hitFlashSeconds: number; debrisCount: number; debrisSeconds: number; healthBarHideWhenFull: boolean; masterVolume: number }, b: { uiSlowMotionScale: number; shotLineSeconds: number; magicMissileSpeed: number; hitFlashSeconds: number; debrisCount: number; debrisSeconds: number; healthBarHideWhenFull: boolean; masterVolume: number }): boolean {
  return a.uiSlowMotionScale === b.uiSlowMotionScale && a.shotLineSeconds === b.shotLineSeconds && a.magicMissileSpeed === b.magicMissileSpeed && a.hitFlashSeconds === b.hitFlashSeconds && a.debrisCount === b.debrisCount && a.debrisSeconds === b.debrisSeconds && a.healthBarHideWhenFull === b.healthBarHideWhenFull && a.masterVolume === b.masterVolume;
}

function togglesEquals(a: { alliesCanDieWhileMarching: boolean; enemiesTargetAllies: boolean }, b: { alliesCanDieWhileMarching: boolean; enemiesTargetAllies: boolean }): boolean {
  return a.alliesCanDieWhileMarching === b.alliesCanDieWhileMarching && a.enemiesTargetAllies === b.enemiesTargetAllies;
}