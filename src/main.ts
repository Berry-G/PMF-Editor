/**
 * 목적: 조립 지점. DOM 골격을 찾아 각 부분을 붙인다. **로직을 두지 않는다.**
 * 왜 이 구조인가: 조립과 로직이 섞이면 어디서 상태가 바뀌는지 추적할 수 없다.
 *   M0 단계에서는 붙일 패널이 아직 없으므로, 배선이 살아 있음을 눈으로 확인할 최소한만 그린다
 *   (팔레트 색이 게임과 같은지, 캔버스·DPR·리사이즈가 도는지).
 * 바꾸면 안 되는 것: 여기서 문서(StageDocument)를 직접 만들거나 바꾸지 마라 — 커맨드만이 문서를 바꾼다.
 *   M2 에서 이 파일의 임시 렌더는 `ui/canvas/renderer.ts` 로 대체되고 여기엔 조립만 남는다.
 * 근거: SDD-01 §2 [D-01-02], SDD-07 M0 [D-07-01], SDD-08 §1-4 [D-08-01]
 */
import './styles.css';
import { CELL_LABEL, PALETTE_ORDER } from './core/model/cell.js';
import { BACKGROUND, CELL_PX, COLOR, UI } from './core/palette.js';
import { SCHEMA } from './core/schema.js';
import { TOOL_VERSION } from './core/version.js';

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  // 왜: 골격이 사라진 채 조용히 반쪽만 동작하는 것보다, 조립 시점에 크게 실패하는 편이 낫다.
  if (el === null) throw new Error(`DOM 골격에 ${selector} 가 없다 (SDD-08 §11)`);
  return el;
}

function mountTopbar(): void {
  const bar = need<HTMLElement>('#topbar');
  const title = document.createElement('strong');
  title.textContent = 'PMF Editor';
  const schema = document.createElement('span');
  schema.style.color = UI.textDim;
  schema.textContent = SCHEMA;
  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = TOOL_VERSION;
  bar.append(title, schema, version);
}

function mountPaletteStub(): void {
  const box = need<HTMLElement>('#palette');
  const heading = document.createElement('p');
  heading.className = 'section-title';
  heading.textContent = '팔레트 (M2 에서 도구가 붙는다)';
  box.append(heading);
  for (const [i, cell] of PALETTE_ORDER.entries()) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.marginBottom = '3px';
    const swatch = document.createElement('span');
    swatch.style.width = '14px';
    swatch.style.height = '14px';
    swatch.style.background = COLOR[cell];
    swatch.style.border = `1px solid ${UI.panelBorder}`;
    const label = document.createElement('span');
    label.textContent = `${i + 1}  ${CELL_LABEL[cell]}`;
    row.append(swatch, label);
    box.append(row);
  }
}

/**
 * M0 임시 렌더 — 캔버스가 DPR·리사이즈에 맞게 도는지 눈으로 확인하기 위한 것.
 * M2 에서 `Renderer` 로 대체된다. 좌표 변환 수식을 여기에 늘리지 마라 (SDD-09 §9-1).
 */
function mountCanvasStub(): void {
  const wrap = need<HTMLElement>('#canvas-wrap');
  const canvas = need<HTMLCanvasElement>('#canvas');
  const status = need<HTMLElement>('#statusbar');

  const draw = (): void => {
    const dpr = window.devicePixelRatio;
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, vw, vh);

    const cols = PALETTE_ORDER.length;
    const originX = Math.round((vw - cols * CELL_PX) / 2);
    const originY = Math.round(vh / 2 - CELL_PX);
    for (const [i, cell] of PALETTE_ORDER.entries()) {
      ctx.fillStyle = COLOR[cell];
      ctx.fillRect(originX + i * CELL_PX, originY, CELL_PX, CELL_PX);
      ctx.strokeStyle = UI.grid;
      ctx.strokeRect(originX + i * CELL_PX + 0.5, originY + 0.5, CELL_PX - 1, CELL_PX - 1);
    }
    ctx.fillStyle = UI.textDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M0 골격 — 맵 캔버스는 M2 에서 붙는다', vw / 2, originY + CELL_PX + 20);

    status.textContent = `캔버스 ${vw}×${vh} · DPR ${dpr} · 셀 ${CELL_PX}px`;
  };

  new ResizeObserver(draw).observe(wrap);
  draw();
}

mountTopbar();
mountPaletteStub();
mountCanvasStub();
