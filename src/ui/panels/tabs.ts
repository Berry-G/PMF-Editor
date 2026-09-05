/**
 * 목적: 하단 탭 4개 — 맵/경로/스폰/밸런스. SDD-03 §6.
 * 왜 이 구조인가: 각 탭은 setField 커맨드로 dispatch. 숫자 입력은 blur 에서 한 번 확정.
 *   store.subscribe 로 문서 변경을 따라간다. dataset.path 로 포커스 복원.
 * 바꾸면 안 되는 것: blur/Enter 커맨드 확정 패턴. fld 의 p 가 FieldPath 로 고정.
 * 근거: SDD-03 §6 [D-03-06]
 */
import type { Store } from '../state.js';
import { UI } from '../../core/palette.js';
import { setField, setTable, type FieldPath } from '../../core/commands/fields.js';
import { showResizeDialog } from './dialogs.js';
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

export function mountTabs(store: Store, nav: HTMLElement, body: HTMLElement): void {
  const fld = (p: FieldPath, v: number | boolean, min: number, max: number) => {
    const lb = document.createElement('label'); lb.style.display = 'block';
    if (typeof v === 'boolean') {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = v;
      cb.dataset.path = p;
      cb.onchange = () => store.dispatch(setField(p, cb.checked));
      lb.append(cb, ' ' + p.split('.').pop()!); body.append(lb); return;
    }
    lb.textContent = p.split('.').pop()! + ' ';
    const inp = document.createElement('input'); inp.type = 'number'; inp.value = String(v);
    inp.style.width = '60px'; inp.dataset.path = p;
    inp.onblur = () => { const n = Number(inp.value); if (!isNaN(n)) store.dispatch(setField(p, Math.max(min, Math.min(max, n)))); };
    inp.oninput = () => { inp.style.borderColor = (Number(inp.value) < min || Number(inp.value) > max) ? UI.error : ''; };
    lb.append(inp); body.append(lb);
  };
  const section = (title: string) => {
    const s = document.createElement('div'); s.style.margin = '4px 0';
    const h = document.createElement('strong'); h.textContent = title; h.style.fontSize = '12px';
    s.append(h); body.append(s); return s;
  };
  type TabId = 'map' | 'path' | 'spawn' | 'balance';
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
      const nt = document.createElement('table'); nt.style.fontSize = '12px';
      nt.innerHTML = '<tr><th>ID</th><th>역할</th><th>위치</th></tr>';
      for (const n of d.path.nodes) {
        const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
        tr.onclick = () => store.update((_s) => ({ selection: { kind: 'nodes' as const, ids: [n.id] } }));
        tr.innerHTML = '<td>' + n.id + '</td><td>' + n.role + '</td><td>(' + n.x + ',' + n.y + ')</td>';
        nt.append(tr);
      }
      body.append(nt);
      const et = document.createElement('table'); et.style.fontSize = '12px';
      et.innerHTML = '<tr><th>from</th><th>→</th><th>to</th><th>양방향</th><th>지름길</th></tr>';
      d.path.edges.forEach((e, i) => {
        const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
        tr.onclick = () => store.update((_s) => ({ selection: { kind: 'edge' as const, index: i } }));
        tr.innerHTML = '<td>' + e.from + '</td><td>→</td><td>' + e.to + '</td><td>' + (e.bidirectional ? '○' : '') + '</td><td>' + (e.shortcut ? 'S' : '') + '</td>';
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
      for (let i = 0; i < d.spawn.table.length; i++) {
        const row = document.createElement('div'); row.style.fontSize = '12px';
        const en = document.createElement('input'); en.value = d.spawn.table[i]!.enemy; en.style.width = '120px';
        const wt = document.createElement('input'); wt.type = 'number'; wt.value = String(d.spawn.table[i]!.weight); wt.style.width = '50px';
        const onBlur = () => { const rows = d.spawn.table.map((e, j) => j === i ? { enemy: en.value, weight: Number(wt.value) } : e); store.dispatch(setTable('spawn.table', rows)); };
        en.onblur = onBlur; wt.onblur = onBlur;
        row.append(en, ' ×', wt); body.append(row);
      }
      section('체력 곡선');
      for (let i = 0; i < d.spawn.healthByProgress.length; i++) {
        const row = document.createElement('div'); row.style.fontSize = '12px';
        const tI = document.createElement('input'); tI.type = 'number'; tI.value = String(d.spawn.healthByProgress[i]!.t); tI.style.width = '50px'; tI.step = '0.1';
        const mI = document.createElement('input'); mI.type = 'number'; mI.value = String(d.spawn.healthByProgress[i]!.mul); mI.style.width = '60px'; mI.step = '0.1';
        const onBlur = () => { const rows = d.spawn.healthByProgress.map((e, j) => j === i ? { t: Number(tI.value), mul: Number(mI.value) } : e); store.dispatch(setTable('spawn.healthByProgress', rows)); };
        tI.onblur = onBlur; mI.onblur = onBlur;
        row.append('t=', tI, ' mul=', mI); body.append(row);
      }
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
    }

    // 포커스 복원
    if (focusKey) {
      const target = body.querySelector<HTMLInputElement>('[data-path="' + focusKey + '"]');
      if (target) { target.focus(); if (focusSelStart !== null) target.setSelectionRange(focusSelStart, focusSelEnd ?? focusSelStart); }
    }
  };

  let active: TabId = 'map';
  const tabDefs: [TabId, string][] = [['map', '맵'], ['path', '경로'], ['spawn', '스폰'], ['balance', '밸런스']];
  for (const [id, label] of tabDefs) {
    const btn = document.createElement('button'); btn.textContent = label; btn.style.marginRight = '2px';
    btn.onclick = () => { active = id; render(id); };
    nav.append(btn);
  }
  render(active);

  store.subscribe((_state, changed) => {
    if (!changed.has('history') && !changed.has('doc') && !changed.has('reach') && !changed.has('issues')) return;
    render(active);
  });
}