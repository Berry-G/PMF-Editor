/**
 * 목적: 마을에서 도달 가능한 Buildable 칸의 비율 계산 (V-M06/V-M07).
 * 왜 이 구조인가: 아군은 도로(R)를 밟지 않으므로, 마을에서 B 까지 갈 수 있는 경로를 4-연결로 계산한다.
 *   이 결과는 V-M06/V-M07 검증 규칙과 도달 영역 레이어가 쓴다. 마을이 여러 개여도 같은 구역
 *   (서로 닿아 있으면) 하나로 합친다.
 * 바꾸면 안 되는 것: `isAllyWalkable` 에서 Road 가 벽인 규칙 — 아군이 도로를 밟지 않는 건 게임 규칙이다.
 *   `regionOf` 의 인덱스(의사 Int32Array).
 * 근거: SDD-04 §7 [D-04-07], SDD-09 §4-5 [D-09-04-5], SDD-08 §4 [D-08-04]
 */
import type { XY, MapData } from '../model/stage.js';
import { Cell, isAllyWalkable } from '../model/cell.js';
import { indexOf, findCells, countCells, cellAt } from '../model/map.js';
import { floodFill } from './flood.js';

export interface Reachability {
  villages: XY[];
  regionOf: Int32Array;          // cells 와 같은 길이. 도달 가능한 구역 번호(0..), 아니면 -1
  reachableBuildable: number;
  totalBuildable: number;
  perVillage: ReadonlyArray<{ village: XY; region: number; buildable: number }>;
}

export function computeReachability(map: MapData): Reachability {
  const villages = findCells(map, Cell.VillageSlot);
  const w = map.width, h = map.height;
  const regionOf = new Int32Array(w * h).fill(-1);
  const totals = countCells(map);
  const totalBuildable = totals[Cell.Buildable] ?? 0;
  const perVillage: Array<{ village: XY; region: number; buildable: number }> = [];

  let regions = 0;
  const regionBuildable: number[] = [];

  for (const v of villages) {
    const i = indexOf(map, v.x, v.y);
    if (regionOf[i] !== -1) {
      perVillage.push({ village: v, region: regionOf[i]!, buildable: regionBuildable[regionOf[i]!] ?? 0 });
      continue;
    }
    const cells = floodFill(map, v.x, v.y, isAllyWalkable);
    let bCount = 0;
    for (const c of cells) {
      regionOf[indexOf(map, c.x, c.y)] = regions;
      if (cellAt(map, c.x, c.y) === Cell.Buildable) bCount++;
    }
    regionBuildable.push(bCount);
    perVillage.push({ village: v, region: regions, buildable: bCount });
    regions++;
  }

  let reachableBuildable = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (regionOf[i] !== -1 && cellAt(map, x, y) === Cell.Buildable) reachableBuildable++;
    }
  }

  return { villages, regionOf, reachableBuildable, totalBuildable, perVillage };
}