/**
 * 목적: 문서 검증의 진입점. 규칙 순서: F → M → P → S → B.
 * 왜 이 구조인가: 파일 구조 오류가 있으면 나머지가 의미 없으므로 F 먼저.
 *   각 규칙 집합을 별도 파일(map.ts path.ts spawn.ts balance.ts)로 분리.
 *   `ctx.mode` 로 V-S01 심각도가 갈린다.
 * 바꾸면 안 되는 것: 검증 순서, ValidateContext 타입.
 * 근거: SDD-08 §4 [D-08-04], SDD-09 §3 [D-09-03]
 */
import type { StageDocument, XY } from '../model/stage.js';
import type { RuleId } from './rules.js';
import { validateMap } from './map.js';
import { validatePath } from './path.js';
import { validateSpawn } from './spawn.js';
import { validateBalance } from './balance.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  id: RuleId;
  severity: Severity;
  path: string;
  message: string;
  cells?: XY[];
  nodeIds?: string[];
  edgeIndex?: number;
}

export interface ValidateContext {
  mode: 'tool' | 'importer';
  enemyCatalog: ReadonlySet<string>;
}

export { RULE_IDS, RULES } from './rules.js';
export type { RuleId, RuleMeta } from './rules.js';
export { computeReachability } from '../geometry/reach.js';
export type { Reachability } from '../geometry/reach.js';

export function validate(doc: StageDocument, ctx: ValidateContext): Issue[] {
  const issues: Issue[] = [];
  // V-F02
  if (doc.name === '' || /[\\/:*?"<>|]/.test(doc.name) || doc.name.trim() !== doc.name) {
    issues.push({ id: 'V-F02', severity: 'error', path: 'name', message: `name "${doc.name}" 은(는) 파일 이름으로 쓸 수 없다` });
  }
  if (issues.some(i => i.severity === 'error')) return issues;
  issues.push(...validateMap(doc));
  if (issues.some(i => i.severity === 'error')) return issues;
  issues.push(...validatePath(doc));
  issues.push(...validateSpawn(doc, ctx));
  issues.push(...validateBalance(doc));
  return issues;
}