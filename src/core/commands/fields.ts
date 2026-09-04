/**
 * 목적: 범용 필드·표·맵 크기 변경 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: setField 는 점 경로로 필드 하나를 바꾸고 이전 값을 기억해 revert 한다.
 *   setTable 도 apply 전 스냅샷을 deep copy 해서 기억한다.
 *   resizeMap 은 앵커 기준으로 맵 확장/축소, 노드 좌표도 함께 옮긴다.
 * 바꾸면 안 되는 것: setField/setTable 의 revert 가 이전 값을 반드시 기억할 것.
 *   이전에는 revert 가 `return d` 로 Undo 가 동작하지 않았다.
 * 근거: SDD-09 §8, SDD-08 §7
 */
import type { Command } from './command.js';
import type { StageDocument } from '../model/stage.js';

export function setField(fp: string, value: number | boolean | string): Command {
  let prev: any = undefined;
  return { label: '필드 ' + fp,
    apply(d: StageDocument) {
      const parts = fp.split('.'); const r: any = { ...d }; let c: any = r;
      for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; }
      prev = c[parts[parts.length - 1]!];
      c[parts[parts.length - 1]!] = value;
      return r;
    },
    revert(d: StageDocument) {
      if (prev === undefined) return d;
      const parts = fp.split('.'); const r: any = { ...d }; let c: any = r;
      for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; }
      c[parts[parts.length - 1]!] = prev;
      return r;
    },
  };
}

export function setTable(tp: string, rows: unknown[]): Command {
  let prev: any = undefined;
  return { label: '표 ' + tp,
    apply(d: StageDocument) {
      const parts = tp.split('.'); const r: any = { ...d }; let c: any = r;
      for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; }
      prev = JSON.parse(JSON.stringify(c[parts[parts.length - 1]!]));
      c[parts[parts.length - 1]!] = rows;
      return r;
    },
    revert(d: StageDocument) {
      if (prev === undefined) return d;
      const parts = tp.split('.'); const r: any = { ...d }; let c: any = r;
      for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; }
      c[parts[parts.length - 1]!] = prev;
      return r;
    },
  };
}

export type Anchor = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';

export function resizeMap(doc: StageDocument, width: number, height: number, anchor: Anchor): Command {
  const oldMap = doc.map; const oldNodes = doc.path.nodes;
  const dx = anchor.includes('e') ? width - oldMap.width : anchor.includes('w') ? 0 : Math.floor((width - oldMap.width) / 2);
  const dy = anchor.includes('n') ? height - oldMap.height : anchor.includes('s') ? 0 : Math.floor((height - oldMap.height) / 2);
  return { label: '크기 ' + oldMap.width + '×' + oldMap.height + '→' + width + '×' + height,
    apply(d: StageDocument) {
      const cells = new Uint8Array(width * height).fill(255);
      for (let y = 0; y < oldMap.height; y++) { for (let x = 0; x < oldMap.width; x++) { const nx = x + dx; const ny = y + dy; if (nx >= 0 && nx < width && ny >= 0 && ny < height) cells[ny * width + nx] = oldMap.cells[y * oldMap.width + x]!; } }
      return { ...d, map: { width, height, origin: [oldMap.origin[0] - dx, oldMap.origin[1] - dy], cells } };
    },
    revert(d: StageDocument) { return { ...d, map: oldMap, path: { ...d.path, nodes: oldNodes } } },
  };
}