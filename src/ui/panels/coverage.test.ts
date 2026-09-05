/**
 * 목적: 탭 필드 커버리지 테스트. EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함하는지 검증.
 * 왜 이 구조인가: SDD-03 §6. 새 필드가 추가되면 화면도 함께 따라와야 한다.
 * 바꾸면 안 되는 것: EXPOSED_FIELDS 에 FIELD_PATHS 의 모든 항목이 있어야 한다.
 * 근거: SDD-03 §6 [D-03-06], SDD-08 §2 [D-08-02]
 */
import { describe, expect, it } from 'vitest';
import { FIELD_PATHS, setField } from '../../core/commands/fields.js';
import { EXPOSED_FIELDS, formatPlayTime, tabFieldValues } from './tabs.js';
import { Store } from '../state.js';
import { createEmptyStage } from '../../core/model/factory.js';

describe('탭 필드 커버리지', () => {
  it('EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함한다', () => {
    const exposed = new Set(EXPOSED_FIELDS);
    const missing = FIELD_PATHS.filter(p => !exposed.has(p));
    expect(missing, '화면에 없는 필드: ' + missing.join(', ')).toEqual([]);
    expect(EXPOSED_FIELDS.length).toBeGreaterThanOrEqual(27);
  });

  it('render 가 doc 을 따라간다 — tabFieldValues 순수 함수 검증 (M-2 회귀 테스트)', () => {
    const doc = createEmptyStage('test', 10, 10);
    const store = new Store(doc);
    const checks: Array<{ path: typeof FIELD_PATHS[number]; set: number | boolean | string }> = [
      { path: 'escortee.speed', set: 0.5 },
      { path: 'escortee.maxHealth', set: 200 },
      { path: 'mother.speed', set: 0.3 },
      { path: 'mother.spawnDelay', set: 10 },
      { path: 'mother.followsPath', set: false },
      { path: 'spawn.volleyCount', set: 8 },
      { path: 'spawn.volleySpacing', set: 0.5 },
      { path: 'spawn.restSeconds', set: 5 },
      { path: 'spawn.telegraphSeconds', set: 1 },
      { path: 'burst.duration', set: 15 },
      { path: 'burst.volleyCount', set: 8 },
      { path: 'burst.restSeconds', set: 3 },
      { path: 'burst.recoverySpeedMultiplier', set: 1.5 },
      { path: 'burst.recoverySeconds', set: 5 },
      { path: 'economy.startingResource', set: 200 },
      { path: 'economy.shortcutCost', set: 100 },
      { path: 'presentation.uiSlowMotionScale', set: 0.5 },
      { path: 'presentation.shotLineSeconds', set: 0.1 },
      { path: 'presentation.magicMissileSpeed', set: 10 },
      { path: 'presentation.hitFlashSeconds', set: 0.1 },
      { path: 'presentation.debrisCount', set: 10 },
      { path: 'presentation.debrisSeconds', set: 1 },
      { path: 'presentation.healthBarHideWhenFull', set: false },
      { path: 'presentation.masterVolume', set: 0.5 },
      { path: 'toggles.alliesCanDieWhileMarching', set: true },
      { path: 'toggles.enemiesTargetAllies', set: true },
      { path: 'name', set: 'newname' },
    ];
    for (const { path, set: val } of checks) {
      store.dispatch(setField(path, val));
      expect(tabFieldValues(store.state.history.doc)[path]).toBe(val);
    }
  });

  it('formatPlayTime 포맷 (M-1 회귀 테스트)', () => {
    expect(formatPlayTime(0, 119.067)).toBe('0.0 / 119.1초');
    expect(formatPlayTime(50, 119.067)).toBe('50.0 / 119.1초');
    expect(formatPlayTime(119.067, 119.067)).toBe('119.1 / 119.1초');
  });
});