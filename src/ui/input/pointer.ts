/**
 * 목적: 포인터 이벤트 → 뷰 조작(팬·줌). M2-B 에서 도구로 확장된다.
 * 왜 이 구조인가: 마우스 이벤트를 캔버스 중심으로 통합하고, 팬(Space+드래그/중클릭)과
 *   줌(휠)을 처리한다. M2-B 에서 도구 상태기계가 이 입력을 가로챈다.
 * 바꾸면 안 되는 것: 줌 factor 1.1, 휠 한 칸에 zoomAt 호출, Space+드래그 팬.
 * 근거: SDD-03 §8 [D-03-08], SDD-09 §10 [D-09-10]
 */
import type { Store } from '../state.js';
import { View } from '../canvas/view.js';
import { StatusBar } from '../panels/status.js';

export function mountPointer(canvas: HTMLCanvasElement, store: Store, view: View, status: StatusBar): void {
  let panning = false;
  let panStartX = 0, panStartY = 0;
  let panStartPX = 0, panStartPY = 0;
  let spaceDown = false;

  canvas.oncontextmenu = (e) => e.preventDefault();

  canvas.addEventListener('keydown', (e) => { if (e.code === 'Space') { spaceDown = true; e.preventDefault(); } });
  canvas.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

  canvas.onwheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    view.zoomAt(e.offsetX, e.offsetY, factor);
    store.notifyViewChanged();
  };

  canvas.onmousedown = (e) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      panning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartPX = view.panX;
      panStartPY = view.panY;
      e.preventDefault();
      return;
    }
    // 셀 좌표 업데이트
    const map = store.state.history.doc.map;
    const { x, y } = view.screenToCell(e.offsetX, e.offsetY, map);
    status.setCell(x, y);
  };

  canvas.onmousemove = (e) => {
    if (panning) {
      view.panX = panStartPX + (e.clientX - panStartX);
      view.panY = panStartPY + (e.clientY - panStartY);
      store.notifyViewChanged();
      return;
    }
    const map = store.state.history.doc.map;
    const { x, y } = view.screenToCell(e.offsetX, e.offsetY, map);
    status.setCell(x, y);
  };

  canvas.onmouseup = () => { panning = false; };
  canvas.onmouseleave = () => { panning = false; };
}
