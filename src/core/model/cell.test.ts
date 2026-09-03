/**
 * 목적: 셀 문자 매핑이 왕복하고, 통행 술어가 게임 규칙과 같은지 확인한다.
 * 왜 이 구조인가: 문자 매핑이 어긋나면 맵 전체가 조용히 다른 그림이 되고, 통행 술어가 어긋나면
 *   도달 영역 계산이 통째로 틀린다 — 둘 다 눈으로는 늦게 발견된다.
 * 바꾸면 안 되는 것: "도로는 아군에게 벽" 단언. 이걸 완화하면 게임과 다른 도달 영역이 나온다.
 * 근거: SDD-02 §2-2 [D-02-03], SDD-04 §7 [D-04-07]
 */
import { describe, expect, it } from 'vitest';
import {
  CELL_TO_CHAR,
  Cell,
  PALETTE_ORDER,
  cellFromChar,
  isAllyWalkable,
  isRuntimeWalkable,
} from './cell.js';

const ALL: readonly Cell[] = [
  Cell.Blocked,
  Cell.Ground,
  Cell.Road,
  Cell.Buildable,
  Cell.VillageSlot,
  Cell.Water,
  Cell.Empty,
];

describe('Cell', () => {
  it('문자 매핑이 왕복한다', () => {
    for (const cell of ALL) {
      expect(cellFromChar(CELL_TO_CHAR[cell])).toBe(cell);
    }
  });

  it('문자가 7종이고 서로 다르다', () => {
    expect(new Set(ALL.map((c) => CELL_TO_CHAR[c])).size).toBe(7);
  });

  it('TOON 인용을 강제하는 문자를 쓰지 않는다', () => {
    // 왜: `#`·`-` 로 시작하거나 구분자·구조 문자를 쓰면 맵 행마다 따옴표가 붙는다 (SDD-02 §2-2).
    for (const cell of ALL) {
      expect(CELL_TO_CHAR[cell]).not.toMatch(/[#\-:,"\\[\]{}\s]/);
    }
  });

  it('모르는 문자는 undefined', () => {
    expect(cellFromChar('X')).toBeUndefined();
    expect(cellFromChar('')).toBeUndefined();
  });

  it('아군에게 도로는 벽이다', () => {
    expect(isAllyWalkable(Cell.Road)).toBe(false);
    expect(isAllyWalkable(Cell.Buildable)).toBe(true);
    expect(isAllyWalkable(Cell.Ground)).toBe(true);
    expect(isAllyWalkable(Cell.VillageSlot)).toBe(true);
    expect(isAllyWalkable(Cell.Water)).toBe(false);
    expect(isAllyWalkable(Cell.Blocked)).toBe(false);
    expect(isAllyWalkable(Cell.Empty)).toBe(false);
  });

  it('런타임 통행은 도로를 포함하고 물·벽·빈칸을 뺀다', () => {
    expect(isRuntimeWalkable(Cell.Road)).toBe(true);
    expect(isRuntimeWalkable(Cell.Water)).toBe(false);
    expect(isRuntimeWalkable(Cell.Blocked)).toBe(false);
    expect(isRuntimeWalkable(Cell.Empty)).toBe(false);
  });

  it('팔레트 순서가 7종을 빠짐없이 담는다', () => {
    expect([...PALETTE_ORDER].sort((a, b) => a - b)).toEqual([...ALL].sort((a, b) => a - b));
  });

  it('게임 CellType 숫자값을 유지한다', () => {
    // 출처: Assets/_Project/Scripts/Runtime/Grid/CellType.cs:12-20
    expect([Cell.Blocked, Cell.Ground, Cell.Road, Cell.Buildable, Cell.VillageSlot, Cell.Water]).toEqual(
      [0, 1, 2, 3, 4, 5],
    );
  });
});
