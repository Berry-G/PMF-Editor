/**
 * 목적: StageDocument → TOON 정규 출력. 바이트 동일이 목표.
 * 왜 이 구조인가: 정규 출력이어야 골든 왕복 테스트 성립.
 *   주석은 씨앗과 같은 위치에 같은 문구, **같은 들여쓰기** 로 낸다 (SDD-09 §2-1).
 *   블록 안 주석(E1/E2/T1/H5)은 블록 키와 같은 들여쓰기(2칸)여야
 *   기획자가 읽을 때 어느 항목에 대한 설명인지 알 수 있다.
 * 바꾸면 안 되는 것: 섹션·키 순서, formatNumber, rows y 뒤집기.
 *   주석 문구·들여쓰기를 바꾸면 씨앗도 같이 바꾼다.
 * 근거: SDD-02 §6-1 [D-02-07/08], SDD-09 §2 [D-09-02]
 */
import { CELL_TO_CHAR, Cell as C } from '../model/cell.js';
import { SCHEMA } from '../schema.js';
import { formatNumber } from './number.js';
import { str } from './quote.js';
import type { Issue } from '../validate/index.js';
import type { StageDocument, MapData, PathData, SpawnData, BurstData, EconomyData, EscorteeData, MotherData, PresentationData, ToggleData } from '../model/stage.js';

// 왜: 아래 모든 주석 문자열은 씨앗 파일(Stage_Greybox.toon)과 정확히 같아야 한다.
//   바꾸면 docs/examples/Stage_Greybox.toon 도 같이 갱신한다.
const H1 = "# Prowl's Moving Factory — 스테이지 데이터 (pmf.stage/1)";
const H2 = '# 이 파일은 PMF Editor 가 만들고 읽는다. 손으로 고쳐도 되지만 저장은 툴로 하는 편이 안전하다.';
const H3 = '# 출처: 게임 프로젝트 2026-09-02 상태 — GreyboxMapData.cs(맵·경로) + Stage_Greybox.asset(수치)';
const H4 = '#       씨앗값(GreyboxFactory)이 아니라 .asset 실측값이다. 씨앗값은 튜닝 전 숫자라 믿으면 안 된다.';
const M1 = '# --- 맵 --------------------------------------------------------------';
const M2 = '# 문자: _ 빈칸(타일 없음 = 맵 밖, 런타임 Blocked)  . 땅  R 도로  B 배치가능  V 마을  W 벽  ~ 물';
const M3 = '# 맨 위 행이 y = height-1 (화면에 보이는 그대로). 열 인덱스가 x.';
const M4 = "# 벽을 '#' 로 쓰지 않는 이유: TOON 은 '#' 로 시작하는 줄을 주석으로 지운다.";
const P1 = '# --- 경로 --------------------------------------------------------------';
const P2 = '# id 는 게임의 GameObject 이름이 된다. 버스트 트리거가 이 이름으로 정확히 매칭하므로 툴은 재번호하지 않는다.';
const P3 = '# role: start(보호대상·모체 출발) / exit(탈출) / branch(도로 밖 분기, 아군 행군용) / waypoint(그 외)';
const P4 = '# 코너 노드는 도로가 꺾이는 셀에 정확히 놓여야 한다 — 한 칸 어긋나면 직선 구간이 코너를 대각선으로 가로지른다.';
// 왜 E1/E2/T1/H5 는 블록 키에 속하는 주석이라 들여쓰기 2칸을 앞에 붙인다 (씨앗과 동일).
const E1 = '  # allowed: All | Escortee | Enemy | Ally, 여러 개면 \'+\' 로 잇는다. 양방향 엣지는 한 번만 적는다 (게임이 반대 방향을 만든다).';
const E2 = '  # 지름길은 반드시 Escortee 만 — 적이 지나가면 지름길의 존재 이유가 사라진다 (ADR-0004).';
const S1 = '# --- 스폰 --------------------------------------------------------------';
const S2 = "# 리듬 = 묶음(volley) + 휴지(rest). 웨이브가 아니라 '호흡' 이다 (회의 결정 2).";
const S3 = '# 사이클 = (volleyCount-1)*volleySpacing + restSeconds = 9.4초에 4마리 → 0.426 마리/초';
const T1 = '  # enemy 는 EnemyDefinition 에셋 이름. guid 는 넣지 않는다 — 기획자가 다룰 수 없고 에셋을 옮기면 깨진다.';
const H5 = '  # 진행도(0~1)별 적 체력 배율. Unity AnimationCurve 를 (t, 배율) 표로 편 것. 난이도와 곱하지 않는다.';
const B1 = '# 버스트 = 모체가 추적을 멈추고 생산에 몰빵. 총량 보존 — 밀도만 바뀐다 (GDD §7).';
const N1 = '# --- 경제 --------------------------------------------------------------';
const N2 = '# 난이도는 경제로만 조절한다. 적 체력·데미지에 배율을 걸지 않는다 (ADR-0018).';
const O1 = '# 모체는 보호대상과 같은 start 노드에서 출발한다 (추격자 그림). 속도는 반드시 보호대상보다 느려야 한다.';
const G1 = '# GDD §13 미결정 사항 실험 토글 (D-03, D-04)';

