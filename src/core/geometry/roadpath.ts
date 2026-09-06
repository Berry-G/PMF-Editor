/**
 * 목적: 도로 칸을 따라 `start` → `exit` 최단 경로를 찾고, **꺾이는 칸마다 노드**를 찍어
 *   축 정렬 엣지로 잇는 경로 그래프 초안을 만든다. 저작 보조용 순수 함수.
 * 왜 이 구조인가: 코너를 손으로 찍으면 한 칸씩 어긋나 V-P03 이 터진다 — 그 실수를 없애려고
 *   기계가 찍는다. **런타임 추론이 아니다.** 게임은 도로에서 그래프를 추론하지 않는다
 *   (게임 `TASKS-P1-prototype.md:568` "노드 자동 생성을 만들지 마라 — 분기와 지름길을
 *   표현할 수 없다"). 여기서 만든 것은 파일에 **명시적 노드·엣지로 저장**되고, 기획자가
 *   그 위에 분기·지름길을 얹는다. 게임 쪽은 아무것도 바뀌지 않는다.
 * 바꾸면 안 되는 것: 이웃 순서(→ ← ↑ ↓)와 BFS. 순서가 바뀌면 같은 맵에서 다른 경로가 나와
 *   골든이 흔들린다. 코너 판정은 "방향이 바뀌는 칸" 이고, 그 칸이 정확히 노드 자리다
 *   (게임 `GreyboxMapData.cs:86-89`). 분기·지름길은 **만들지 않는다** — 도로만 봐서는 알 수 없다.
 * 근거: SDD-02 §3-3 [D-02-04], SDD-09 §4-6 [D-09-04], ADR-0004(게임)
 */
import type { MapData } from '../model/stage.js';
import type { PathNode, PathEdge } from '../model/stage.js';
import { cellAt, inBounds } from '../model/map.js';
import { Cell } from '../model/cell.js';
import type { XY } from './xy.js';

export interface RoadPathResult {
  ok: boolean;
  /** 실패 사유. 성공이면 빈 문자열. */
  reason: string;
  nodes: PathNode[];
  edges: PathEdge[];
}

/** 이웃 순서 고정 — 결정론. 바꾸면 같은 맵에서 다른 경로가 나온다. */
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

function isRoad(map: MapData, x: number, y: number): boolean {
  return inBounds(map, x, y) && cellAt(map, x, y) === Cell.Road;
}

/** 도로 칸만 밟는 BFS. 도로는 격자 위에서 균일 비용이라 BFS 가 곧 최단이다. */
function shortestRoadCells(map: MapData, from: XY, to: XY): XY[] | null {
  const W = map.width, H = map.height;
  const prev = new Int32Array(W * H).fill(-1);
  const seen = new Uint8Array(W * H);
  const q: number[] = [from.y * W + from.x];
  seen[from.y * W + from.x] = 1;
  const goal = to.y * W + to.x;

  for (let head = 0; head < q.length; head++) {
    const cur = q[head]!;
    if (cur === goal) break;
    const cx = cur % W, cy = (cur - cx) / W;
    for (let i = 0; i < 4; i++) {
      const nx = cx + DX[i]!, ny = cy + DY[i]!;
      if (!isRoad(map, nx, ny)) continue;
      const ni = ny * W + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!seen[goal]) return null;

  const out: XY[] = [];
  for (let cur = goal; cur !== -1; cur = prev[cur]!) {
    out.push({ x: cur % W, y: (cur - (cur % W)) / W });
    if (cur === from.y * W + from.x) break;
  }
  out.reverse();
  return out;
}

/**
 * 도로를 따라 `start`(from) → `exit`(to) 경로 그래프 초안을 만든다.
 * 노드 id 는 `N00_start … Nnn_exit` — 씨앗과 같은 관례다 (ADR-E06: 툴이 나중에 재번호하지 않는다).
 */
export function buildPathFromRoad(map: MapData, from: XY, to: XY): RoadPathResult {
  const fail = (reason: string): RoadPathResult => ({ ok: false, reason, nodes: [], edges: [] });

  if (!isRoad(map, from.x, from.y)) return fail(`시작 칸 (${from.x}, ${from.y}) 이 도로(R)가 아니다`);
  if (!isRoad(map, to.x, to.y)) return fail(`탈출 칸 (${to.x}, ${to.y}) 이 도로(R)가 아니다`);
  if (from.x === to.x && from.y === to.y) return fail('시작과 탈출이 같은 칸이다');

  const cells = shortestRoadCells(map, from, to);
  if (cells === null) return fail('시작에서 탈출까지 도로가 이어져 있지 않다');

  // 코너 = 진행 방향이 바뀌는 칸. 양 끝은 무조건 노드다.
  // 왜 코너에만 찍는가: 직선 구간 중간에 노드를 두면 엣지만 늘고 얻는 게 없다.
  //   반대로 코너를 빼면 그 구간이 대각선이 되어 V-P03 에 걸린다.
  const corners: XY[] = [cells[0]!];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = cells[i - 1]!, b = cells[i]!, c = cells[i + 1]!;
    const d1x = b.x - a.x, d1y = b.y - a.y;
    const d2x = c.x - b.x, d2y = c.y - b.y;
    if (d1x !== d2x || d1y !== d2y) corners.push(b);
  }
  corners.push(cells[cells.length - 1]!);

  const last = corners.length - 1;
  const nodes: PathNode[] = corners.map((c, i) => ({
    id: i === 0 ? 'N00_start' : i === last ? `N${String(i).padStart(2, '0')}_exit` : `N${String(i).padStart(2, '0')}`,
    x: c.x, y: c.y,
    role: i === 0 ? 'start' : i === last ? 'exit' : 'waypoint',
  }));

  // 도로 본선은 양방향이다 — 적과 모체가 보호대상 쪽으로 거슬러 온다.
  // 지름길은 여기서 만들지 않는다: 도로만 봐서는 어느 구간이 지름길인지 알 수 없다.
  const edges: PathEdge[] = [];
  for (let i = 0; i < last; i++) {
    edges.push({
      from: nodes[i]!.id, to: nodes[i + 1]!.id,
      allowed: ['Escortee', 'Enemy', 'Ally'],
      bidirectional: true,
      shortcut: false,
    });
  }

  return { ok: true, reason: '', nodes, edges };
}
