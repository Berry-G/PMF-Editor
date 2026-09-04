/**
 * 목적: StageDocument → TOON 정규 출력.
 * 왜 이 구조인가: 정규 출력(바이트 동일)이어야 골든 왕복 테스트 성립.
 *   섹션 순서·키 순서·숫자 형식 고정 — SDD-02 §6-1 [D-02-08].
 * 바꾸면 안 되는 것: 섹션·키 순서, formatNumber, rows y 뒤집기.
 * 근거: SDD-02 §6-1 [D-02-07/08], SDD-09 §2 [D-09-02]
 */
import { CELL_TO_CHAR, Cell as C } from '../model/cell.js';

import { SCHEMA } from '../schema.js';
import type { Issue } from '../validate/index.js';
import type {
  StageDocument, MapData, PathData, SpawnData, BurstData, EconomyData,
  EscorteeData, MotherData, PresentationData, ToggleData,
} from '../model/stage.js';

const HEADER_COMMENT = `# Prowl's Moving Factory — 스테이지 데이터 (${SCHEMA})`;
const GENERATED_COMMENT = (v: string) => `# PMF Editor ${v} 가 만들었다.`;
const SECT_COMMENTS: Record<string, string> = {
  map: '# 맵 — rows 첫 행이 y=height-1 (화면 위)',
  path: '# 경로 — nodes(id,x,y,role)  edges(from,to,allowed,bidirectional,shortcut)',
  spawn: '# 스폰 — 묶음·간격·휴지·예고 + 표 + 체력 곡선',
  burst: '# 버스트 — 트리거 노드 발동. 총량 보존 있음',
  economy: '# 경제 — 시작 자원·지름길 비용·난이도 3종',
  escortee: '# 보호대상 — 속도·최대 체력',
  mother: '# 모체 — 속도·지연·경로 추종 여부',
  presentation: '# 연출',
  toggles: '# 토글',
};