function p(lines: string[], a: string[]): void {
  for (const l of a) lines.push(l);
}

// 왜 별칭인가: 숫자는 반드시 formatNumber 를 거쳐야 한다 (SDD-09 §2-3).
//   `+ 값` 문자열 결합은 -0 과 지수 표기를 그대로 흘려보내 왕복을 깨뜨린다.
const n = formatNumber;
const b = (v: boolean): string => (v ? 'true' : 'false');

function encodeMap(map: MapData, lines: string[]): void {
  p(lines, [M1, M2, M3, M4]);
  lines.push('map:');
  lines.push('  width: ' + n(map.width));
  lines.push('  height: ' + n(map.height));
  lines.push('  origin[2]: ' + n(map.origin[0]) + ',' + n(map.origin[1]));
  lines.push('  rows[' + n(map.height) + ']{row}:');
  // 왜 위에서부터 뒤집는가: 파일의 첫 행이 y = height-1 이어야 화면과 같은 그림이 된다 (SDD-02 §2-1).
  for (let r = 0; r < map.height; r++) {
    const y = map.height - 1 - r;
    let row = '';
    for (let x = 0; x < map.width; x++) row += CELL_TO_CHAR[map.cells[y * map.width + x] as C] ?? '?';
    lines.push('    ' + row);
  }
}

function encodePath(path: PathData, lines: string[]): void {
  p(lines, [P1, P2, P3, P4]);
  lines.push('path:');
  lines.push('  nodes[' + n(path.nodes.length) + ']{id,x,y,role}:');
  for (const node of path.nodes) {
    lines.push('    ' + str(node.id) + ',' + n(node.x) + ',' + n(node.y) + ',' + node.role);
  }
  p(lines, [E1, E2]);
  lines.push('  edges[' + n(path.edges.length) + ']{from,to,allowed,bidirectional,shortcut}:');
  for (const e of path.edges) {
    // 왜 셋 다면 'All' 인가: 게임 PathAgent.All 과 같은 뜻이고 씨앗도 그렇게 적혀 있다.
    const allowed = e.allowed.length === 3 ? 'All' : [...new Set(e.allowed)].join('+');
    lines.push(
      '    ' + str(e.from) + ',' + str(e.to) + ',' + allowed + ',' + b(e.bidirectional) + ',' + b(e.shortcut),
    );
  }
}

function encodeSpawn(spawn: SpawnData, lines: string[]): void {
  p(lines, [S1, S2, S3]);
  lines.push('spawn:');
  lines.push('  volleyCount: ' + n(spawn.volleyCount));
  lines.push('  volleySpacing: ' + n(spawn.volleySpacing));
  lines.push('  restSeconds: ' + n(spawn.restSeconds));
  lines.push('  telegraphSeconds: ' + n(spawn.telegraphSeconds));
  p(lines, [T1]);
  lines.push('  table[' + n(spawn.table.length) + ']{enemy,weight}:');
  for (const e of spawn.table) lines.push('    ' + str(e.enemy) + ',' + n(e.weight));
  p(lines, [H5]);
  lines.push('  healthByProgress[' + n(spawn.healthByProgress.length) + ']{t,mul}:');
  for (const k of spawn.healthByProgress) lines.push('    ' + n(k.t) + ',' + n(k.mul));
}

