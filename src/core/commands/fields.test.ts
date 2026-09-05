/**
 * 목적: 필드·표·크기 변경 커맨드의 **적용 결과**를 검사한다. 왕복(undo) 테스트가 못 잡는 영역이다.
 * 왜 이 구조인가: `undo(do(doc)) === doc` 은 apply 와 revert 가 **서로** 짝이면 통과한다.
 *   apply 가 해야 할 일을 아예 안 해도 revert 가 원래 값을 되돌려 놓으면 초록불이다 —
 *   실제로 resizeMap 이 노드를 옮기지 않고 있었고 왕복 테스트 30개가 전부 통과했다.
 *   그래서 여기서는 "무엇이 바뀌었는가" 를 직접 본다.
 * 바꾸면 안 되는 것: 맵 밖으로 나간 노드를 지우지 않는다는 단언 (SDD-03 §7).
 *   조용히 지우면 엣지·트리거가 함께 사라져 원인을 찾을 수 없다.
 * 근거: SDD-09 §8-4 [D-09-08], SDD-03 §7 [D-03-07], SDD-08 §7 [D-08-07]
 */
import { describe, expect, it } from 'vitest';
import { loadSeed } from '../model/factory.js';
import { cellAt } from '../model/map.js';
import { Cell } from '../model/cell.js';
import { FIELD_PATHS, TABLE_PATHS, resizeMap, setField, setTable } from './fields.js';

const seed = loadSeed();

describe('resizeMap — 적용 결과', () => {
  it('앵커 w 로 넓히면 노드가 제자리에 남는다 (dx=0)', () => {
    const after = resizeMap(seed, 40, 18, 'w').apply(seed);
    expect(after.map.width).toBe(40);
    expect(after.path.nodes[0]).toEqual(seed.path.nodes[0]);
  });

  it('앵커 e 로 넓히면 노드가 dx 만큼 함께 옮겨진다', () => {
    const dx = 40 - seed.map.width;
    const after = resizeMap(seed, 40, 18, 'e').apply(seed);
    const before = seed.path.nodes[0]!;
    expect(after.path.nodes[0]!.x).toBe(before.x + dx);
    expect(after.path.nodes[0]!.y).toBe(before.y);
    // 왜 셀도 같이 보는가: 노드만 옮기고 맵을 안 옮기면 노드가 지형에서 미끄러진다.
    expect(cellAt(after.map, before.x + dx, before.y)).toBe(cellAt(seed.map, before.x, before.y));
  });

  it('앵커 c 로 줄여도 맵 밖 노드를 지우지 않는다', () => {
    const after = resizeMap(seed, 12, 10, 'c').apply(seed);
    expect(after.path.nodes.length).toBe(seed.path.nodes.length);
    expect(after.path.edges.length).toBe(seed.path.edges.length);
    const outside = after.path.nodes.filter(
      (n) => n.x < 0 || n.y < 0 || n.x >= after.map.width || n.y >= after.map.height,
    );
    expect(outside.length, '줄이면 일부 노드는 맵 밖에 남아야 한다 (V-P07 이 잡는다)').toBeGreaterThan(0);
  });

  it('새로 생긴 칸은 Empty 다', () => {
    const after = resizeMap(seed, 40, 18, 'w').apply(seed);
    expect(cellAt(after.map, 39, 9)).toBe(Cell.Empty);
  });

  it('origin 은 살아남은 칸의 월드 좌표를 유지한다', () => {
    const dx = 40 - seed.map.width;
    const after = resizeMap(seed, 40, 18, 'e').apply(seed);
    expect(after.map.origin[0]).toBe(seed.map.origin[0] - dx);
  });
});

describe('setField — 경로별 적용/복원', () => {
  it('모든 FieldPath 가 실제 필드를 가리킨다', () => {
    // 왜: 유니온에 오타가 있으면 read 가 undefined 를 돌려주고 revert 가 조용히 죽는다.
    for (const path of FIELD_PATHS) {
      const cmd = setField(path, 1);
      const after = cmd.apply(seed);
      const back = cmd.revert(after);
      expect(JSON.stringify(back), `${path}: 복원 실패`).toBe(JSON.stringify(seed));
    }
  });

  it('불리언 필드도 되돌아온다', () => {
    const cmd = setField('mother.followsPath', false);
    const after = cmd.apply(seed);
    expect(after.mother.followsPath).toBe(false);
    expect(cmd.revert(after).mother.followsPath).toBe(true);
  });

  it('원본 문서를 건드리지 않는다', () => {
    const snapshot = JSON.stringify(seed.spawn);
    setField('spawn.restSeconds', 99).apply(seed);
    expect(JSON.stringify(seed.spawn)).toBe(snapshot);
  });
});

describe('setTable', () => {
  it('모든 TablePath 가 실제 표를 가리킨다', () => {
    for (const path of TABLE_PATHS) {
      const cmd = setTable(path, []);
      const after = cmd.apply(seed);
      const back = cmd.revert(after);
      expect(JSON.stringify(back), `${path}: 복원 실패`).toBe(JSON.stringify(seed));
    }
  });

  it('이전 값을 deep copy 로 기억한다', () => {
    const cmd = setTable('spawn.table', [{ enemy: 'Robot_Scout', weight: 1 }]);
    const after = cmd.apply(seed);
    // 적용 후 결과의 표를 손대도 revert 가 영향받지 않아야 한다.
    after.spawn.table.push({ enemy: 'X', weight: 0 });
    expect(cmd.revert(after).spawn.table).toEqual(seed.spawn.table);
  });
});
