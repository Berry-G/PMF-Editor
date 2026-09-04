/**
 * 목적: 범용 필드·표·맵 크기 변경 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: setField 는 점 경로(ex. "spawn.restSeconds")로 필드 하나를 바꾼다.
 *   resizeMap 은 앵커 9칸 중 하나를 기준으로 맵을 확장/축소하고 노드 좌표를 함께 옮긴다.
 * 바꾸면 안 되는 것: resizeMap 이 노드를 잘라내지 않고 그대로 두는 것 (V-P07 이 잡는다).
 * 근거: SDD-09 §8, SDD-08 §7
 */
import type { Command } from './command.js';
import type { StageDocument } from '../model/stage.js';

export function setField(fp: string, value: number | boolean | string): Command { return { label: '필드 ' + fp, apply(d: StageDocument) { const parts = fp.split('.'); const r: any = { ...d }; let c: any = r; for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; } c[parts[parts.length - 1]!] = value; return r; }, revert(d: StageDocument) { return d; } }; }

export function setTable(tp: string, rows: unknown[]): Command { return { label: '표 ' + tp, apply(d: StageDocument) { const parts = tp.split('.'); const r: any = { ...d }; let c: any = r; for (let i = 0; i < parts.length - 1; i++) { c[parts[i]!] = { ...c[parts[i]!] }; c = c[parts[i]!]; } c[parts[parts.length - 1]!] = rows; return r; }, revert(d: StageDocument) { return d; } }; }

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
    revert(d: StageDocument) { return { ...d, map: oldMap, path: { ...d.path, nodes: oldNodes } }; } };
}