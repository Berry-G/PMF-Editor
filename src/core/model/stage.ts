/**
 * 목적: `StageDocument` 타입과 하위 타입 전부. 파일과 1:1 대응.
 * 왜 이 구조인가: UI 상태는 여기 없음. 필드명과 타입은 게임 StageDefinition.cs 와 대응.
 * 바꾸면 안 되는 것: 필드 추가/삭제 = 스키마 버전 상승.
 * 근거: SDD-02 §1 [D-02-01], SDD-08 §2 [D-08-02]
 */
import { SCHEMA } from '../schema.js';

export interface XY { readonly x: number; readonly y: number }
export interface MapData { width: number; height: number; origin: [number, number]; cells: Uint8Array }
export type NodeRole = 'start' | 'exit' | 'branch' | 'waypoint';
export interface PathNode { id: string; x: number; y: number; role: NodeRole }
export type Agent = 'Escortee' | 'Enemy' | 'Ally';
export interface PathEdge { from: string; to: string; allowed: ReadonlyArray<Agent>; bidirectional: boolean; shortcut: boolean }
export interface PathData { nodes: PathNode[]; edges: PathEdge[] }
export interface SpawnEntry { enemy: string; weight: number }
export interface CurveKey { t: number; mul: number }
export interface SpawnData { volleyCount: number; volleySpacing: number; restSeconds: number; telegraphSeconds: number; table: SpawnEntry[]; healthByProgress: CurveKey[] }
export interface BurstData { triggerNodeIds: string[]; duration: number; volleyCount: number; restSeconds: number; recoverySpeedMultiplier: number; recoverySeconds: number }
export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export interface DifficultyTier { difficulty: Difficulty; displayName: string; killReward: number; resourcePerSecond: number }
export interface EconomyData { startingResource: number; shortcutCost: number; difficulties: DifficultyTier[] }
export interface EscorteeData { speed: number; maxHealth: number }
export interface MotherData { speed: number; spawnDelay: number; followsPath: boolean }
export interface PresentationData { uiSlowMotionScale: number; shotLineSeconds: number; magicMissileSpeed: number; hitFlashSeconds: number; debrisCount: number; debrisSeconds: number; healthBarHideWhenFull: boolean; masterVolume: number }
export interface ToggleData { alliesCanDieWhileMarching: boolean; enemiesTargetAllies: boolean }
export interface StageDocument { schema: typeof SCHEMA; name: string; map: MapData; path: PathData; spawn: SpawnData; burst: BurstData; economy: EconomyData; escortee: EscorteeData; mother: MotherData; presentation: PresentationData; toggles: ToggleData }