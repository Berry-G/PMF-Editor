/**
 * 목적: 레이어 토글 6개 (tiles/격자/경로/오브젝트/도달영역/검증). 실제로 켜고 꺼진다.
 * 왜 이 구조인가: LayerId 목록을 순회해 체크박스를 만들고 Store 의 view 상태와 동기화한다.
 * 바꾸면 안 되는 것: LayerId 목록. innerHTML 사용 금지.
 * 근거: SDD-03 §4 [D-03-04], SDD-08 §11 [D-08-11]
 */
import type { Store, LayerId } from '../state.js';

const LAYER_ITEMS: Array<{ id: LayerId | 'grid'; label: string }> = [
  { id: 'tiles', label: '타일' }, { id: 'grid', label: '격자' },
  { id: 'path', label: '경로' }, { id: 'objects', label: '오브젝트' },
  { id: 'reach', label: '도달 영역' }, { id: 'issues', label: '검증' },
  { id: 'sim', label: '시뮬' },
];

export function mountLayers(store: Store, container: HTMLElement): void {
  const heading = document.createElement('p');
  heading.className = 'section-title';
  heading.textContent = '레이어';
  container.append(heading);
  for (const { id, label } of LAYER_ITEMS) {
    const row = document.createElement('label');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '4px'; row.style.marginBottom = '2px'; row.style.cursor = 'pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.onchange = () => {
      if (id === 'grid') store.update((_s) => ({ showGrid: cb.checked }));
      else store.update((_s) => ({ layers: { ..._s.layers, [id]: cb.checked } }));
    };
    row.append(cb);
    const span = document.createElement('span');
    span.textContent = label;
    row.append(span);
    container.append(row);
  }
  store.subscribe((state) => {
    const inputs = container.querySelectorAll('input[type=checkbox]');
    LAYER_ITEMS.forEach((item, i) => {
      const input = inputs[i] as HTMLInputElement;
      if (item.id === 'grid') input.checked = state.showGrid;
      else input.checked = state.layers[item.id as LayerId];
    });
  });
}


