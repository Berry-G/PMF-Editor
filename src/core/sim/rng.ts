/**
 * 목적: mulberry32 PRNG — 결정론적 시뮬레이션용.
 * 왜 이 구조인가: JS 내장 난수 대신 시드 있는 PRNG 로 재현 가능한 난수열을 만든다.
 *   게임 `MotherSpawner.PickFromSpawnTable` 과 같은 누적 차감 방식을 쓴다.
 * 바꾸면 안 되는 것: 수식 — 게임과 동일해야 한다. core 순수성 규칙(내장 난수 금지).
 * 근거: SDD-04 §2 [D-04-02], SDD-09 §7-1 [D-09-07-1]
 */

/** mulberry32 PRNG. 시드는 unsigned 32-bit 정수. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 스폰 표 추첨 — 게임 `MotherSpawner.PickFromSpawnTable` 과 동일.
 * `table` 의 `weight` 합이 0 이면 첫 번째 원소를 돌려준다 (게임 동작).
 */
export function pickFromTable(
  table: ReadonlyArray<{ enemy: string; weight: number }>,
  rnd: () => number,
): string {
  const total = table.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return table[0]?.enemy ?? 'Robot_Walker';
  let r = Math.floor(rnd() * total);
  for (const e of table) {
    if (r < e.weight) return e.enemy;
    r -= e.weight;
  }
  return table[table.length - 1]!.enemy;
}