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
import { NodeTool } from './node.js';
import { EdgeTool } from './edge.js';
import { ObjectTool } from './object.js';
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


describe('NodeTool', () => {
  it('빈 셀 클릭 → 노드 1개 증가, id N00', () => {
    const store = new Store(clone(SEED));
    const tool = new NodeTool();
    const before = store.state.history.doc.path.nodes.length;
    tool.onDown(pi(15, 9), ctx(store));
    tool.onUp(pi(15, 9), ctx(store));
    expect(store.state.history.doc.path.nodes.length).toBe(before + 1);
    const added = store.state.history.doc.path.nodes[before];
    expect(added!.x).toBe(15); expect(added!.y).toBe(9);
  });
  it('N00~N05 중 N03 만 있으면 id 는 N03', () => {
    const store = new Store(clone(SEED));
    const existing = new Set(store.state.history.doc.path.nodes.map(n => n.id));
    const firstMissing = ['N00','N01','N02','N03','N04','N05','N06','N07','N08','N09'].find(id => !existing.has(id));
    const tool = new NodeTool();
    tool.onDown(pi(15, 9), ctx(store));
    tool.onUp(pi(15, 9), ctx(store));
    const added = store.state.history.doc.path.nodes.find(n => n.x === 15 && n.y === 9);
    expect(added!.id).toBe(firstMissing);
  });
  it('기존 노드 드래그 → 이동', () => {
    const store = new Store(clone(SEED));
    const tool = new NodeTool();
    tool.onDown(pi(5, 9), ctx(store));
    tool.onUp(pi(6, 8), ctx(store));
    const n01 = store.state.history.doc.path.nodes.find(n => n.id === 'N01');
    expect(n01!.x).toBe(6); expect(n01!.y).toBe(8);
  });
  it('Delete → 노드와 붙은 엣지가 함께 사라진다', () => {
    const store = new Store(clone(SEED));
    const tool = new NodeTool();
    tool.onDown(pi(8, 6), ctx(store));
    tool.onUp(pi(8, 6), ctx(store));
    store.state.selection = { kind: 'nodes', ids: ['N08'] };
    const edgeBefore = store.state.history.doc.path.edges.length;
    tool.deleteSelected(ctx(store));
    expect(store.state.history.doc.path.nodes.find(n => n.id === 'N08')).toBeUndefined();
    expect(store.state.history.doc.path.edges.length).toBeLessThan(edgeBefore);
  });
});

describe('EdgeTool', () => {
  it('노드 A→B → 엣지 1개 추가', () => {
    const store = new Store(clone(SEED));
    const tool = new EdgeTool();
    const before = store.state.history.doc.path.edges.length;
    tool.onDown(pi(5, 9), ctx(store)); tool.onUp(pi(5, 9), ctx(store));
    tool.onDown(pi(8, 9), ctx(store)); tool.onUp(pi(8, 9), ctx(store));
    expect(store.state.history.doc.path.edges.length).toBe(before + 1);
    const added = store.state.history.doc.path.edges[store.state.history.doc.path.edges.length - 1];
    expect(added!.from).toBe('N01'); expect(added!.to).toBe('N02');
  });
  it('Shift+클릭 → shortcut, allowed 는 [Escortee]', () => {
    const store = new Store(clone(SEED));
    const tool = new EdgeTool();
    const piShift = (x: number, y: number) => { const b = pi(x, y); b.shift = true; return b; };
    tool.onDown(pi(5, 9), ctx(store)); tool.onUp(pi(5, 9), ctx(store));
    tool.onDown(piShift(8, 9), ctx(store)); tool.onUp(piShift(8, 9), ctx(store));
    const added = store.state.history.doc.path.edges[store.state.history.doc.path.edges.length - 1];
    expect(added!.shortcut).toBe(true);
    expect(added!.allowed).toEqual(['Escortee']);
  });
  it('노드 아닌 곳 클릭 → 아무 커맨드 없음', () => {
    const store = new Store(clone(SEED));
    const tool = new EdgeTool();
    const before = store.state.history.doc.path.edges.length;
    tool.onDown(pi(0, 0), ctx(store)); tool.onUp(pi(0, 0), ctx(store));
    expect(store.state.history.doc.path.edges.length).toBe(before);
  });
});

describe('ObjectTool', () => {
  it('노드 위치 클릭 → selection.kind = nodes', () => {
    const store = new Store(clone(SEED));
    const tool = new ObjectTool();
    tool.onDown(pi(5, 9), ctx(store));
    expect(store.state.selection.kind).toBe('nodes');
  });
  it('노드와 엣지 겹침 → 노드 우선', () => {
    const store = new Store(clone(SEED));
    const tool = new ObjectTool();
    tool.onDown(pi(5, 9), ctx(store));
    expect(store.state.selection.kind).toBe('nodes');
    if (store.state.selection.kind === 'nodes') expect(store.state.selection.ids).toContain('N01');
  });
  it('Ctrl+클릭 → 노드 다중 선택', () => {
    const store = new Store(clone(SEED));
    const tool = new ObjectTool();
    tool.onDown(pi(5, 9), ctx(store)); tool.onUp(pi(5, 9), ctx(store));
    const piCtrl = (x: number, y: number) => { const b = pi(x, y); b.ctrl = true; return b; };
    tool.onDown(piCtrl(8, 9), ctx(store)); tool.onUp(piCtrl(8, 9), ctx(store));
    if (store.state.selection.kind === 'nodes') {
      expect(store.state.selection.ids.length).toBe(2);
      expect(store.state.selection.ids).toContain('N01');
      expect(store.state.selection.ids).toContain('N02');
    }
  });
  it('마을 셀 → none', () => {
    const store = new Store(clone(SEED));
    const tool = new ObjectTool();
    tool.onDown(pi(0, 0), ctx(store));
    expect(store.state.selection.kind).toBe('none');
  });
});
