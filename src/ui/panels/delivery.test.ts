/**
 * 목적: 저장·전달 요약, 생성 버전 주석, 선택 마을 수치의 회귀를 검증한다.
 * 왜 이 구조인가: DOM 없이 순수 경계를 검사해 저장 버튼 세 갈래가 같은 결과를 쓰게 한다.
 * 바꾸면 안 되는 것: canonical encode 골든은 별도 seed.test.ts가 지키며 여기서는 delivery 출력만 검사한다.
 * 근거: SDD-03 §5·§9 [D-03-05/09], SDD-09 §2·§11 [D-09-02/11], ADR-E13
 */
import { describe, expect, it } from 'vitest';
import { Cell } from '../../core/model/cell.js';
import { createEmptyStage, loadSeed } from '../../core/model/factory.js';
import { DEFAULT_CATALOG } from '../../core/sim/params.js';
import { encodeForDelivery } from '../../core/toon/encode.js';
import { villagesInUnityOrder } from '../canvas/renderer.js';
import { prepareDelivery, toonFileName } from './delivery.js';
import { villageReachability } from './props.js';

describe('전달 준비', () => {
  it('확장자를 한 번만 붙이고 저장 뒤 쓸 실제 파일명을 만든다', () => {
    expect(toonFileName('untitled.unity-ready.toon.toon', 'Stage_Greybox')).toBe('untitled.unity-ready.toon');
    expect(toonFileName('', 'Stage_New')).toBe('Stage_New.toon');
  });

  it('현재 문서를 즉시 검증하고 Unity 대상·마을·버스트를 요약한다', () => {
    const doc = loadSeed();
    const prepared = prepareDelivery(doc, DEFAULT_CATALOG, 'handoff.toon', 'v9');
    expect(prepared.summary).toMatchObject({
      internalName: 'Stage_Greybox', fileName: 'handoff.toon', villageCount: 2,
      burstTriggerCount: 2, errorCount: 0, warningCount: 0,
    });
    expect(prepared.summary.unityAssets).toEqual([
      'Stage_Greybox.map.asset', 'Stage_Greybox.path.asset', 'Stage_Greybox.asset',
    ]);

    const invalid = prepareDelivery({ ...doc, name: '' }, DEFAULT_CATALOG, 'work.toon', 'v9');
    expect(invalid.summary.errorCount).toBeGreaterThan(0);
    expect(invalid.text).toContain('# ⚠ 검증 실패');
  });

  it('delivery 출력만 생성 버전을 밝히고 seed 전용 출처를 제거한다', () => {
    const text = encodeForDelivery(loadSeed(), { toolVersion: 'v1\r\nschema: injected', issues: [] });
    expect(text).toContain('# 생성 도구: PMF Editor v1 schema: injected\n');
    expect(text).not.toContain('\nschema: injected\n');
    expect(text).not.toContain('# 출처: 게임 프로젝트 2026-09-02 상태');
  });
});

describe('마을 식별과 선택 도달 영역', () => {
  it('Unity Village_N 순서와 같은 y 내림차순, x 오름차순이다', () => {
    const doc = createEmptyStage('order', 8, 8);
    const cells = new Uint8Array(doc.map.cells).fill(Cell.Blocked);
    cells[6 * 8 + 3] = Cell.VillageSlot;
    cells[1 * 8 + 5] = Cell.VillageSlot;
    cells[6 * 8 + 1] = Cell.VillageSlot;
    expect(villagesInUnityOrder({ ...doc.map, cells })).toEqual([{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 1 }]);
  });

  it('선택 마을 구역과 모든 마을 합집합을 구분한다', () => {
    const base = createEmptyStage('reach', 8, 8);
    const cells = new Uint8Array(base.map.cells).fill(Cell.Blocked);
    cells[1 * 8 + 1] = Cell.VillageSlot;
    cells[1 * 8 + 2] = Cell.Buildable;
    cells[2 * 8 + 1] = Cell.Buildable;
    cells[5 * 8 + 6] = Cell.VillageSlot;
    cells[5 * 8 + 5] = Cell.Buildable;
    cells[6 * 8 + 6] = Cell.Buildable;
    cells[6 * 8 + 5] = Cell.Buildable;
    const doc = { ...base, map: { ...base.map, cells } };
    expect(villageReachability(doc, 1, 1)).toEqual({ selected: 2, reachable: 5, total: 5 });
    expect(villageReachability(doc, 6, 5)).toEqual({ selected: 3, reachable: 5, total: 5 });
  });
});
