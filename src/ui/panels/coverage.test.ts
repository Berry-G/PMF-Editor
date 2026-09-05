/**
 * 목적: 탭 필드 커버리지 테스트. EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함하는지 검증.
 * 왜 이 구조인가: SDD-03 §6. 새 필드가 추가되면 화면도 함께 따라와야 한다.
 * 바꾸면 안 되는 것: EXPOSED_FIELDS 에 FIELD_PATHS 의 모든 항목이 있어야 한다.
 * 근거: SDD-03 §6 [D-03-06], SDD-08 §2 [D-08-02]
 */
import { describe, expect, it } from 'vitest';
import { FIELD_PATHS, setField } from '../../core/commands/fields.js';
import { EXPOSED_FIELDS } from './tabs.js';
import { Store } from '../state.js';
import { createEmptyStage } from '../../core/model/factory.js';

describe('탭 필드 커버리지', () => {
  it('EXPOSED_FIELDS 가 FIELD_PATHS 27개를 전부 포함한다', () => {
    const exposed = new Set(EXPOSED_FIELDS);
    const missing = FIELD_PATHS.filter(p => !exposed.has(p));
    expect(missing, '화면에 없는 필드: ' + missing.join(', ')).toEqual([]);
    expect(EXPOSED_FIELDS.length).toBeGreaterThanOrEqual(27);
  });

  it('문서가 바뀌면 탭이 읽는 값도 바뀐다 (F-1 회귀 테스트)', () => {
    const doc = createEmptyStage('test', 10, 10);
    const store = new Store(doc);
    // 각 필드를 dispatch 하고 doc 값을 읽어 바뀌었는지 확인
    const checks: Array<{ path: typeof FIELD_PATHS[number]; set: number | boolean | string; get: (d: typeof doc) => unknown }> = [
      { path: 'escortee.speed', set: 0.5, get: d => d.escortee.speed },
      { path: 'escortee.maxHealth', set: 200, get: d => d.escortee.maxHealth },
      { path: 'mother.speed', set: 0.3, get: d => d.mother.speed },
      { path: 'mother.spawnDelay', set: 10, get: d => d.mother.spawnDelay },
      { path: 'mother.followsPath', set: false, get: d => d.mother.followsPath },
      { path: 'spawn.volleyCount', set: 8, get: d => d.spawn.volleyCount },
      { path: 'spawn.volleySpacing', set: 0.5, get: d => d.spawn.volleySpacing },
      { path: 'spawn.restSeconds', set: 5, get: d => d.spawn.restSeconds },
      { path: 'spawn.telegraphSeconds', set: 1, get: d => d.spawn.telegraphSeconds },
      { path: 'burst.duration', set: 15, get: d => d.burst.duration },
      { path: 'burst.volleyCount', set: 8, get: d => d.burst.volleyCount },
      { path: 'burst.restSeconds', set: 3, get: d => d.burst.restSeconds },
      { path: 'burst.recoverySpeedMultiplier', set: 1.5, get: d => d.burst.recoverySpeedMultiplier },
      { path: 'burst.recoverySeconds', set: 5, get: d => d.burst.recoverySeconds },
      { path: 'economy.startingResource', set: 200, get: d => d.economy.startingResource },
      { path: 'economy.shortcutCost', set: 100, get: d => d.economy.shortcutCost },
      { path: 'presentation.uiSlowMotionScale', set: 0.5, get: d => d.presentation.uiSlowMotionScale },
      { path: 'presentation.shotLineSeconds', set: 0.1, get: d => d.presentation.shotLineSeconds },
      { path: 'presentation.magicMissileSpeed', set: 10, get: d => d.presentation.magicMissileSpeed },
      { path: 'presentation.hitFlashSeconds', set: 0.1, get: d => d.presentation.hitFlashSeconds },
      { path: 'presentation.debrisCount', set: 10, get: d => d.presentation.debrisCount },
      { path: 'presentation.debrisSeconds', set: 1, get: d => d.presentation.debrisSeconds },
      { path: 'presentation.healthBarHideWhenFull', set: false, get: d => d.presentation.healthBarHideWhenFull },
      { path: 'presentation.masterVolume', set: 0.5, get: d => d.presentation.masterVolume },
      { path: 'toggles.alliesCanDieWhileMarching', set: true, get: d => d.toggles.alliesCanDieWhileMarching },
      { path: 'toggles.enemiesTargetAllies', set: true, get: d => d.toggles.enemiesTargetAllies },
      { path: 'name', set: 'newname', get: d => d.name },
    ];
    for (const { path, set: val, get } of checks) {
      store.dispatch(setField(path, val));
      expect(get(store.state.history.doc)).toBe(val);
    }
  });
});