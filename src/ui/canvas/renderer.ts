/**
 * 목적: 레이어 4장(타일·오버레이·오브젝트·시뮬) 관리와 합성.
 * 왜 이 구조인가: SDD-09 §9-2 레이어 구조. 합성은 rAF 한 번에.
 *   좌표 변환은 View 에만. 색은 core/palette.ts 에서만.
 * 바꾸면 안 되는 것: imageSmoothingEnabled = false. 격자 S>=8, 눈금 S>=16.
 * 근거: SDD-09 §9 [D-09-09], SDD-01 §4 [D-01-04]
 */
import type { Store } from '../state.js';
import type { EditorState } from '../state.js';
import { CELL_PX, BACKGROUND, COLOR, UI, ACTOR, ACTOR_SCALE, EDGE } from '../../core/palette.js';
import { Cell } from '../../core/model/cell.js';
import { cellAt } from '../../core/model/map.js';
import { View } from './view.js';
import { LayerCanvas } from './layer.js';
import type { MapData, PathNode, StageDocument } from '../../core/model/stage.js';
import type { Issue } from '../../core/validate/index.js';
import type { Reachability } from '../../core/geometry/reach.js';

const CELL = CELL_PX;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private store: Store;
  private view: View;
  private tiles: LayerCanvas;
  private overlay: LayerCanvas;
  private objects: LayerCanvas;
  private rafId: number | null = null;
  private dirtyFlag = false;
  private lastDoc: StageDocument | null = null;

  constructor(target: HTMLCanvasElement, store: Store, view: View) {
    this.view = view; this.store = store;
    const ctx = target.getContext('2d');
    if (ctx === null) throw new Error('대상 캔버스 컨텍스트를 얻을 수 없다');
    this.ctx = ctx;
    const map = store.state.doc.map;
    this.tiles = new LayerCanvas(map.width, map.height);
    this.overlay = new LayerCanvas(map.width, map.height);
    this.objects = new LayerCanvas(map.width, map.height);
    this.tiles.markAllDirty(); this.overlay.markAllDirty(); this.objects.markAllDirty();
    this.dirtyFlag = true;
    this.store.subscribe((_s, c) => {
      if (c.has('history') || c.has('doc')) { this.lastDoc = null; this.dirtyFlag = true; }
      if (c.has('reach') || c.has('issues') || c.has('layers')) { this.overlay.markAllDirty(); this.objects.markAllDirty(); this.dirtyFlag = true; }
      if (c.has('viewVersion') || c.has('previewCells') || c.has('selection') || c.has('simPlayTime') || c.has('simPlaying') || c.has('sim')) this.dirtyFlag = true;
      this.requestFrame();
    });
  }

  requestFrame(): void { if (this.rafId === null) this.rafId = requestAnimationFrame(() => this.frame()); }

  private frame(): void {
    this.rafId = null;
    if (!this.dirtyFlag) return;
    const state = this.store.state;
    const doc = state.history.doc;
    const map = doc.map;
    if (this.lastDoc !== doc) {
      this.tiles = new LayerCanvas(map.width, map.height);
      this.overlay = new LayerCanvas(map.width, map.height);
      this.objects = new LayerCanvas(map.width, map.height);
      this.tiles.markAllDirty(); this.overlay.markAllDirty(); this.objects.markAllDirty();
      this.lastDoc = doc;
    }
    this.drawTiles(map);
    this.drawOverlay(map, state.reach, state.issues);
    this.drawObjects(doc, state.layers.issues ? state.issues : []);
    this.composite(state);
    this.dirtyFlag = false;
  }

  private drawTiles(map: MapData): void {
    const d = this.tiles.takeDirty(); if (d === null) return;
    const ctx = this.tiles.ctx2d; const w = map.width; const h = map.height;
    const x0 = Math.max(0, Math.floor(d.x0 / CELL)), y0 = Math.max(0, Math.floor(d.y0 / CELL));
    const x1 = Math.min(w, Math.ceil(d.x1 / CELL)), y1 = Math.min(h, Math.ceil(d.y1 / CELL));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const cell = cellAt(map, x, y) as Cell;
      if (cell === Cell.Empty) continue;
      ctx.fillStyle = COLOR[cell];
      ctx.fillRect(x * CELL, (h - 1 - y) * CELL, CELL, CELL);
    }
  }

  private drawOverlay(map: MapData, reach: Reachability | null, issues: Issue[]): void {
    const d = this.overlay.takeDirty(); if (d === null) return;
    const ctx = this.overlay.ctx2d; const w = map.width; const h = map.height;
    ctx.clearRect(0, 0, w * CELL, h * CELL);
    if (reach !== null) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ri = reach.regionOf[y * w + x]!;
        if (ri >= 0 && cellAt(map, x, y) as Cell === Cell.Buildable) {
          ctx.fillStyle = UI.reach[ri % UI.reach.length] + '40';
          ctx.fillRect(x * CELL, (h - 1 - y) * CELL, CELL, CELL);
        } else if (ri === -1 && cellAt(map, x, y) as Cell === Cell.Buildable) {
          this.hatch(ctx, x * CELL, (h - 1 - y) * CELL, CELL, CELL, UI.unreachHatch);
        }
      }
    }
    for (const issue of issues) if (issue.cells) {
      const color = issue.severity === 'error' ? UI.error : issue.severity === 'warning' ? UI.warning : UI.info;
      for (const c of issue.cells) {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.strokeRect(c.x * CELL + 1, (h - 1 - c.y) * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private hatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (let i = -h; i < w + h; i += 4) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); }
    ctx.restore();
  }
