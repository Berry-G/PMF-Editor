/**
 * 목적: EditorState 와 Store. 편집 상태의 단일 진실 공급원.
 * 왜 이 구조인가: **뷰 변환(zoom/pan)은 View 인스턴스가 유일한 진실이다** — store.state.view 를 두지 않는다.
 *   viewVersion 카운터로 View 변경을 Store 구독자에 알린다. 레이어 토글·격자 표시는 EditorState 에 남긴다.
 * 바꾸면 안 되는 것: update() 가 얕은 병합을 하는 것. dispatch() 가 history.push 후 update() 하는 것.
 * 근거: SDD-01 §3 [D-01-03], SDD-08 §10 [D-08-10]
 */
import type { StageDocument } from '../core/model/stage.js';
import { History } from '../core/commands/command.js';
import type { Issue, ValidateContext } from '../core/validate/index.js';
import { validate } from '../core/validate/index.js';
import type { Reachability } from '../core/geometry/reach.js';
import { computeReachability } from '../core/geometry/reach.js';
import type { SimResult } from '../core/sim/actors.js';
import type { EnemyCatalogEntry } from '../core/sim/params.js';
import { DEFAULT_CATALOG } from '../core/sim/params.js';
import type { Command } from '../core/commands/command.js';

export type ToolId = 'brush' | 'line' | 'rect' | 'fill' | 'select' | 'eyedropper' | 'node' | 'edge' | 'object';
export type LayerId = 'tiles' | 'path' | 'objects' | 'reach' | 'issues' | 'sim';
export type Selection = { kind: 'none' } | { kind: 'cells'; x0: number; y0: number; x1: number; y1: number } | { kind: 'nodes'; ids: string[] } | { kind: 'edge'; index: number } | { kind: 'village'; x: number; y: number };

export interface EditorState {
  doc: StageDocument;
  history: History;
  selection: Selection;
  tool: ToolId;
  brushSize: 1 | 3 | 5;
  paletteCell: number;
  eraserCell: number;
  layers: Record<LayerId, boolean>;
  showGrid: boolean;
  /** View 변경 알림용 카운터. subscribe 에서 값이 바뀌면 View 를 다시 읽는다. */
  viewVersion: number;
  issues: Issue[];
  reach: Reachability | null;
  sim: SimResult | null;
  simStale: boolean;
  fileName: string;
  catalog: readonly EnemyCatalogEntry[];
}

export type StoreListener = (state: EditorState, changed: ReadonlySet<keyof EditorState>) => void;

export function defaultLayers(): Record<LayerId, boolean> {
  return { tiles: true, path: true, objects: true, reach: true, issues: true, sim: false };
}

export class Store {
  state: EditorState;
  private listeners: Set<StoreListener> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial: StageDocument) {
    const history = new History(initial);
    const reach = computeReachability(initial.map);
    const issues = validate(initial, { mode: 'tool', enemyCatalog: new Set(DEFAULT_CATALOG.map(c => c.name)) });
    this.state = {
      doc: initial, history, selection: { kind: 'none' },
      tool: 'brush', brushSize: 1, paletteCell: 3, eraserCell: 3,
      layers: defaultLayers(), showGrid: true, viewVersion: 0,
      issues, reach, sim: null, simStale: false,
      fileName: 'untitled', catalog: DEFAULT_CATALOG,
    };
  }

  subscribe(fn: StoreListener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  update(fn: (s: EditorState) => Partial<EditorState>): void {
    const patch = fn(this.state);
    const changed = new Set<keyof EditorState>();
    for (const key of Object.keys(patch) as (keyof EditorState)[]) {
      if (this.state[key] !== patch[key]) { changed.add(key); }
    }
    Object.assign(this.state, patch);
    if (changed.has('doc') || changed.has('history')) this.scheduleValidation();
    if (changed.size > 0) { for (const f of this.listeners) f(this.state, changed); }
  }

  /** View 가 바뀌었을 때 호출. viewVersion 을 올려 구독자에 알린다. */
  notifyViewChanged(): void {
    this.state.viewVersion++;
    for (const f of this.listeners) f(this.state, new Set<keyof EditorState>(['viewVersion']));
  }

  dispatch(cmd: Command): void { this.state.history.push(cmd); this.update(s => ({ doc: s.history.doc, simStale: s.sim !== null })); }

  private scheduleValidation(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const doc = this.state.history.doc;
      const ctx: ValidateContext = { mode: 'tool', enemyCatalog: new Set(this.state.catalog.map(c => c.name)) };
      this.update(() => ({ issues: validate(doc, ctx), reach: computeReachability(doc.map) }));
    }, 100);
  }
}