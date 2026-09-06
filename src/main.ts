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
import { mountTools } from './ui/panels/tools.js';
import { mountPathOps } from './ui/panels/pathops.js';
import { mountLayers } from './ui/panels/layers.js';
import { StatusBar } from './ui/panels/status.js';
import { mountPointer } from './ui/input/pointer.js';
import { mountKeyboard } from './ui/input/keyboard.js';
import { mountBottomResize } from './ui/input/split.js';
import { mountContextMenu } from './ui/panels/contextmenu.js';
import { mountProps } from './ui/panels/props.js';
import { mountTabs } from './ui/panels/tabs.js';
import { mountIssues } from './ui/panels/issues.js';
import { decode } from './core/toon/decode.js';
import { encode } from './core/toon/encode.js';
import { TOOL_VERSION } from './core/version.js';
import { saveDraft, loadDraft, clearDraft } from './io/draft.js';

function need<T extends Element>(s: string): T {
  const el = document.querySelector<T>(s);
  if (el === null) throw new Error('DOM 골격에 ' + s + ' 가 없다 (SDD-08 §11)');
  return el;
}

function main(): void {
  const seed = loadSeed();
  const store = new Store(seed);
  const view = new View();

  // 초안 복구
  const draft = loadDraft();
  if (draft) {
    const decoded = decode(draft.text);
    if (decoded.ok && confirm('「' + draft.name + '」의 저장되지 않은 작업이 있습니다. 복구할까요?')) {
      store.state.history.replace(decoded.value);
      store.update((_s) => ({ doc: store.state.history.doc, fileName: draft.name }));
    } else {
      clearDraft();
    }
  }

  const wrap = need<HTMLElement>('#canvas-wrap');
  const canvas = need<HTMLCanvasElement>('#canvas');
  const dpr = window.devicePixelRatio;
  // 왜 첫 번째만 맞추는가: `fitToMap` 은 줌과 팬을 **되돌린다**. ResizeObserver 는 창 크기 변경,
  //   그리고 하단 패널 높이 조절(ui/input/split.ts) 때마다 뛰므로, 매번 맞추면 손잡이를 끄는 동안
  //   보고 있던 자리가 계속 튕겨 나간다. 처음 한 번만 맞추고 그 뒤로는 사용자의 시점을 지킨다.
  let fitted = false;
  const resize = (): void => {
    const vw = wrap.clientWidth, vh = wrap.clientHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    if (!fitted) { view.fitToMap(seed.map, vw, vh); fitted = true; }
    store.notifyViewChanged();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
  new Renderer(canvas, store, view);
  mountTopbar(store, need<HTMLElement>('#topbar'));
  mountPalette(store, need<HTMLElement>('#palette'));
  mountTools(store, need<HTMLElement>('#tools'));
  mountPathOps(store, need<HTMLElement>('#path-ops'));
  mountLayers(store, need<HTMLElement>('#layers'));
  new Minimap(need<HTMLCanvasElement>('#minimap-canvas'), store, view);
  const status = new StatusBar(need<HTMLElement>('#statusbar'), store, view);
  mountPointer(canvas, store, view, status);
  mountKeyboard(store, view);
  mountProps(store, need<HTMLElement>('#props'));
  mountTabs(store, need<HTMLElement>('#tabs'), need<HTMLElement>('#tab-body'));
  mountIssues(store, need<HTMLElement>('#issues'), view, wrap);
  mountBottomResize(need<HTMLElement>('#app'), need<HTMLElement>('#bottom-resize'));
  mountContextMenu(canvas, store, view);

  // beforeunload: dirty 확인
  window.addEventListener('beforeunload', (e) => {
    if (store.state.history.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // 5초 디바운스 초안 저장 (SDD-09 §11)
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe((state) => {
    // 왜 여기에 가드가 없나: 예전에는 `dirty && !canUndo && !canRedo` 를 "저장 직후 무시" 라고
    //   적어 뒀는데, undo 는 redoStack 을 채우므로 그 조건은 도달할 수 없었다 — 죽은 코드였다.
    //   실제로 필요한 것은 dirty 검사뿐이고, 그건 아래 타이머 안에 있다.
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      draftTimer = null;
      if (state.history.dirty) {
        const text = encode(state.history.doc, { toolVersion: TOOL_VERSION, issues: state.issues });
        saveDraft(text, state.fileName);
      }
    }, 5000);
  });
}
main();