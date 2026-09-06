/**
 * 목적: 하단 탭 5개 — 맵/경로/스폰/밸런스/시뮬. SDD-03 §6.
 * 왜 이 구조인가: 각 탭은 setField 커맨드로 dispatch. 숫자 입력은 blur 에서 한 번 확정.
 *   store.subscribe 로 문서 변경을 따라간다. dataset.path 로 포커스 복원.
 * 바꾸면 안 되는 것: blur/Enter 커맨드 확정 패턴. fld 의 p 가 FieldPath 로 고정.
 * 근거: SDD-03 §6 [D-03-06]
 */
import type { Store } from '../state.js';
import { UI, ACTOR } from '../../core/palette.js';
import { setField, setTable, type FieldPath } from '../../core/commands/fields.js';
import { setEdgeProps, deleteEdge } from '../../core/commands/edges.js';
import { setNodeRole, deleteNode } from '../../core/commands/nodes.js';
import { simulate } from '../../core/sim/simulate.js';
import type { SimParams } from '../../core/sim/params.js';
import { DEFAULT_SIM_PARAMS } from '../../core/sim/params.js';
import { showResizeDialog } from './dialogs.js';
import { buildPathFromRoad } from '../../core/geometry/roadpath.js';
import { replacePath } from '../../core/commands/nodes.js';
import { Cell, CELL_LABEL } from '../../core/model/cell.js';
import { countCells } from '../../core/model/map.js';
import { computeReachability } from '../../core/geometry/reach.js';

/** 화면에 노출된 FieldPath 목록. FIELD_PATHS 27개와 대조하는 테스트용. */
export const EXPOSED_FIELDS: readonly FieldPath[] = [
  'name',
  'escortee.speed', 'escortee.maxHealth',
  'mother.speed', 'mother.spawnDelay', 'mother.followsPath',
  'spawn.volleyCount', 'spawn.volleySpacing', 'spawn.restSeconds', 'spawn.telegraphSeconds',
  'burst.duration', 'burst.volleyCount', 'burst.restSeconds', 'burst.recoverySpeedMultiplier', 'burst.recoverySeconds',
  'economy.startingResource', 'economy.shortcutCost',
  'presentation.uiSlowMotionScale', 'presentation.shotLineSeconds', 'presentation.magicMissileSpeed',
  'presentation.hitFlashSeconds', 'presentation.debrisCount', 'presentation.debrisSeconds', 'presentation.healthBarHideWhenFull', 'presentation.masterVolume',
  'toggles.alliesCanDieWhileMarching', 'toggles.enemiesTargetAllies',
];
/** 'mother.followsPath' → 'followsPath'. 점이 없으면 그대로 반환. I-3 로 pop()! 제거 대상. */
const leaf = (p: string): string => p.slice(p.lastIndexOf('.') + 1);

/** 재생 시간 포맷. M-1 회귀 테스트로 분리. */
export function formatPlayTime(cur: number, total: number): string {
  return cur.toFixed(1) + ' / ' + total.toFixed(1) + '초';
}

