/**
 * 목적: 조립 지점. DOM 골격을 찾아 각 부분을 붙인다. **로직을 두지 않는다.**
 * 왜 이 구조인가: 조립과 로직이 섞이면 어디서 상태가 바뀌는지 추적할 수 없다.
 *   ResizeObserver + DPR + rAF 한 프레임 합성.
 * 바꾸면 안 되는 것: 여기서 문서를 직접 만들거나 바꾸지 마라 — 커맨드만이 문서를 바꾼다.
 * 근거: SDD-01 §2 [D-01-02], SDD-08 §1-4 [D-08-01]
 */
import './styles.css';
import { loadSeed } from './core/model/factory.js';
import { Store } from './ui/state.js';
import { View } from './ui/canvas/view.js';
import { Renderer } from './ui/canvas/renderer.js';
import { Minimap } from './ui/canvas/minimap.js';
import { mountTopbar } from './ui/panels/topbar.js';
import { mountPalette } from './ui/panels/palette.js';
import { mountLayers } from './ui/panels/layers.js';
import { StatusBar } from './ui/panels/status.js';
import { mountPointer } from './ui/input/pointer.js';
import { mountKeyboard } from './ui/input/keyboard.js';

function need<T extends Element>(s: string): T {
  const el = document.querySelector<T>(s);
  if (el === null) throw new Error('DOM 골격에 ' + s + ' 가 없다 (SDD-08 §11)');
  return el;
}

function main(): void {
  const seed = loadSeed();
  const store = new Store(seed);
  const view = new View();
  const wrap = need<HTMLElement>('#canvas-wrap');
  const canvas = need<HTMLCanvasElement>('#canvas');
  const dpr = window.devicePixelRatio;
  const resize = (): void => {
    const vw = wrap.clientWidth, vh = wrap.clientHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    view.fitToMap(seed.map, vw, vh);
    store.notifyViewChanged();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
  new Renderer(canvas, store, view);
  mountTopbar(store, need<HTMLElement>('#topbar'));
  mountPalette(store, need<HTMLElement>('#palette'));
  mountLayers(store, need<HTMLElement>('#layers'));
  new Minimap(need<HTMLCanvasElement>('#minimap-canvas'), store, view);
  const status = new StatusBar(need<HTMLElement>('#statusbar'), store, view);
  mountPointer(canvas, store, view, status);
  mountKeyboard(store, view);
}
main();