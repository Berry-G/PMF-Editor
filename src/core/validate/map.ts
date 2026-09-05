/**
 * 목적: 맵 검증 규칙 V-M03~V-M08 구현.
 * 왜 이 구조인가: V-M01/M02 는 디코더가 잡으므로 validate 는 나머지만 본다.
 * 씨앗 기대값: B 381, R 51, V 2, W 36, ~ 10, . 0, _ 96.
 *   도달 가능 B 203, 도달 불가 178 (SDD-06 §2).
 * 바꾸면 안 되는 것: 메시지 템플릿 — 임포터 C# 과 같은 문장이어야 한다.
 * 근거: SDD-09 §3-2 [D-09-03-2], SDD-08 §4 [D-08-04]
 */
import type { StageDocument } from '../model/stage.js';
import type { Issue } from './index.js';
import { Cell } from '../model/cell.js';
import { countCells, findCells } from '../model/map.js';
import { computeReachability } from '../geometry/reach.js';
import { floodFill } from '../geometry/flood.js';

export function validateMap(doc: StageDocument): Issue[] {
  const issues: Issue[] = [];
  const map = doc.map;
  const counts = countCells(map);

  // V-M08 (먼저 — 크기가 틀리면 나머지가 의미 없음)
  if (map.width < 8 || map.width > 256 || map.height < 8 || map.height > 256) {
    issues.push({
      id: 'V-M08', severity: 'error', path: 'map',
      message: `맵 크기 ${map.width}×${map.height} — 8~256 사이여야 한다`,
    });
  }

  // V-M03: 마을
  if ((counts[Cell.VillageSlot] ?? 0) === 0) {
    issues.push({ id: 'V-M03', severity: 'error', path: 'map', message: '마을(V)이 없다. 아군을 고용할 곳이 없다' });
  }

  // V-M04: 배치 칸
  if ((counts[Cell.Buildable] ?? 0) === 0) {
    issues.push({ id: 'V-M04', severity: 'error', path: 'map', message: '배치 가능 칸(B)이 없다' });
  }

  // V-M05: 도로 분할
  const roadCells = findCells(map, Cell.Road);
  if (roadCells.length > 0) {
    const seen = new Uint8Array(map.width * map.height);
    const components: Array<typeof roadCells> = [];
    for (const rc of roadCells) {
      const i = rc.y * map.width + rc.x;
      if (seen[i]) continue;
      const comp = floodFill(map, rc.x, rc.y, c => c === Cell.Road);
      for (const c of comp) seen[c.y * map.width + c.x] = 1;
      components.push(comp);
    }
    if (components.length > 1) {
      const second = components[1]!;
      issues.push({
        id: 'V-M05', severity: 'warning', path: 'map',
        message: `도로가 ${components.length}조각으로 끊겨 있다. 첫 조각 밖의 도로 칸 예: (${second[0]!.x},${second[0]!.y})`,
        cells: second,
      });
    }
  }

  // V-M06/V-M07: 도달 영역
  const reach = computeReachability(map);
  const unreachable = reach.totalBuildable - reach.reachableBuildable;
  // 왜 조건 없이 항상 내는가: 이 숫자는 오류 신호가 아니라 **상시 계기판**이다.
  //   기획자가 맵을 그리는 내내 "지금 몇 칸이 닿지 않는가" 를 보고 있어야 한다
  //   (SDD-03 §4 — 레이어를 꺼도 상태줄 숫자는 남는다). 0 일 때 침묵하면 계기가 죽은 것인지
  //   0 인 것인지 구분할 수 없다. 심각도만 비율에 따라 올린다.
  const ratio = reach.totalBuildable === 0 ? 0 : unreachable / reach.totalBuildable;
  issues.push({
    id: 'V-M06',
    severity: ratio > 0.5 ? 'warning' : 'info',
    path: '',
    message: `마을에서 갈 수 없는 배치 칸이 ${unreachable}/${reach.totalBuildable} (${Math.round(ratio * 100)}%) 다`,
  });

  for (const pv of reach.perVillage) {
    if (pv.buildable === 0) {
      issues.push({
        id: 'V-M07', severity: 'error', path: 'map',
        message: `마을 (${pv.village.x},${pv.village.y}) 에서 갈 수 있는 배치 칸이 없다`,
        cells: [pv.village],
      });
    }
  }

  return issues;
}