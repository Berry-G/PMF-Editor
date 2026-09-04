/**
 * 목적: EditorState 와 Store. 편집 상태의 단일 진실 공급원.
 * 왜 이 구조인가: Store.update() 로만 상태가 바뀌고 구독자는 changed 키로 무엇이 바뀌었는지 안다.
 *   history 가 바뀌면 검증·도달 영역을 100ms 디바운스로 재계산한다.
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
export interface ViewState { zoom: number; panX: number; panY: number; layers: Record<LayerId, boolean>; showGrid: boolean; }
export interface EditorState { doc: StageDocument; history: History; selection: Selection; tool: ToolId; brushSize: 1 | 3 | 5; paletteCell: number; eraserCell: number; view: ViewState; issues: Issue[]; reach: Reachability | null; sim: SimResult | null; simStale: boolean; fileName: string; catalog: readonly EnemyCatalogEntry[]; }
export type StoreListener = (state: EditorState, changed: ReadonlySet<keyof EditorState>) => void;
export function createDefaultView(): ViewState { return { zoom: 1, panX: 0, panY: 0, layers: { tiles: true, path: true, objects: true, reach: true, issues: true, sim: false }, showGrid: true }; }

export class Store {
  state: EditorState;
  private listeners: Set<StoreListener> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(initial: StageDocument) {
    const history = new History(initial); const reach = computeReachability(initial.map);
    const issues = validate(initial, { mode: 'tool', enemyCatalog: new Set(DEFAULT_CATALOG.map(c => c.name)) });
    this.state = { doc: initial, history, selection: { kind: 'none' }, tool: 'brush', brushSize: 1, paletteCell: 3, eraserCell: 3, view: createDefaultView(), issues, reach, sim: null, simStale: false, fileName: 'untitled', catalog: DEFAULT_CATALOG };
  }
  subscribe(fn: StoreListener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  update(fn: (s: EditorState) => Partial<EditorState>): void {
    const patch = fn(this.state); const changed = new Set<keyof EditorState>();
    for (const key of Object.keys(patch) as (keyof EditorState)[]) { if ((this.state as any)[key] !== patch[key]) { changed.add(key); (this.state as any)[key] = patch[key]; } }
    if (changed.has('doc') || changed.has('history')) this.scheduleValidation();
    if (changed.size > 0) { for (const f of this.listeners) f(this.state, changed); }
  }
  dispatch(cmd: Command): void { this.state.history.push(cmd); this.update(s => ({ doc: s.history.doc, simStale: s.sim !== null })); }
  private scheduleValidation(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null; const doc = this.state.history.doc;
      const ctx: ValidateContext = { mode: 'tool', enemyCatalog: new Set(this.state.catalog.map(c => c.name)) };
      this.update(() => ({ issues: validate(doc, ctx), reach: computeReachability(doc.map) }));
    }, 100);
  }
}