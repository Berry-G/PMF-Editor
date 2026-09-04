/**
 * 목적: 시뮬레이션 파라미터와 기본 카탈로그.
 * 왜 이 구조인가: 시뮬은 전투 없이 판의 뼈대(판 길이·스폰 수·수입 천장)만 계산한다.
 *   DEFAULT_CATALOG 값은 게임 Robot_*.asset 에서 가져온 사본.
 * 바꾸면 안 되는 것: DEFAULT_CATALOG 값(게임 Robot_*.asset).
 * 근거: SDD-04 §1§3 [D-04-01/03], SDD-08 §6 [D-08-06]
 */
export interface EnemyCatalogEntry { name: string; moveSpeed: number }

export const DEFAULT_CATALOG: readonly EnemyCatalogEntry[] = [
  { name: 'Robot_Walker', moveSpeed: 0.7 },
  { name: 'Robot_Scout', moveSpeed: 1.19 },
];

export interface SimParams { seed: number; dt: number; shortcutOpenAt: number | null; maxSeconds: number }

export const DEFAULT_SIM_PARAMS: SimParams = { seed: 1, dt: 1 / 30, shortcutOpenAt: null, maxSeconds: 600 };