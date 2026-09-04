/**
 * 목적: PaintCells 커맨드 + pasteCells. 셀 집합 변경. coalesce 지원.
 * 왜 이 구조인가: 드래그 스트로크를 합쳐 Undo 한 번에 스트로크가 돌아간다.
 *   coalesce 는 `_delta` 맵을 합친다 — `as any` 로 Command 에 없는 속성을 처리.
 *   pasteCells 는 클립보드 영역을 anchor 기준으로 붙여넣고, 맵 밖 칸은 잘라낸다.
 *   paintCells 와 같은 delta 방식이라 Undo/Redo 가 동일하다.
 * 바꾸면 안 되는 것: apply/revert 가 새 문서 반환. pasteCells 가 맵 밖 칸을 잘라내는 것.
 * 근거: SDD-09 §8-1 [D-09-08-1], SDD-08 §7 [D-08-07]
 */
import type { Command } from './command.js';
import type { StageDocument, MapData } from '../model/stage.js';
import { Cell } from '../model/cell.js';
import { withCells, cellAt } from '../model/map.js';

export function paintCells(
  map: MapData,
  changes: ReadonlyArray<{ x: number; y: number; cell: Cell }>,
  label: string,
): Command {
  const delta = new Map<number, { before: number; after: number }>();
  for (const c of changes) {
    const i = c.y * map.width + c.x;
    const b = cellAt(map, c.x, c.y);
    if (b !== c.cell) {
      if (delta.has(i)) { delta.get(i)!.after = c.cell; }
      else { delta.set(i, { before: b, after: c.cell }); }
    }
  }
  const w = map.width;
  const toArr = (sel: 'before' | 'after') =>
    [...delta.entries()].map(([i, v]) => ({ x: i % w, y: Math.floor(i / w), cell: v[sel] as Cell }));

  return {
    label,
    apply(doc: StageDocument) { return { ...doc, map: withCells(doc.map, toArr('after')) }; },
    revert(doc: StageDocument) { return { ...doc, map: withCells(doc.map, toArr('before')) }; },
    coalesce(next: Command) {
      const nd = (next as any)._delta as Map<number, { before: number; after: number }> | undefined;
      if (!nd) return null;
      for (const [i, v] of nd) { if (delta.has(i)) delta.get(i)!.after = v.after; else delta.set(i, v); }
      return this;
    },
    _delta: delta,
  } as unknown as Command;
}

/** 클립보드 = 복사한 직사각형 영역. cells 는 Uint8Array (값은 Cell). */
export interface Clipboard { width: number; height: number; cells: Uint8Array }

/** 클립보드 영역을 anchor 셀 기준으로 붙여넣는다. 맵 밖 칸은 잘라낸다. */
export function pasteCells(map: MapData, anchor: { x: number; y: number }, clip: Clipboard): Command {
  const changes: Array<{ x: number; y: number; cell: Cell }> = [];
  for (let cy = 0; cy < clip.height; cy++) {
    for (let cx = 0; cx < clip.width; cx++) {
      const x = anchor.x + cx;
      const y = anchor.y + cy;
      if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue; // 왜: 맵 밖은 잘라낸다
      changes.push({ x, y, cell: clip.cells[cy * clip.width + cx] as Cell });
    }
  }
  return paintCells(map, changes, '붙여넣기 ' + clip.width + '×' + clip.height);
}