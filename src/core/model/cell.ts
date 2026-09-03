/**
 * 목적: 격자 셀 종류와 문자 매핑, 통행 술어. 맵의 가장 작은 단위.
 * 왜 이 구조인가: 숫자 값을 게임 `CellType` 과 **같게** 두어 임포터가 변환 없이 `byte[]` 로 넘긴다.
 *   `Empty=255` 만 툴 전용인데, 게임에서 "타일이 없는 칸" 은 런타임에 Blocked 로 읽히지만
 *   화면과 왕복 충실도가 다르므로 벽과 합치면 안 된다.
 * 바꾸면 안 되는 것: enum 숫자값(게임 직렬화와 통계 인덱스가 묶여 있다), 문자 7종(TOON 인용
 *   강제 조건에 걸리지 않도록 고른 것이다 — 새 문자를 넣으면 SDD-09 §2-2 판정을 다시 확인하라),
 *   `isAllyWalkable` 에서 Road 를 빼는 것(아군은 도로를 밟지 않는다).
 * 근거: SDD-02 §2-2 [D-02-03], SDD-04 §7 [D-04-07], SDD-08 §2 [D-08-02]
 */

// 출처: Assets/_Project/Scripts/Runtime/Grid/CellType.cs:12-20 — 값을 바꾸지 마라
export enum Cell {
  Blocked = 0,
  Ground = 1,
  Road = 2,
  Buildable = 3,
  VillageSlot = 4,
  Water = 5,
  /** 툴 전용. 타일이 없는 칸 — 게임 런타임에서는 Blocked 로 읽힌다 (출처: GridSystem.cs:76) */
  Empty = 255,
}

export const CELL_TO_CHAR: Readonly<Record<Cell, string>> = {
  [Cell.Empty]: '_',
  [Cell.Ground]: '.',
  [Cell.Road]: 'R',
  [Cell.Buildable]: 'B',
  [Cell.VillageSlot]: 'V',
  [Cell.Blocked]: 'W',
  [Cell.Water]: '~',
};

/** 한국어 표시 이름. 검증 메시지와 팔레트가 같은 문구를 쓴다. */
export const CELL_LABEL: Readonly<Record<Cell, string>> = {
  [Cell.Empty]: '빈칸',
  [Cell.Ground]: '땅',
  [Cell.Road]: '도로',
  [Cell.Buildable]: '배치 가능',
  [Cell.VillageSlot]: '마을',
  [Cell.Blocked]: '벽',
  [Cell.Water]: '물',
};

const CHAR_TO_CELL: ReadonlyMap<string, Cell> = new Map(
  (Object.keys(CELL_TO_CHAR) as unknown as string[]).map((k) => {
    const cell = Number(k) as Cell;
    return [CELL_TO_CHAR[cell], cell] as const;
  }),
);

export function cellFromChar(ch: string): Cell | undefined {
  return CHAR_TO_CELL.get(ch);
}

/** 아군 유닛이 걸어갈 수 있는 칸. 도로는 **벽이다** — 아군은 도로를 밟지 않는다. */
export function isAllyWalkable(c: Cell): boolean {
  return c === Cell.Ground || c === Cell.Buildable || c === Cell.VillageSlot;
}

/** 게임 `GridSystem.IsWalkable` 과 같은 판정 (적·보호대상 기준). */
// 출처: Assets/_Project/Scripts/Runtime/Grid/GridSystem.cs:140-155
export function isRuntimeWalkable(c: Cell): boolean {
  return c !== Cell.Blocked && c !== Cell.Water && c !== Cell.Empty;
}

/** 팔레트 순서 = 쓰는 빈도 순 (SDD-03 §2). 단축키 1~7 이 이 배열의 인덱스다. */
export const PALETTE_ORDER: readonly Cell[] = [
  Cell.Buildable,
  Cell.Road,
  Cell.Blocked,
  Cell.Water,
  Cell.VillageSlot,
  Cell.Ground,
  Cell.Empty,
];
