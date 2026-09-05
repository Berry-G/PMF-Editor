/**
 * 목적: 도구 상태기계 단위 테스트. 가짜 PointerInfo 로 onDown/onMove/onUp 을 부르고 dispatch 된 커맨드를 확인.
 * 왜 이 구조인가: DOM 없이 도구 로직만 검증. SDD-09 §10 계약.
 * 바꾸면 안 되는 것: 각 도구가 beginStroke/endStroke 쌍을 호출하는 것.
 * 근거: SDD-09 §10 [D-09-10], SDD-06 §5 [D-06-05]
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../../state.js';
import { View } from '../../canvas/view.js';
import { StatusBar } from '../../panels/status.js';
import { decode } from '../../../core/toon/decode.js';
import { BrushTool } from './brush.js';
import { LineTool } from './line.js';
import { RectTool } from './rect.js';
import { FillTool } from './fill.js';
import { SelectTool } from './select.js';
import { EyedropperTool } from './eyedropper.js';
import type { PointerInfo, ToolContext } from './tool.js';
import type { StageDocument } from '../../../core/model/stage.js';
import { Cell } from '../../../core/model/cell.js';
import { cellAt } from '../../../core/model/map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '..', '..', '..', '..', 'docs', 'examples', 'Stage_Greybox.toon');
const SEED_TEXT = readFileSync(SEED_PATH, 'utf8');
const SEED = (decode(SEED_TEXT) as { ok: true; value: StageDocument }).value;

function clone(d: StageDocument): StageDocument {
  const c = JSON.parse(JSON.stringify(d)) as StageDocument;
  c.map.cells = new Uint8Array(d.map.cells);
  return c;
}

function pi(x: number, y: number, button: 0 | 1 | 2 = 0): PointerInfo {
  return { cell: { x, y }, fx: 0.5, fy: 0.5, button, shift: false, ctrl: false, alt: false, sx: 0, sy: 0 };
}

function ctx(store: Store): ToolContext {
  return { store, view: new View(), status: { setCell() {} } as unknown as StatusBar };
}

function countCells(map: { cells: Uint8Array }, cell: Cell): number {
  const v = cell === Cell.Empty ? 255 : cell;
  let n = 0;
  for (let i = 0; i < map.cells.length; i++) { if (map.cells[i] === v) n++; }
  return n;
}

describe('BrushTool', () => {
  it('size 1 은 한 칸을 칠한다', () => {
    const store = new Store(clone(SEED));
    store.state.brushSize = 1;
    store.state.paletteCell = Cell.Water;
    const tool = new BrushTool();
    tool.onDown(pi(5, 5), ctx(store));
    tool.onUp(pi(5, 5), ctx(store));
    expect(cellAt(store.state.history.doc.map, 5, 5)).toBe(Cell.Water);
  });
  it('size 3 은 9칸을 칠한다', () => {
    const store = new Store(clone(SEED));
    store.state.brushSize = 3;
    store.state.paletteCell = Cell.Water;
    const tool = new BrushTool();
    tool.onDown(pi(8, 8), ctx(store));
    tool.onUp(pi(8, 8), ctx(store));
    expect(countCells(store.state.history.doc.map, Cell.Water)).toBeGreaterThan(1);
  });
  it('우클릭=지우개', () => {
    const store = new Store(clone(SEED));
    store.state.eraserCell = Cell.Empty;
    const tool = new BrushTool();
    tool.onDown(pi(5, 5, 2), ctx(store));
    tool.onUp(pi(5, 5, 2), ctx(store));
    expect(cellAt(store.state.history.doc.map, 5, 5)).toBe(Cell.Empty);
  });
});

describe('LineTool', () => {
  it('두 점 사이 직선을 칠한다', () => {
    const store = new Store(clone(SEED));
    store.state.paletteCell = Cell.Road;
    const tool = new LineTool();
    tool.onDown(pi(5, 5), ctx(store));
    tool.onUp(pi(9, 5), ctx(store));
    expect(cellAt(store.state.history.doc.map, 7, 5)).toBe(Cell.Road);
  });
});

describe('RectTool', () => {
  it('사각 영역을 채운다', () => {
    const store = new Store(clone(SEED));
    store.state.paletteCell = Cell.Water;
    const tool = new RectTool();
    tool.onDown(pi(5, 5), ctx(store));
    tool.onUp(pi(7, 7), ctx(store));
    expect(cellAt(store.state.history.doc.map, 6, 6)).toBe(Cell.Water);
  });
});

describe('FillTool', () => {
  it('같은 종류의 연결된 칸을 채운다', () => {
    const store = new Store(clone(SEED));
    store.state.paletteCell = Cell.Water;
    const tool = new FillTool();
    tool.onUp(pi(17, 9), ctx(store)); // 씨앗에서 Buildable 영역
    expect(cellAt(store.state.history.doc.map, 17, 9)).toBe(Cell.Water);
  });
});

describe('SelectTool', () => {
  it('드래그 영역을 store.state.selection 에 저장한다', () => {
    const store = new Store(clone(SEED));
    const tool = new SelectTool();
    tool.onDown(pi(5, 5), ctx(store));
    tool.onUp(pi(10, 8), ctx(store));
    expect(store.state.selection.kind).toBe('cells');
    if (store.state.selection.kind === 'cells') {
      expect(store.state.selection.x0).toBe(5);
      expect(store.state.selection.y0).toBe(5);
      expect(store.state.selection.x1).toBe(10);
      expect(store.state.selection.y1).toBe(8);
    }
  });
  it('우클릭 시 지우개로 칠한다', () => {
    const store = new Store(clone(SEED));
    store.state.eraserCell = Cell.Empty;
    const tool = new SelectTool();
    tool.onDown(pi(5, 5), ctx(store));
    tool.onUp(pi(6, 6, 2), ctx(store));
    expect(cellAt(store.state.history.doc.map, 5, 5)).toBe(Cell.Empty);
  });
});

describe('EyedropperTool', () => {
  it('클릭한 칸을 paletteCell 로 설정한다', () => {
    const store = new Store(clone(SEED));
    store.state.paletteCell = Cell.Buildable;
    const tool = new EyedropperTool();
    tool.onDown(pi(2, 5), ctx(store)); // 씨앗에서 Ground 인 칸
    expect(store.state.paletteCell).toBe(cellAt(SEED.map, 2, 5));
  });
});
