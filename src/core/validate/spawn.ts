/**
 * 목적: 스폰·경제 검증 규칙 V-S01~V-S05 구현.
 * 왜 이 구조인가: V-S01 심각도는 ctx.mode 에 따라 달라진다.
 *   V-S03 조건은 SDD-02 §4 표 범위.
 * 바꾸면 안 되는 것: 메시지 템플릿 — 임포터 C# 과 같은 문장.
 * 근거: SDD-09 §3-4 [D-09-03-4], SDD-08 §4 [D-08-04]
 */
import type { StageDocument } from '../model/stage.js';
import type { Issue, ValidateContext } from './index.js';

export function validateSpawn(doc: StageDocument, ctx: ValidateContext): Issue[] {
  const issues: Issue[] = [];
  const { spawn, economy } = doc;

  // V-S01: 적 이름
  for (let i = 0; i < spawn.table.length; i++) {
    const e = spawn.table[i]!;
    if (!ctx.enemyCatalog.has(e.enemy)) {
      const sev = ctx.mode === 'importer' ? 'error' : 'warning';
      issues.push({ id: 'V-S01', severity: sev, path: `spawn.table[${i}]`, message: `"${e.enemy}" 찾지 못함. 있는 것: ${[...ctx.enemyCatalog].join(', ')}` });
    }
  }

  // V-S02: 가중치
  if (spawn.table.length === 0) {
    issues.push({ id: 'V-S02', severity: 'error', path: 'spawn.table', message: '스폰 표가 비었다' });
  } else {
    let neg = false; let tw = 0;
    for (let i = 0; i < spawn.table.length; i++) {
      const w = spawn.table[i]!.weight;
      if (w < 0) { issues.push({ id: 'V-S02', severity: 'error', path: `spawn.table[${i}]`, message: `가중치 ${w} 는 음수` }); neg = true; }
      tw += w;
    }
    if (!neg && tw === 0) issues.push({ id: 'V-S02', severity: 'error', path: 'spawn.table', message: '가중치 합 0' });
  }

  // V-S03: 수치 범위 — SDD-02 §4 표 조건 그대로
  check(issues, 'escortee.speed', doc.escortee.speed, v => v > 0);
  check(issues, 'escortee.maxHealth', doc.escortee.maxHealth, v => v > 0);
  check(issues, 'mother.speed', doc.mother.speed, v => v > 0);
  check(issues, 'mother.spawnDelay', doc.mother.spawnDelay, v => v >= 0);
  check(issues, 'spawn.volleyCount', spawn.volleyCount, v => v >= 1 && Number.isInteger(v));
  check(issues, 'spawn.volleySpacing', spawn.volleySpacing, v => v >= 0);
  check(issues, 'spawn.restSeconds', spawn.restSeconds, v => v > 0);
  check(issues, 'spawn.telegraphSeconds', spawn.telegraphSeconds, v => v >= 0);
  check(issues, 'burst.duration', doc.burst.duration, v => v >= 0);
  check(issues, 'burst.volleyCount', doc.burst.volleyCount, v => v >= 1 && Number.isInteger(v));
  check(issues, 'burst.restSeconds', doc.burst.restSeconds, v => v >= 0);
  check(issues, 'burst.recoverySpeedMultiplier', doc.burst.recoverySpeedMultiplier, v => v >= 1);
  check(issues, 'burst.recoverySeconds', doc.burst.recoverySeconds, v => v >= 0);
  check(issues, 'economy.startingResource', economy.startingResource, v => v >= 0 && Number.isInteger(v));
  check(issues, 'economy.shortcutCost', economy.shortcutCost, v => v >= 0 && Number.isInteger(v));
  check(issues, 'presentation.uiSlowMotionScale', doc.presentation.uiSlowMotionScale, v => v > 0 && v <= 1);
  check(issues, 'presentation.shotLineSeconds', doc.presentation.shotLineSeconds, v => v >= 0);
  check(issues, 'presentation.magicMissileSpeed', doc.presentation.magicMissileSpeed, v => v >= 0.1);
  check(issues, 'presentation.hitFlashSeconds', doc.presentation.hitFlashSeconds, v => v >= 0);
  check(issues, 'presentation.debrisCount', doc.presentation.debrisCount, v => v >= 0 && Number.isInteger(v));
  check(issues, 'presentation.debrisSeconds', doc.presentation.debrisSeconds, v => v >= 0);
  check(issues, 'presentation.masterVolume', doc.presentation.masterVolume, v => v >= 0 && v <= 1);
  // V-S04: 난이도 표
  const diffs = economy.difficulties;
  const byName = new Map(diffs.map(d => [d.difficulty, d]));
  if (!byName.has('Easy')) issues.push({ id: 'V-S04', severity: 'error', path: 'economy.difficulties', message: 'Easy 가 없다' });
  if (!byName.has('Normal')) issues.push({ id: 'V-S04', severity: 'error', path: 'economy.difficulties', message: 'Normal 이 없다' });
  if (!byName.has('Hard')) issues.push({ id: 'V-S04', severity: 'error', path: 'economy.difficulties', message: 'Hard 가 없다' });
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i]!.difficulty;
    if (!['Easy','Normal','Hard'].includes(d)) issues.push({ id: 'V-S04', severity: 'error', path: `economy.difficulties[${i}]`, message: `"${d}" 는 Easy/Normal/Hard 아님` });
  }

  // V-S05: 체력 곡선
  const hp = spawn.healthByProgress;
  if (hp.length === 0) {
    issues.push({ id: 'V-S05', severity: 'error', path: 'spawn.healthByProgress', message: '비었다' });
  } else for (let i = 0; i < hp.length; i++) {
    const k = hp[i]!;
    if (k.t < 0 || k.t > 1) issues.push({ id: 'V-S05', severity: 'error', path: `spawn.healthByProgress[${i}].t`, message: `t=${k.t} 는 [0,1] 밖` });
    if (k.mul <= 0) issues.push({ id: 'V-S05', severity: 'error', path: `spawn.healthByProgress[${i}].mul`, message: `mul=${k.mul} 는 0 이하` });
    if (i > 0 && k.t <= hp[i - 1]!.t) issues.push({ id: 'V-S05', severity: 'error', path: `spawn.healthByProgress[${i}]`, message: `t=${k.t} 는 이전 키(${hp[i-1]!.t})보다 커야 함` });
  }

  return issues;
}

function check(issues: Issue[], path: string, v: number, ok: (v: number) => boolean): void {
  if (!ok(v)) issues.push({ id: 'V-S03', severity: 'error', path, message: `${path} = ${v} — 조건 불일치` });
}