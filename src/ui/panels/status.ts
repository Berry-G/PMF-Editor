/**
 * 목적: 상태줄 — 셀 좌표(마우스 따라)·줌·도달 가능 B n/m (p%)·히스토리 개수.
 * 왜 이 구조인가: Store 구독으로 업데이트. 줌은 View 에서 직접 읽는다 (store.state.view 가 없다).
 * 바꾸면 안 되는 것: innerHTML 에 사용자 문자열(노드 id·적 이름)을 넣지 마라.
 * 근거: SDD-03 §1 [D-03-01], SDD-08 §11 [D-08-11]
 */
import type { Store } from '../state.js';
import { View } from '../canvas/view.js';
import { CELL_LABEL } from '../../core/model/cell.js';
import { cellAt } from '../../core/model/map.js';

export class StatusBar {
  private el: HTMLElement;
  private store: Store;
  private view: View;
  private _cellX = 0;
  private _cellY = 0;

  constructor(el: HTMLElement, store: Store, view: View) {
    this.el = el; this.store = store; this.view = view;
    store.subscribe(() => this.update());
    this.update();
  }

  setCell(x: number, y: number): void { this._cellX = x; this._cellY = y; this.update(); }

  private update(): void {
    const state = this.store.state;
    const doc = state.history.doc;
    const cell = cellAt(doc.map, this._cellX, this._cellY);
    const cellName = CELL_LABEL[cell] ?? '?';
    const reach = state.reach;
    const reachStr = reach ? `도달 가능 B ${reach.reachableBuildable}/${reach.totalBuildable} (${Math.round(reach.reachableBuildable / reach.totalBuildable * 100)}%)` : '';
    this.el.textContent = `셀 (${this._cellX}, ${this._cellY}) · ${cellName} · 줌 ${Math.round(this.view.zoom * 100)}%${reachStr ? ` · ${reachStr}` : ''} · 히스토리 ${state.history['undoStack']?.length ?? 0}`;
  }
}