/** 탭이 화면에 표시하는 필드값들을 한 객체로 반환. M-2 회귀 테스트용. */
export function tabFieldValues(doc: import('../../core/model/stage.js').StageDocument): Record<string, number | boolean | string> {
  return {
    name: doc.name,
    'escortee.speed': doc.escortee.speed, 'escortee.maxHealth': doc.escortee.maxHealth,
    'mother.speed': doc.mother.speed, 'mother.spawnDelay': doc.mother.spawnDelay, 'mother.followsPath': doc.mother.followsPath,
    'spawn.volleyCount': doc.spawn.volleyCount, 'spawn.volleySpacing': doc.spawn.volleySpacing, 'spawn.restSeconds': doc.spawn.restSeconds, 'spawn.telegraphSeconds': doc.spawn.telegraphSeconds,
    'burst.duration': doc.burst.duration, 'burst.volleyCount': doc.burst.volleyCount, 'burst.restSeconds': doc.burst.restSeconds, 'burst.recoverySpeedMultiplier': doc.burst.recoverySpeedMultiplier, 'burst.recoverySeconds': doc.burst.recoverySeconds,
    'economy.startingResource': doc.economy.startingResource, 'economy.shortcutCost': doc.economy.shortcutCost,
    'presentation.uiSlowMotionScale': doc.presentation.uiSlowMotionScale, 'presentation.shotLineSeconds': doc.presentation.shotLineSeconds, 'presentation.magicMissileSpeed': doc.presentation.magicMissileSpeed,
    'presentation.hitFlashSeconds': doc.presentation.hitFlashSeconds, 'presentation.debrisCount': doc.presentation.debrisCount, 'presentation.debrisSeconds': doc.presentation.debrisSeconds,
    'presentation.healthBarHideWhenFull': doc.presentation.healthBarHideWhenFull, 'presentation.masterVolume': doc.presentation.masterVolume,
    'toggles.alliesCanDieWhileMarching': doc.toggles.alliesCanDieWhileMarching, 'toggles.enemiesTargetAllies': doc.toggles.enemiesTargetAllies,
  };
}

/** 대화상자 줄바꿈. 개행 이스케이프를 소스에 흩어 두지 않으려고 상수로 둔다. */
const NL = String.fromCharCode(10);