function needsQuotes(s: string): boolean {
  if (s === '' || s === 'true' || s === 'false' || s === 'null') return true;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return true;
  if (/^[\s]|[\s]$/.test(s)) return true;
  if (/[:"\\[\]{}]/.test(s) || s.includes(',') || /^[#-]/.test(s)) return true;
  for (let i = 0; i < s.length; i++) { const cc = s.charCodeAt(i); if (cc < 0x20 || (cc >= 0x7f && cc < 0xa0)) return true; }
  return false;
}

function str(s: string): string {
  if (!needsQuotes(s)) return s;
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    switch (c) {
      case '\\': out += '\\\\'; break; case '"': out += '\\"'; break;
      case '\n': out += '\\n'; break; case '\r': out += '\\r'; break; case '\t': out += '\\t'; break;
      default: { const cc = s.charCodeAt(i); if (cc < 0x20 || (cc >= 0x7f && cc < 0xa0)) out += `\\u${cc.toString(16).padStart(4, '0')}`; else out += c; }
    }
  }
  return out + '"';
}

/* -------------------------------------------------------------- */
/*  섹션 인코더                                                    */
/* -------------------------------------------------------------- */

function section(name: string, lines: string[]): void {
  lines.push(SECT_COMMENTS[name] ?? '');
}

function encodeMap(map: MapData, lines: string[]): void {
  section('map', lines); lines.push('map:');
  lines.push(`  width: ${map.width}`); lines.push(`  height: ${map.height}`);
  lines.push(`  origin[2]: ${map.origin[0]},${map.origin[1]}`);
  const rows: string[] = [];
  for (let r = 0; r < map.height; r++) {
    const y = map.height - 1 - r; let rs = '';
    for (let x = 0; x < map.width; x++) rs += CELL_TO_CHAR[(map.cells[y * map.width + x]!) as C] ?? '?';
    rows.push(rs);
  }
  lines.push(`  rows[${map.height}]{row}:`);
  for (const r of rows) lines.push(`    ${r}`);
}

function encodePath(path: PathData, lines: string[]): void {
  section('path', lines); lines.push('path:');
  lines.push(`  nodes[${path.nodes.length}]{id,x,y,role}:`);
  for (const n of path.nodes) lines.push(`    ${n.id},${n.x},${n.y},${n.role}`);
  lines.push(`  edges[${path.edges.length}]{from,to,allowed,bidirectional,shortcut}:`);
  for (const e of path.edges) {
    const allowed = e.allowed.length === 3 ? 'All' : [...new Set(e.allowed)].join('+');
    lines.push(`    ${e.from},${e.to},${allowed},${e.bidirectional},${e.shortcut}`);
  }
}

function encodeSpawn(spawn: SpawnData, lines: string[]): void {
  section('spawn', lines); lines.push('spawn:');
  lines.push(`  volleyCount: ${spawn.volleyCount}`); lines.push(`  volleySpacing: ${spawn.volleySpacing}`);
  lines.push(`  restSeconds: ${spawn.restSeconds}`); lines.push(`  telegraphSeconds: ${spawn.telegraphSeconds}`);
  lines.push(`  table[${spawn.table.length}]{enemy,weight}:`);
  for (const e of spawn.table) lines.push(`    ${str(e.enemy)},${e.weight}`);
  lines.push(`  healthByProgress[${spawn.healthByProgress.length}]{t,mul}:`);
  for (const k of spawn.healthByProgress) lines.push(`    ${k.t},${k.mul}`);
}

function encodeBurst(burst: BurstData, lines: string[]): void {
  section('burst', lines); lines.push('burst:');
  lines.push(`  triggerNodeIds[${burst.triggerNodeIds.length}]: ${burst.triggerNodeIds.map(id => str(id)).join(',')}`);
  lines.push(`  duration: ${burst.duration}`); lines.push(`  volleyCount: ${burst.volleyCount}`);
  lines.push(`  restSeconds: ${burst.restSeconds}`);
  lines.push(`  recoverySpeedMultiplier: ${burst.recoverySpeedMultiplier}`);
  lines.push(`  recoverySeconds: ${burst.recoverySeconds}`);
}

function encodeEconomy(economy: EconomyData, lines: string[]): void {
  section('economy', lines); lines.push('economy:');
  lines.push(`  startingResource: ${economy.startingResource}`); lines.push(`  shortcutCost: ${economy.shortcutCost}`);
  lines.push(`  difficulties[3]{difficulty,displayName,killReward,resourcePerSecond}:`);
  for (const d of economy.difficulties) lines.push(`    ${d.difficulty},${str(d.displayName)},${d.killReward},${d.resourcePerSecond}`);
}

function encodeEscortee(escortee: EscorteeData, lines: string[]): void {
  section('escortee', lines); lines.push('escortee:');
  lines.push(`  speed: ${escortee.speed}`); lines.push(`  maxHealth: ${escortee.maxHealth}`);
}
function encodeMother(mother: MotherData, lines: string[]): void {
  section('mother', lines); lines.push('mother:');
  lines.push(`  speed: ${mother.speed}`); lines.push(`  spawnDelay: ${mother.spawnDelay}`);
  lines.push(`  followsPath: ${mother.followsPath}`);
}
function encodePresentation(presentation: PresentationData, lines: string[]): void {
  section('presentation', lines); lines.push('presentation:');
  lines.push(`  uiSlowMotionScale: ${presentation.uiSlowMotionScale}`);
  lines.push(`  shotLineSeconds: ${presentation.shotLineSeconds}`);
  lines.push(`  magicMissileSpeed: ${presentation.magicMissileSpeed}`);
  lines.push(`  hitFlashSeconds: ${presentation.hitFlashSeconds}`);
  lines.push(`  debrisCount: ${presentation.debrisCount}`);
  lines.push(`  debrisSeconds: ${presentation.debrisSeconds}`);
  lines.push(`  healthBarHideWhenFull: ${presentation.healthBarHideWhenFull}`);
  lines.push(`  masterVolume: ${presentation.masterVolume}`);
}
function encodeToggles(toggles: ToggleData, lines: string[]): void {
  section('toggles', lines); lines.push('toggles:');
  lines.push(`  alliesCanDieWhileMarching: ${toggles.alliesCanDieWhileMarching}`);
  lines.push(`  enemiesTargetAllies: ${toggles.enemiesTargetAllies}`);
}

/* -------------------------------------------------------------- */
/*  공개 API                                                      */
/* -------------------------------------------------------------- */

export interface EncodeOptions { toolVersion: string; issues?: ReadonlyArray<Issue> }

export function encode(doc: StageDocument, opts: EncodeOptions): string {
  const out: string[] = [];
  out.push(HEADER_COMMENT); out.push(GENERATED_COMMENT(opts.toolVersion));
  if (opts.issues !== undefined && opts.issues.some(i => i.severity === 'error')) {
    const n = opts.issues.filter(i => i.severity === 'error').length;
    out.push(`# ⚠ 검증 실패 ${n}건 — 임포트되지 않는다.`);
  }
  out.push(`schema: ${SCHEMA}`); out.push(`name: ${str(doc.name)}`); out.push('');
  encodeMap(doc.map, out); out.push('');
  encodePath(doc.path, out); out.push('');
  encodeSpawn(doc.spawn, out); out.push('');
  encodeBurst(doc.burst, out); out.push('');
  encodeEconomy(doc.economy, out); out.push('');
  encodeEscortee(doc.escortee, out); out.push('');
  encodeMother(doc.mother, out); out.push('');
  encodePresentation(doc.presentation, out); out.push('');
  encodeToggles(doc.toggles, out);
  return out.join('\n') + '\n';
}