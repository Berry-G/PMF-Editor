/**
 * 목적: 스키마 변환기. 현재는 pmf.stage/1 만 받는다 — 다른 스키마면 마이그레이션 시도 후 오류.
 * 왜 이 구조인가: 자동 추측 없이 명시적 변환기 함수 하나다. 새 버전이 나오면 이 파일에
 *   함수를 추가하고 `migrate` 가 체인으로 연결한다.
 * 바꾸면 안 되는 것: 모르는 스키마를 조용히 통과시키지 마라 — 낡은 파일을 오독하는 구멍이 된다.
 * 근거: SDD-02 §7 [D-02-09], SDD-08 §3 [D-08-03]
 */
import type { ObjectNode } from './lexer.js';
import type { ToonError, Result } from './lexer.js';
import { SCHEMA } from '../schema.js';

export function migrate(root: ObjectNode): Result<ObjectNode, ToonError> {
  const se = root.entries.get('schema');
  if (se === undefined) return { ok: false, error: { line: root.line, message: 'schema 필드가 없다' } };
  if (se.kind !== 'scalar' || typeof se.value !== 'string')
    return { ok: false, error: { line: se.line, message: 'schema 는 문자열이어야 한다' } };
  if (se.value === SCHEMA) return { ok: true, value: root };
  return { ok: false, error: { line: se.line, message: `모르는 스키마 "${se.value}"` } };
}