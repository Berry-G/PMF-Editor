/**
 * 목적: 하단 패널 높이를 드래그로 조절한다. 값은 `#app` 의 `--bottom-h` 로만 나간다.
 * 왜 이 구조인가: 레이아웃은 CSS Grid 한 군데(`styles.css`)가 정하므로, 여기서는 행 높이를
 *   직접 만지지 않고 변수 하나만 바꾼다. 캔버스는 `#canvas-wrap` 을 보는 ResizeObserver 가
 *   알아서 따라오므로 캔버스 크기를 여기서 계산하지 않는다 (계산이 두 곳에 생기면 어긋난다).
 * 바꾸면 안 되는 것: 최소 높이(탭 줄이 잘리면 탭을 못 고른다)와 최대 높이(캔버스가 사라지면
 *   되돌릴 방법이 화면에 없다). 저장 실패는 무시한다 — 높이 하나 때문에 툴이 죽으면 안 된다.
 * 근거: SDD-03 §1 [D-03-01], SDD-08 §11 [D-08-11]
 */

const KEY = 'pmf-editor.bottomHeight';
/** 기본값. `styles.css` 의 `--bottom-h` 초기값과 같아야 한다. */
const DEFAULT_H = 200;
/** 탭 줄(약 28px) + 한 줄이 보이는 최소치. 이보다 낮으면 탭을 못 고른다. */
const MIN_H = 72;
/** 캔버스에 남겨 둘 최소 높이. 캔버스가 사라지면 손잡이를 되돌릴 단서가 화면에 없다. */
const CANVAS_MIN = 160;

function maxH(): number {
  // 왜 innerHeight 기준인가: 상단 바 40px + 캔버스 최소치를 뺀 나머지가 하단이 쓸 수 있는 전부다.
  return Math.max(MIN_H, window.innerHeight - 40 - CANVAS_MIN);
}

function clamp(h: number): number {
  return Math.min(maxH(), Math.max(MIN_H, Math.round(h)));
}

function apply(app: HTMLElement, h: number): void {
  app.style.setProperty('--bottom-h', clamp(h) + 'px');
}

function save(h: number): void {
  try { localStorage.setItem(KEY, String(clamp(h))); } catch { /* 저장 못 해도 동작에는 지장 없다 */ }
}

function load(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? clamp(v) : DEFAULT_H;
  } catch { return DEFAULT_H; }
}

/** 현재 하단 높이(px). 저장값이 없으면 기본값. */
function currentH(app: HTMLElement): number {
  const v = Number.parseFloat(app.style.getPropertyValue('--bottom-h'));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_H;
}

export function mountBottomResize(app: HTMLElement, handle: HTMLElement): void {
  apply(app, load());

  let dragging = false;
  let startY = 0;
  let startH = DEFAULT_H;

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    startH = currentH(app);
    handle.setPointerCapture(e.pointerId);
    // 왜: 드래그 중에 아래 패널의 글자가 잡혀 파랗게 물드는 걸 막는다.
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    // 위로 끌면 하단이 커진다 — 손잡이가 하단의 윗변이기 때문이다.
    apply(app, startH + (startY - e.clientY));
  });

  const end = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = '';
    save(currentH(app));
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  // 왜 더블클릭 초기화가 필요한가: 손잡이를 화면 밖까지 끌어 놓고 되돌리는 방법을 모르면
  //   기획자는 새로고침밖에 못 하고, 그러면 저장값이 그대로라 같은 화면이 다시 나온다.
  handle.addEventListener('dblclick', () => { apply(app, DEFAULT_H); save(DEFAULT_H); });

  // 창을 줄이면 저장해 둔 높이가 최대치를 넘을 수 있다. 그때 다시 조인다.
  window.addEventListener('resize', () => { apply(app, currentH(app)); });
}
