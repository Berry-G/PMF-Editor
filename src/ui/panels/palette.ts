/**
 * 목적: 팔레트 — 셀 7종 (SDD-03 §2 순서). 선택 상태만 바뀐다.
 * 왜 이 구조인가: PALETTE_ORDER 순서(SDD-03 §2)로 셀 7종을 표시하고 선택 상태를 Store 에 반영한다.
 * 바꾸면 안 되는 것: PALETTE_ORDER 순서 (단축키 1~7).
 * 근거: SDD-03 §2 [D-03-02], SDD-08 §11 [D-08-11]
 */
import type { Store } from '../state.js';
import { PALETTE_ORDER, CELL_LABEL } from '../../core/model/cell.js';
import { COLOR, UI } from '../../core/palette.js';
import { Cell } from '../../core/model/cell.js';

export function mountPalette(store: Store, container: HTMLElement): void {
  const heading = document.createElement('p');
  heading.className = 'section-title';
  heading.textContent = '팔레트';
  container.append(heading);
  const items: HTMLElement[] = [];
  for (const [i, cell] of PALETTE_ORDER.entries()) {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '6px'; row.style.marginBottom = '3px'; row.style.cursor = 'pointer';
    row.dataset.cell = String(cell);
    const swatch = document.createElement('span');
    swatch.style.width = '14px'; swatch.style.height = '14px'; swatch.style.background = COLOR[cell];
    swatch.style.border = '1px solid ' + UI.panelBorder;
    row.append(swatch);
    const label = document.createElement('span');
    label.textContent = (i + 1) + '  ' + CELL_LABEL[cell];
    row.append(label);
    row.onclick = () => store.update((_s2) => ({ paletteCell: cell }));
    container.append(row);
    items.push(row);
  }
  store.subscribe((state) => {
    for (const row of items) {
      const cell = Number(row.dataset.cell) as Cell;
      row.style.background = state.paletteCell === cell ? UI.selection + '30' : 'transparent';
    }
  });
}