private drawObjects(doc: StageDocument, issues: Issue[] = []): void {
    const d = this.objects.takeDirty(); if (d === null) return;
    const ctx = this.objects.ctx2d; const h = doc.map.height; const w = doc.map.width;
    const { nodes, edges } = doc.path;
    ctx.clearRect(0, 0, w * CELL, h * CELL);
    for (const e of edges) {
      const fn = nodes.find((n: PathNode) => n.id === e.from);
      const tn = nodes.find((n: PathNode) => n.id === e.to);
      if (!fn || !tn) continue;
      const x1 = fn.x * CELL + CELL / 2, y1 = (h - 1 - fn.y) * CELL + CELL / 2;
      const x2 = tn.x * CELL + CELL / 2, y2 = (h - 1 - tn.y) * CELL + CELL / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = e.shortcut ? EDGE.shortcut : EDGE.normal;
      ctx.setLineDash(e.shortcut ? [8, 8] : []); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      // 왜: 화살촉은 **단방향 엣지에만** 그린다. 양방향에 그리면 저작 방향(from→to)이
      //   진행 방향처럼 보여 일방통행으로 읽힌다 — 실제로 그 오해가 났다 (2026-09-06).
      //   씨앗은 18개 중 17개가 양방향이라 화살표가 거의 사라지는데, 그게 사실에 맞는다:
      //   일방통행이 예외이므로 예외만 표시한다.
      if (!e.bidirectional) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = e.shortcut ? EDGE.shortcut : EDGE.normal;
        ctx.beginPath(); ctx.moveTo(mx + 8 * Math.cos(ang), my + 8 * Math.sin(ang));
        ctx.lineTo(mx + 4 * Math.cos(ang + 2.5), my + 4 * Math.sin(ang + 2.5));
        ctx.lineTo(mx + 4 * Math.cos(ang - 2.5), my + 4 * Math.sin(ang - 2.5));
        ctx.closePath(); ctx.fill();
      }
    }
    // 어느 노드·엣지가 문제인지 먼저 모은다. 한 대상에 여러 이슈가 붙으면 **더 심한 쪽**을 쓴다.
    const nodeSeverity = new Map<string, 'error' | 'warning'>();
    const edgeSeverity = new Map<number, 'error' | 'warning'>();
    for (const is of issues) {
      if (is.severity !== 'error' && is.severity !== 'warning') continue;
      for (const id of is.nodeIds ?? []) {
        if (is.severity === 'error' || !nodeSeverity.has(id)) nodeSeverity.set(id, is.severity);
      }
      if (is.edgeIndex !== undefined) {
        if (is.severity === 'error' || !edgeSeverity.has(is.edgeIndex)) edgeSeverity.set(is.edgeIndex, is.severity);
      }
    }
    // 문제 엣지는 선을 한 번 더 굵게 덧그린다 — 얇은 선에 테두리를 두를 수 없다.
    for (const [ei, sev] of edgeSeverity) {
      const e = edges[ei]; if (!e) continue;
      const fn = nodes.find((n: PathNode) => n.id === e.from);
      const tn = nodes.find((n: PathNode) => n.id === e.to);
      if (!fn || !tn) continue;
      ctx.beginPath();
      ctx.moveTo(fn.x * CELL + CELL / 2, (h - 1 - fn.y) * CELL + CELL / 2);
      ctx.lineTo(tn.x * CELL + CELL / 2, (h - 1 - tn.y) * CELL + CELL / 2);
      ctx.strokeStyle = sev === 'error' ? UI.error : UI.warning; ctx.lineWidth = 5;
      ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
    }

    for (const n of nodes) {
      const cx = n.x * CELL + CELL / 2, cy = (h - 1 - n.y) * CELL + CELL / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = n.role === 'start' ? EDGE.nodeStart : n.role === 'exit' ? EDGE.nodeExit : EDGE.nodeNormal;
      ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      // 검증 마커: 문제를 가리키는 노드에 굵은 테두리를 두른다 (SDD-03 §5).
      // 왜 노드를 그린 **직후** 인가: 노드 원 위에 겹쳐야 어느 노드인지 분명하다.
      //   ❌ 는 빨강, ⚠️ 는 노랑. ℹ️ 는 그리지 않는다 — V-M06 은 상시 발화라 늘 켜져 있게 된다.
      const sev = nodeSeverity.get(n.id);
      if (sev) {
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.strokeStyle = sev === 'error' ? UI.error : UI.warning; ctx.lineWidth = 2.5; ctx.stroke();
      }
      if (doc.burst.triggerNodeIds.includes(n.id)) {
        ctx.fillStyle = EDGE.shortcut; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('⚡', cx, cy - 12);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cellAt(doc.map, x, y) === Cell.VillageSlot) {
        const cx = x * CELL + CELL / 2, cy = (h - 1 - y) * CELL + CELL / 2;
        const s = CELL * ACTOR_SCALE.village / 2;
        ctx.fillStyle = ACTOR.village; ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      }
    }
    const sn = nodes.find((n: PathNode) => n.role === "start");
    if (sn) {
      const cx = sn.x * CELL + CELL / 2, cy = (h - 1 - sn.y) * CELL + CELL / 2;
      const es = CELL * ACTOR_SCALE.escortee / 2, ms = CELL * ACTOR_SCALE.mother / 2;
      // 왜 -ms 인가: `fillRect` 의 첫 두 인자는 **좌상단**이다. 예전 코드는 (cx+4, cy+4) 였는데
      //   그러면 중심이 cx+28 로 밀려 거의 한 칸 어긋난 자리에 모체가 그려졌다
      //   (2026-09-06 사용자 보고). 둘은 같은 셀에서 출발한다 — ADR-E05.
      // 왜 모체를 먼저 그리는가: 모체 사각(1.5칸)이 보호대상 원(0.9칸)보다 크다. 나중에 그리면
      //   보호대상을 통째로 덮는다. 큰 것을 뒤로 보내야 둘 다 보인다.
      ctx.fillStyle = ACTOR.mother; ctx.fillRect(cx - ms, cy - ms, ms * 2, ms * 2);
      ctx.fillStyle = ACTOR.escortee; ctx.beginPath(); ctx.arc(cx, cy, es, 0, Math.PI * 2); ctx.fill();
    }
    const en = nodes.find((n: PathNode) => n.role === "exit");
    if (en) {
      const cx = en.x * CELL + CELL / 2, cy = (h - 1 - en.y) * CELL + CELL / 2, r = CELL * 0.55;
      ctx.strokeStyle = ACTOR.exit; ctx.lineWidth = CELL * 0.08;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  private composite(state: EditorState): void {
    const map = state.history.doc.map;
    const dpr = window.devicePixelRatio;
    const vw = this.ctx.canvas.width / dpr, vh = this.ctx.canvas.height / dpr;
    const S = CELL * this.view.zoom, px = this.view.panX, py = this.view.panY;
    const layers = state.layers;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = BACKGROUND; this.ctx.fillRect(0, 0, vw, vh);
    if (layers.tiles) this.ctx.drawImage(this.tiles.canvas, px, py, map.width * S, map.height * S);
    if (layers.reach || layers.issues) this.ctx.drawImage(this.overlay.canvas, px, py, map.width * S, map.height * S);
    if (layers.path || layers.objects) this.ctx.drawImage(this.objects.canvas, px, py, map.width * S, map.height * S);
    if (layers.sim && state.sim) this.drawSim(state, px, py, S);
    if (state.showGrid && S >= 8) {
      this.ctx.strokeStyle = UI.grid; this.ctx.lineWidth = 1;
      for (let x = 0; x <= map.width; x++) { this.ctx.beginPath(); this.ctx.moveTo(px + x * S, py); this.ctx.lineTo(px + x * S, py + map.height * S); this.ctx.stroke(); }
      for (let y = 0; y <= map.height; y++) { this.ctx.beginPath(); this.ctx.moveTo(px, py + y * S); this.ctx.lineTo(px + map.width * S, py + y * S); this.ctx.stroke(); }
      if (S >= 16) {
        this.ctx.strokeStyle = UI.gridMajor; this.ctx.lineWidth = 2;
        for (let x = 0; x <= map.width; x += 5) { this.ctx.beginPath(); this.ctx.moveTo(px + x * S, py); this.ctx.lineTo(px + x * S, py + map.height * S); this.ctx.stroke(); }
        for (let y = 0; y <= map.height; y += 5) { this.ctx.beginPath(); this.ctx.moveTo(px, py + y * S); this.ctx.lineTo(px + map.width * S, py + y * S); this.ctx.stroke(); }
        this.ctx.fillStyle = UI.textDim; this.ctx.font = '10px sans-serif'; this.ctx.textAlign = 'center';
        for (let x = 0; x < map.width; x += 5) this.ctx.fillText(String(x), px + (x + 0.5) * S, py + map.height * S + 14);
        this.ctx.textAlign = 'right';
        for (let y = 0; y < map.height; y += 5) this.ctx.fillText(String(map.height - 1 - y), px - 6, py + (y + 0.5) * S + 4);
      }
    }
    // 도구 프리뷰 (SDD-09 §9-2: 합성 단계에서 그린다)
    if (state.previewCells.length > 0) {
      this.ctx.fillStyle = UI.brushPreview;
      for (const c of state.previewCells) {
        const sx = px + c.x * S, sy = py + (map.height - 1 - c.y) * S;
        this.ctx.fillRect(sx, sy, S, S);
      }
    }
    // 선택 영역 (SDD-09 §7-2)
    if (state.selection.kind === 'cells') {
      const sx0 = px + state.selection.x0 * S, sy0 = py + (map.height - 1 - state.selection.y1) * S;
      const sw = (state.selection.x1 - state.selection.x0 + 1) * S, sh = (state.selection.y1 - state.selection.y0 + 1) * S;
      this.ctx.strokeStyle = UI.selection; this.ctx.lineWidth = 2 / this.view.zoom;
      this.ctx.setLineDash([4 / this.view.zoom, 4 / this.view.zoom]);
      this.ctx.strokeRect(sx0, sy0, sw, sh);
      this.ctx.setLineDash([]);
    }
  }

  private drawSim(state: EditorState, px: number, py: number, S: number): void {
    const t = state.simPlayTime;
    const sim = state.sim;
    if (!sim || sim.samples.length === 0) return;
    const samples = sim.samples;
    let i = 0;
    while (i < samples.length - 1 && (samples[i + 1]?.t ?? Infinity) < t) i++;
    const s0 = samples[i];
    if (!s0) return;
    let ex = s0.escortee.x, ey = s0.escortee.y, mx = s0.mother.x, my = s0.mother.y;
    if (i < samples.length - 1) {
      const s1 = samples[i + 1];
      if (s1) {
        const f = Math.max(0, Math.min(1, (t - s0.t) / (s1.t - s0.t)));
        ex = s0.escortee.x + (s1.escortee.x - s0.escortee.x) * f;
        ey = s0.escortee.y + (s1.escortee.y - s0.escortee.y) * f;
        mx = s0.mother.x + (s1.mother.x - s0.mother.x) * f;
        my = s0.mother.y + (s1.mother.y - s0.mother.y) * f;
      }
    }
    const h = state.history.doc.map.height;
    const ctx = this.ctx;
    const es = CELL * ACTOR_SCALE.escortee / 2;
    ctx.fillStyle = ACTOR.escortee;
    ctx.beginPath();
    ctx.arc(px + ex * S, py + (h - 1 - ey) * S, es * (S / CELL), 0, Math.PI * 2);
    ctx.fill();
    const ms = CELL * ACTOR_SCALE.mother / 2;
    ctx.fillStyle = ACTOR.mother;
    const sx = px + mx * S - ms * (S / CELL), sy = py + (h - 1 - my) * S - ms * (S / CELL);
    ctx.fillRect(sx, sy, ms * 2 * (S / CELL), ms * 2 * (S / CELL));
  }
}