function encodeBurst(burst: BurstData, lines: string[]): void {
  p(lines, [B1]);
  lines.push('burst:');
  lines.push('  triggerNodeIds[' + n(burst.triggerNodeIds.length) + ']: ' + burst.triggerNodeIds.map(str).join(','));
  lines.push('  duration: ' + n(burst.duration));
  lines.push('  volleyCount: ' + n(burst.volleyCount));
  lines.push('  restSeconds: ' + n(burst.restSeconds));
  lines.push('  recoverySpeedMultiplier: ' + n(burst.recoverySpeedMultiplier));
  lines.push('  recoverySeconds: ' + n(burst.recoverySeconds));
}

function encodeEconomy(economy: EconomyData, lines: string[]): void {
  p(lines, [N1, N2]);
  lines.push('economy:');
  lines.push('  startingResource: ' + n(economy.startingResource));
  lines.push('  shortcutCost: ' + n(economy.shortcutCost));
  lines.push(
    '  difficulties[' + n(economy.difficulties.length) + ']{difficulty,displayName,killReward,resourcePerSecond}:',
  );
  for (const d of economy.difficulties) {
    // 왜 difficulty 는 인용하지 않는가: Easy/Normal/Hard 셋뿐인 enum 이라 인용 조건에 걸릴 수 없다.
    //   displayName 은 기획자가 자유롭게 쓰는 값이라 반드시 판정을 거친다.
    lines.push('    ' + d.difficulty + ',' + str(d.displayName) + ',' + n(d.killReward) + ',' + n(d.resourcePerSecond));
  }
}

function encodeEscortee(escortee: EscorteeData, lines: string[]): void {
  lines.push('escortee:');
  lines.push('  speed: ' + n(escortee.speed));
  lines.push('  maxHealth: ' + n(escortee.maxHealth));
}

function encodeMother(mother: MotherData, lines: string[]): void {
  p(lines, [O1]);
  lines.push('mother:');
  lines.push('  speed: ' + n(mother.speed));
  lines.push('  spawnDelay: ' + n(mother.spawnDelay));
  lines.push('  followsPath: ' + b(mother.followsPath));
}

function encodePresentation(pr: PresentationData, lines: string[]): void {
  lines.push('presentation:');
  lines.push('  uiSlowMotionScale: ' + n(pr.uiSlowMotionScale));
  lines.push('  shotLineSeconds: ' + n(pr.shotLineSeconds));
  lines.push('  magicMissileSpeed: ' + n(pr.magicMissileSpeed));
  lines.push('  hitFlashSeconds: ' + n(pr.hitFlashSeconds));
  lines.push('  debrisCount: ' + n(pr.debrisCount));
  lines.push('  debrisSeconds: ' + n(pr.debrisSeconds));
  lines.push('  healthBarHideWhenFull: ' + b(pr.healthBarHideWhenFull));
  lines.push('  masterVolume: ' + n(pr.masterVolume));
}

function encodeToggles(toggles: ToggleData, lines: string[]): void {
  p(lines, [G1]);
  lines.push('toggles:');
  lines.push('  alliesCanDieWhileMarching: ' + b(toggles.alliesCanDieWhileMarching));
  lines.push('  enemiesTargetAllies: ' + b(toggles.enemiesTargetAllies));
}

export interface EncodeOptions { toolVersion: string; issues?: ReadonlyArray<Issue> }
export function encode(doc: StageDocument, opts: EncodeOptions): string {
  const out: string[] = []; out.push(H1); out.push(H2); out.push(H3); out.push(H4);
  if (opts.issues !== undefined && opts.issues.some(i => i.severity === 'error')) { const n = opts.issues.filter(i => i.severity === 'error').length; out.push('# ⚠ 검증 실패 ' + n + '건 — 임포트되지 않는다. 툴의 검증 탭을 보라.'); }
  out.push('schema: ' + SCHEMA); out.push('name: ' + str(doc.name)); out.push('');
  encodeMap(doc.map, out); out.push(''); encodePath(doc.path, out); out.push(''); encodeSpawn(doc.spawn, out); out.push(''); encodeBurst(doc.burst, out); out.push(''); encodeEconomy(doc.economy, out); out.push(''); encodeEscortee(doc.escortee, out); out.push(''); encodeMother(doc.mother, out); out.push(''); encodePresentation(doc.presentation, out); out.push(''); encodeToggles(doc.toggles, out);
  return out.join('\n') + '\n';
}