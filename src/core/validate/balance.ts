/**
 * 목적: 밸런스 검증 규칙 V-B01~V-B03 구현.
 * 왜 이 구조인가: 밸런스 규칙은 다른 규칙을 통과한 후에만 의미가 있다 (경로·수치가 유효해야 비교).
 *   V-B01 은 게임이 `LogError` 로 거부하는 조건이다 — 모체가 보호대상을 따라잡으면 게임이 성립하지 않는다.
 * 바꾸면 안 되는 것: V-B01 의 `≥` 비교(게임 `MotherSpawner.cs:107-109` 와 같다).
 *   메시지 템플릿 — 임포터 C# 과 같은 문장.
 * 근거: SDD-09 §3-5 [D-09-03-5], SDD-08 §4 [D-08-04]
 */
import type { StageDocument } from '../model/stage.js';
import type { Issue } from './index.js';

export function validateBalance(doc: StageDocument): Issue[] {
  const issues: Issue[] = [];

  // V-B01: 모체 속도
  if (doc.mother.speed >= doc.escortee.speed) {
    issues.push({
      id: 'V-B01', severity: 'error', path: 'mother.speed',
      message: `mother.speed ${doc.mother.speed} ≥ escortee.speed ${doc.escortee.speed} — 모체가 보호대상을 따라잡는다. 게임이 거부한다`,
    });
  }

  // V-B02: 트리거 중복
  const seen = new Set<string>();
  for (const id of doc.burst.triggerNodeIds) {
    if (seen.has(id)) {
      issues.push({
        id: 'V-B02', severity: 'warning', path: 'burst.triggerNodeIds',
        message: `"${id}" 가 중복이다. 두 번째부터는 무시된다`,
      });
    }
    seen.add(id);
  }

  // V-B03: 버스트 평시보다 약함
  if (doc.burst.volleyCount <= doc.spawn.volleyCount) {
    issues.push({
      id: 'V-B03', severity: 'warning', path: 'burst.volleyCount',
      message: `burst.volleyCount ${doc.burst.volleyCount} ≤ spawn.volleyCount ${doc.spawn.volleyCount} — 버스트가 평시보다 약하다`,
    });
  }

  return issues;
}