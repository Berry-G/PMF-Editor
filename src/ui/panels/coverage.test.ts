/**
 * 목적: 탭 필드 커버리지 테스트. EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함하는지 검증.
 * 왜 이 구조인가: SDD-03 §6. 새 필드가 추가되면 화면도 함께 따라와야 한다.
 * 바꾸면 안 되는 것: EXPOSED_FIELDS 에 FIELD_PATHS 의 모든 항목이 있어야 한다.
 * 근거: SDD-03 §6 [D-03-06], SDD-08 §2 [D-08-02]
 */
import { describe, expect, it } from 'vitest';
import { FIELD_PATHS } from '../../core/commands/fields.js';
import { EXPOSED_FIELDS } from './tabs.js';

describe('탭 필드 커버리지', () => {
  it('EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함한다', () => {
    const exposed = new Set(EXPOSED_FIELDS);
    const missing = FIELD_PATHS.filter(p => !exposed.has(p));
    expect(missing, '화면에 없는 필드: ' + missing.join(', ')).toEqual([]);
    expect(EXPOSED_FIELDS.length).toBeGreaterThanOrEqual(27);
  });
});