export function mountTabs(store: Store, nav: HTMLElement, body: HTMLElement): void {
  // fld 는 render 안에서 정의됨 (V = tabFieldValues(d) 이후, M-2/P-3).
  const section = (title: string) => {
    const s = document.createElement('div'); s.style.margin = '4px 0';
    const h = document.createElement('strong'); h.textContent = title; h.style.fontSize = '12px';
    s.append(h); body.append(s); return s;
  };
  type TabId = 'map' | 'path' | 'spawn' | 'balance' | 'sim';
  const render = (id: TabId) => {
    const ae = document.activeElement;
    let focusKey: string | null = null;
    let focusSelStart: number | null = null;
    let focusSelEnd: number | null = null;
    if (ae instanceof HTMLInputElement && body.contains(ae)) {
      focusKey = ae.dataset.path ?? null;
      focusSelStart = ae.selectionStart;
      focusSelEnd = ae.selectionEnd;
    }
body.innerHTML = ''; body.style.cssText = 'overflow-y:auto;max-height:200px;padding:4px';
    const d = store.state.history.doc;
    const V = tabFieldValues(d);

    // fld: V[p] 에서 값을 읽어 입력요소 생성. M-2/P-3: render 와 테스트가 같은 tabFieldValues 를 쓴다.
    const fld = (p: FieldPath, _v: number | boolean, min: number, max: number) => {
      const v = V[p] as number | boolean;
      const lb = document.createElement('label'); lb.style.display = 'block';
      if (typeof v === 'boolean') {
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = v;
        cb.dataset.path = p;
        cb.onchange = () => store.dispatch(setField(p, cb.checked));
        lb.append(cb, ' ' + leaf(p)); body.append(lb); return;
      }
      lb.textContent = leaf(p) + ' ';
      const inp = document.createElement('input'); inp.type = 'number'; inp.value = String(v);
      inp.style.width = '60px'; inp.dataset.path = p;
      inp.onblur = () => { const n = Number(inp.value); if (!isNaN(n)) store.dispatch(setField(p, Math.max(min, Math.min(max, n)))); };
      inp.oninput = () => { inp.style.borderColor = (Number(inp.value) < min || Number(inp.value) > max) ? UI.error : ''; };
      lb.append(inp); body.append(lb);
    };

    if (id === 'map') {
      section('맵');
      const ni = document.createElement('input'); ni.value = d.name; ni.style.width = '200px';
      ni.onblur = () => { if (ni.value !== d.name) store.dispatch(setField('name', ni.value)); };
      body.append(ni);
      const sz = document.createElement('p'); sz.style.cssText = 'font-size:12px;color:' + UI.textDim;
      sz.textContent = d.map.width + '×' + d.map.height; body.append(sz);
      const counts = countCells(d.map);
      const stats = document.createElement('p'); stats.style.cssText = 'font-size:12px;color:' + UI.textDim;
      stats.textContent = '셀: ' + Object.entries(counts).filter(([,v]) => v > 0).map(([k,v]) => (CELL_LABEL[Number(k) as Cell] ?? k) + ' ' + v).join(', ');
      body.append(stats);
      const reach = computeReachability(d.map);
      const rp = document.createElement('p'); rp.style.cssText = 'font-size:12px;color:' + UI.textDim;
      rp.textContent = '도달 가능 B: ' + reach.reachableBuildable + ' / ' + reach.totalBuildable;
      body.append(rp);
      const resizeBtn = document.createElement('button'); resizeBtn.textContent = '크기 변경';
      resizeBtn.onclick = () => { const di = document.querySelector<HTMLElement>('#dialogs'); if (di) showResizeDialog(store, di); };
      body.append(resizeBtn);
    } else if (id === 'path') {
      section('경로');

      // 왜 표에 삭제 버튼을 두는가: 캔버스에서 엣지를 픽셀로 조준하는 건 어렵다. 표는 목록이라
      //   틀릴 수가 없다 — 지울 대상을 이름으로 고른다 (2026-09-06 사용자 피드백).
      const delBtn = (label: string, run: () => void): HTMLElement => {
        const td = document.createElement('td');
        const b = document.createElement('button');
        b.textContent = '×'; b.title = label;
        b.style.cssText = 'padding:0 6px;line-height:1.2';
        b.onclick = (ev) => { ev.stopPropagation(); if (confirm(label)) { store.state.history.beginStroke(); run(); store.state.history.endStroke(); } };
        td.append(b); return td;
      };

      // 도로에서 경로 초안 만들기. **런타임 추론이 아니라 저작 보조다** — 결과는 파일에
      //   명시적 노드·엣지로 저장되고, 기획자가 그 위에 분기·지름길을 얹는다.
      //   게임은 도로에서 그래프를 추론하지 않는다 (게임 TASKS-P1-prototype.md:568).
      const genBtn = document.createElement('button');
      genBtn.textContent = '도로에서 경로 만들기';
      genBtn.title = '시작 노드에서 탈출 노드까지 도로를 따라가며 꺾이는 칸마다 노드를 찍는다';
      genBtn.onclick = () => {
        const doc = store.state.history.doc;
        const sn = doc.path.nodes.find(n => n.role === 'start');
        const en = doc.path.nodes.find(n => n.role === 'exit');
        if (!sn || !en) { alert(['시작 노드와 탈출 노드를 먼저 놓아라.', '캔버스 빈 칸에서 우클릭 → "여기에 시작점" / "여기에 탈출점".'].join(NL)); return; }
        const r = buildPathFromRoad(doc.map, { x: sn.x, y: sn.y }, { x: en.x, y: en.y });
        if (!r.ok) { alert('만들 수 없다: ' + r.reason); return; }

        // 무엇이 사라지는지 먼저 보여 준다. 경로를 통째로 갈아끼우므로 손으로 얹은 것이 날아간다.
        const lostBranch = doc.path.nodes.filter(n => n.role === 'branch').length;
        const lostShortcut = doc.path.edges.filter(e => e.shortcut).length;
        const newIds = new Set(r.nodes.map(n => n.id));
        const orphanTriggers = doc.burst.triggerNodeIds.filter(t => !newIds.has(t));
        const lines: string[] = [
          '노드 ' + r.nodes.length + '개 · 엣지 ' + r.edges.length + '개를 만든다.',
          '지금 경로(노드 ' + doc.path.nodes.length + ' · 엣지 ' + doc.path.edges.length + ')는 사라진다.',
        ];
        if (lostBranch > 0) lines.push('분기 노드 ' + lostBranch + '개가 사라진다 — 다시 찍어야 한다.');
        if (lostShortcut > 0) lines.push('지름길 ' + lostShortcut + '개가 사라진다 — 다시 이어야 한다.');
        if (orphanTriggers.length > 0) lines.push('버스트 트리거 ' + orphanTriggers.join(', ') + ' 가 없는 노드를 가리키게 된다 (V-P01 이 잡는다).');
        lines.push('', '진행할까?');
        if (!confirm(lines.join(NL))) return;

        store.state.history.beginStroke();
        store.dispatch(replacePath(r.nodes, r.edges));
        store.state.history.endStroke();
      };
      body.append(genBtn);
      const nt = document.createElement('table'); nt.style.fontSize = '12px';
      nt.innerHTML = '<tr><th>ID</th><th>역할</th><th>위치</th><th></th></tr>';
      const ROLES = ['waypoint', 'start', 'exit', 'branch'] as const;
      for (const n of d.path.nodes) {
        const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
        tr.onclick = () => store.update((_s) => ({ selection: { kind: 'nodes' as const, ids: [n.id] } }));
        const idCell = document.createElement('td'); idCell.textContent = n.id;
        const roleCell = document.createElement('td');
        const sel = document.createElement('select');
        for (const r of ROLES) { const o = document.createElement('option'); o.value = r; o.textContent = r; if (n.role === r) o.selected = true; sel.append(o); }
        sel.onchange = () => { store.state.history.beginStroke(); store.dispatch(setNodeRole(d, n.id, sel.value as typeof ROLES[number])); store.state.history.endStroke(); };
        sel.onclick = (e) => e.stopPropagation();
        roleCell.append(sel);
        const posCell = document.createElement('td'); posCell.textContent = '(' + n.x + ',' + n.y + ')';
        const selN = store.state.selection;
        if (selN.kind === 'nodes' && selN.ids.includes(n.id)) tr.style.background = UI.selection + '30';
        tr.append(idCell, roleCell, posCell,
          delBtn(`노드 ${n.id} 을(를) 지운다. 붙은 엣지와 버스트 트리거 참조도 함께 사라진다.`,
                 () => store.dispatch(deleteNode(store.state.history.doc, n.id))));
        nt.append(tr);
      }
      body.append(nt);
      const et = document.createElement('table'); et.style.fontSize = '12px';
      et.innerHTML = '<tr><th>from</th><th>→</th><th>to</th><th>허용</th><th>양방향</th><th>지름길</th><th></th></tr>';
      d.path.edges.forEach((e, i) => {
        const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
        tr.onclick = () => store.update((_s) => ({ selection: { kind: 'edge' as const, index: i } }));
        const f = document.createElement('td'); f.textContent = e.from;
        const ar = document.createElement('td'); ar.textContent = '→';
        const t = document.createElement('td'); t.textContent = e.to;
        const aCell = document.createElement('td');
        for (const agent of ['Escortee', 'Enemy', 'Ally'] as const) {
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = (e.allowed as readonly string[]).includes(agent); cb.disabled = e.shortcut;
          cb.onchange = () => {
            const cur = new Set(e.allowed);
            if (cb.checked) cur.add(agent); else cur.delete(agent);
            store.state.history.beginStroke(); store.dispatch(setEdgeProps(i, { allowed: [...cur] })); store.state.history.endStroke();
          };
          cb.onclick = (ev) => ev.stopPropagation();
          aCell.append(cb, agent.substring(0, 3), ' ');
        }
        const bCell = document.createElement('td');
        const bc = document.createElement('input'); bc.type = 'checkbox'; bc.checked = e.bidirectional;
        bc.onchange = () => { store.state.history.beginStroke(); store.dispatch(setEdgeProps(i, { bidirectional: bc.checked })); store.state.history.endStroke(); };
        bc.onclick = (ev) => ev.stopPropagation();
        bCell.append(bc);
        const sCell = document.createElement('td');
        const sc = document.createElement('input'); sc.type = 'checkbox'; sc.checked = e.shortcut;
        sc.onchange = () => { store.state.history.beginStroke(); store.dispatch(setEdgeProps(i, { shortcut: sc.checked })); store.state.history.endStroke(); };
        sc.onclick = (ev) => ev.stopPropagation();
        sCell.append(sc);
        const selE = store.state.selection;
        if (selE.kind === 'edge' && selE.index === i) tr.style.background = UI.selection + '30';
        tr.append(f, ar, t, aCell, bCell, sCell,
          delBtn(`엣지 ${e.from} → ${e.to} 을(를) 지운다.`, () => store.dispatch(deleteEdge(i))));
        et.append(tr);
      });
      body.append(et);
    } else if (id === 'spawn') {
      section('스폰 리듬');
      fld('spawn.volleyCount', d.spawn.volleyCount, 1, 50);
      fld('spawn.volleySpacing', d.spawn.volleySpacing, 0.1, 5);
      fld('spawn.restSeconds', d.spawn.restSeconds, 0, 60);
      fld('spawn.telegraphSeconds', d.spawn.telegraphSeconds, 0, 5);
      const { volleyCount, volleySpacing, restSeconds } = d.spawn;
      const cycle = (volleyCount - 1) * volleySpacing + restSeconds;
      const rate = cycle > 0 ? volleyCount / cycle : 0;
      const info = document.createElement('p'); info.style.cssText = 'font-size:12px;color:' + UI.textDim;
      info.textContent = '사이클 ' + cycle.toFixed(2) + '초 · 초당 ' + rate.toFixed(2) + '마리';
      body.append(info);
      section('버스트');
      fld('burst.duration', d.burst.duration, 0, 60);
      fld('burst.volleyCount', d.burst.volleyCount, 1, 50);
      fld('burst.restSeconds', d.burst.restSeconds, 0, 60);
      fld('burst.recoverySpeedMultiplier', d.burst.recoverySpeedMultiplier, 0.1, 5);
      fld('burst.recoverySeconds', d.burst.recoverySeconds, 0, 30);
      section('스폰 표');
      d.spawn.table.forEach((spawnRow, i) => {
        const rowEl = document.createElement('div'); rowEl.style.fontSize = '12px';
        const en = document.createElement('input'); en.value = spawnRow.enemy; en.style.width = '120px';
        const wt = document.createElement('input'); wt.type = 'number'; wt.value = String(spawnRow.weight); wt.style.width = '50px';
        const onBlur = () => { const rows = d.spawn.table.map((e, j) => j === i ? { enemy: en.value, weight: Number(wt.value) } : e); store.dispatch(setTable('spawn.table', rows)); };
        en.onblur = onBlur; wt.onblur = onBlur;
        rowEl.append(en, ' ×', wt); body.append(rowEl);
      });
      section('체력 곡선');
      d.spawn.healthByProgress.forEach((hb, i) => {
        const rowEl = document.createElement('div'); rowEl.style.fontSize = '12px';
        const tI = document.createElement('input'); tI.type = 'number'; tI.value = String(hb.t); tI.style.width = '50px'; tI.step = '0.1';
        const mI = document.createElement('input'); mI.type = 'number'; mI.value = String(hb.mul); mI.style.width = '60px'; mI.step = '0.1';
        const onBlur = () => { const rows = d.spawn.healthByProgress.map((e, j) => j === i ? { t: Number(tI.value), mul: Number(mI.value) } : e); store.dispatch(setTable('spawn.healthByProgress', rows)); };
        tI.onblur = onBlur; mI.onblur = onBlur;
        rowEl.append('t=', tI, ' mul=', mI); body.append(rowEl);
      });
    }
else if (id === 'balance') {
      section('경제');
      fld('economy.startingResource', d.economy.startingResource, 50, 500);
      fld('economy.shortcutCost', d.economy.shortcutCost, 50, 500);
      section('보호대상');
      fld('escortee.speed', d.escortee.speed, 0.1, 2);
      fld('escortee.maxHealth', d.escortee.maxHealth, 10, 500);
      section('모체');
      fld('mother.speed', d.mother.speed, 0.1, 2);
      fld('mother.spawnDelay', d.mother.spawnDelay, 0, 20);
      fld('mother.followsPath', d.mother.followsPath, 0, 1);
      section('연출');
      fld('presentation.uiSlowMotionScale', d.presentation.uiSlowMotionScale, 0.01, 1);
      fld('presentation.shotLineSeconds', d.presentation.shotLineSeconds, 0.01, 1);
      fld('presentation.magicMissileSpeed', d.presentation.magicMissileSpeed, 1, 20);
      fld('presentation.hitFlashSeconds', d.presentation.hitFlashSeconds, 0.01, 1);
      fld('presentation.debrisCount', d.presentation.debrisCount, 0, 20);
      fld('presentation.debrisSeconds', d.presentation.debrisSeconds, 0.01, 2);
      fld('presentation.healthBarHideWhenFull', d.presentation.healthBarHideWhenFull, 0, 1);
      fld('presentation.masterVolume', d.presentation.masterVolume, 0, 1);
      section('토글');
      fld('toggles.alliesCanDieWhileMarching', d.toggles.alliesCanDieWhileMarching, 0, 1);
      fld('toggles.enemiesTargetAllies', d.toggles.enemiesTargetAllies, 0, 1);
      section('난이도');
      d.economy.difficulties.forEach((diff, i) => {
        const row = document.createElement('div'); row.style.fontSize = '12px';
        const dn = document.createElement('input'); dn.value = diff.displayName; dn.style.width = '70px';
        const kr = document.createElement('input'); kr.type = 'number'; kr.value = String(diff.killReward); kr.style.width = '50px';
        const rps = document.createElement('input'); rps.type = 'number'; rps.value = String(diff.resourcePerSecond); rps.style.width = '50px'; rps.step = '0.1';
        const onBlur = () => { const rows = d.economy.difficulties.map((df, di) => di === i ? { ...df, displayName: dn.value, killReward: Number(kr.value), resourcePerSecond: Number(rps.value) } : df); store.dispatch(setTable('economy.difficulties', rows)); };
        dn.onblur = onBlur; kr.onblur = onBlur; rps.onblur = onBlur;
        row.append(dn, ' K:', kr, ' RPS:', rps); body.append(row);
      });
    } else if (id === 'sim') {
      const r = store.state.sim;
      const isStale = store.state.simStale;
      // 파라미터
      section('파라미터');
      const seedRow = document.createElement('div'); seedRow.style.fontSize = '12px';
      seedRow.textContent = '시드 '; const si = document.createElement('input'); si.type = 'number'; si.value = String(store.state.sim?.seed ?? DEFAULT_SIM_PARAMS.seed); si.style.width = '60px';
      const shortRow = document.createElement('div'); shortRow.style.fontSize = '12px';
      shortRow.textContent = '지름길 개방 '; const sti = document.createElement('input'); sti.type = 'number'; sti.value = store.state.sim ? '120' : ''; sti.style.width = '60px'; sti.placeholder = '없음';
      const spdRow = document.createElement('div'); spdRow.style.fontSize = '12px';
      spdRow.textContent = '배속 '; const spd = document.createElement('select');
      for (const v of ['1', '2', '4']) { const o = document.createElement('option'); o.value = v; o.textContent = v + 'x'; if (v === '1') o.selected = true; spd.append(o); }
      seedRow.append(si); body.append(seedRow);
      shortRow.append(sti); body.append(shortRow);
      spdRow.append(spd); body.append(spdRow);
      const runRow = document.createElement('div');
      runRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0';
      const runBtn = document.createElement('button'); runBtn.textContent = '▶ 실행';
      // 왜 버튼 옆에 결과를 붙이는가: 요약은 버튼 아래에 그려지는데, 창이나 하단 패널이 낮으면
      //   잘려서 "아무 일도 안 일어난다" 로 보인다 (2026-09-06 사용자 보고). 실제로는 돌고 있었다.
      //   같은 줄에 두면 어떤 높이에서도 보인다.
      const runEcho = document.createElement('span');
      runEcho.style.cssText = 'font-size:12px;color:' + UI.textDim;
      if (r) {
        const incNow = r.incomeCeiling['Normal'] ?? r.incomeCeiling['보통'] ?? 0;
        runEcho.textContent = `${r.stageSeconds.toFixed(3)}초 · ${r.totalSpawned}기 · 수입 ${Math.round(incNow)}` + (isStale ? '  ⚠ 낡음' : '');
        if (isStale) runEcho.style.color = UI.warning;
      }
      runBtn.onclick = () => {
        const seed = Math.max(1, Math.floor(Number(si.value) || 1));
        const shortcutOpenAt = sti.value ? Math.max(0, Number(sti.value)) : null;
        const params: SimParams = { seed, dt: DEFAULT_SIM_PARAMS.dt, shortcutOpenAt, maxSeconds: DEFAULT_SIM_PARAMS.maxSeconds };
        const result = simulate(d, params, store.state.catalog);
        // 왜 레이어를 같이 켜는가: `시뮬` 레이어가 기본 꺼짐이라, 실행하고 재생을 눌러도 캔버스에
        //   아무것도 안 그려진다 — "배속이 있길래 움직이는 줄 알았다" 는 오해가 여기서 났다
        //   (2026-09-06). 시뮬을 돌렸다는 건 보겠다는 뜻이다.
        store.update((_s) => ({ sim: result, simStale: false, layers: { ..._s.layers, sim: true } }));
        render('sim');
      };
      runRow.append(runBtn, runEcho);
      body.append(runRow);
      if (r) {
        section('요약');
        if (isStale) { const stale = document.createElement('span'); stale.textContent = '⚠ 낡음'; stale.style.color = UI.warning; body.append(stale); }
        const sc = document.createElement('div'); sc.style.cssText = 'font-size:12px;color:' + UI.textDim;
        const inc = r.incomeCeiling['Normal'] ?? r.incomeCeiling['보통'] ?? 0;
        sc.innerHTML = '판 길이 <strong>' + r.stageSeconds.toFixed(3) + '</strong>초 · 총 스폰 <strong>' + r.totalSpawned + '</strong>기 · 수입 천장 Normal <strong>' + inc + '</strong>';
        body.append(sc);
        if (r.warnings.length > 0) {
          const wl = document.createElement('div'); wl.style.cssText = 'font-size:12px;color:' + UI.error;
          for (const w of r.warnings) { const p = document.createElement('p'); p.textContent = w; wl.append(p); }
          body.append(wl);
        }
        section('타임라인');
        const cv = document.createElement('canvas'); cv.width = 280; cv.height = 140; cv.style.width = '280px'; cv.style.height = '140px'; cv.style.border = '1px solid ' + UI.panelBorder;
        body.append(cv);
        const ctx = cv.getContext('2d');
        if (ctx) {
          const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
          const maxT = r.stageSeconds || 1; const pad = 8;
          const px = (t: number) => pad + (t / maxT) * (W - pad * 2);
          ctx.fillStyle = ACTOR.mother; ctx.globalAlpha = 0.2;
          for (const b of r.bursts) { ctx.fillRect(px(b.start), 0, px(b.end) - px(b.start), H); }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = ACTOR.escortee; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = 0; i < r.samples.length; i++) {
            const s = r.samples[i]; if (!s) continue; const y = H - 10 - (s.distance / Math.max(10, s.distance + 5)) * (H - 20);
            if (i === 0) ctx.moveTo(px(s.t), y); else ctx.lineTo(px(s.t), y);
          }
          ctx.stroke();
          ctx.fillStyle = ACTOR.walker; ctx.globalAlpha = 0.5;
          for (const se of r.spawnEvents) { const x = px(se.t); ctx.fillRect(x, H - 6, 2, 6); }
          ctx.globalAlpha = 1;
          ctx.fillStyle = ACTOR.scout;
          for (const c of r.contacts) { const x = px(c.t); ctx.beginPath(); ctx.arc(x, H - 6, 3, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = UI.textDim; ctx.font = '9px sans-serif';
          ctx.fillText('0', pad, H - 1); ctx.fillText(maxT.toFixed(1) + '초', W - pad - 30, H - 1);
          // 재생 컨트롤
          section('재생');
          const playSec = document.createElement('span'); playSec.style.cssText = 'font-size:12px;color:' + UI.textDim;
          const playBtn = document.createElement('button'); playBtn.textContent = '▶';
          const stopBtn = document.createElement('button'); stopBtn.textContent = '⏹';
          const scrub = document.createElement('input'); scrub.type = 'range'; scrub.min = '0'; scrub.max = String(r.stageSeconds); scrub.step = '0.1'; scrub.style.width = '200px';
          const updatePlay = () => { playSec.textContent = formatPlayTime(store.state.simPlayTime, r.stageSeconds); };
          scrub.oninput = () => { store.update((_s) => ({ simPlayTime: Number(scrub.value) })); updatePlay(); };
          playBtn.onclick = () => {
            if (store.state.simPlaying) { store.update((_s) => ({ simPlaying: false })); playBtn.textContent = '▶'; return; }
            store.update((_s) => ({ simPlaying: true })); playBtn.textContent = '⏸';
            const speed = Number(spd.value);
            let last = performance.now();
            const tick = () => {
              if (!store.state.simPlaying) { playBtn.textContent = '▶'; return; }
              const now = performance.now(); const dt = ((now - last) / 1000) * speed; last = now;
              const nt = Math.min(store.state.simPlayTime + dt, r.stageSeconds);
              store.update((_s) => ({ simPlayTime: nt }));
              // DOM 직접 갱신 — render() 재호출 금지
              playSec.textContent = formatPlayTime(nt, r.stageSeconds);
              scrub.value = String(nt);
              if (nt >= r.stageSeconds) { store.update((_s) => ({ simPlaying: false })); playBtn.textContent = '▶'; return; }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          };
          stopBtn.onclick = () => { store.update((_s) => ({ simPlaying: false, simPlayTime: 0 })); playBtn.textContent = '▶'; updatePlay(); };
          const ctrlRow = document.createElement('div'); ctrlRow.style.fontSize = '12px';
          ctrlRow.append(playBtn, stopBtn, ' ', scrub, ' ', playSec);
          // 왜 여기에 끼우는가: 이 블록은 타임라인 캔버스 안쪽이라 그대로 body 에 붙이면 화면
          //   아래로 밀려 안 보인다. 만드는 자리는 두고 **놓는 자리만** 실행 버튼 옆으로 옮긴다.
          runRow.after(ctrlRow);
          updatePlay();
        }
      }
    }

    // 포커스 복원
    if (focusKey) {
      const target = body.querySelector<HTMLInputElement>('[data-path="' + focusKey + '"]');
      if (target) { target.focus(); if (focusSelStart !== null) target.setSelectionRange(focusSelStart, focusSelEnd ?? focusSelStart); }
    }
  };

  let active: TabId = 'map';
  const tabDefs: [TabId, string][] = [['map', '맵'], ['path', '경로'], ['spawn', '스폰'], ['balance', '밸런스'], ['sim', '시뮬']];
  for (const [id, label] of tabDefs) {
    const btn = document.createElement('button'); btn.textContent = label; btn.style.marginRight = '2px';
    btn.onclick = () => { active = id; render(id); };
    nav.append(btn);
  }
  render(active);

  store.subscribe((_state, changed) => {
    if (!changed.has('history') && !changed.has('doc') && !changed.has('reach') && !changed.has('issues') && !changed.has('sim') && !changed.has('simStale') && !changed.has('simPlayTime') && !changed.has('simPlaying')) return;
    render(active);
  });
}