/**
 * 목적: 하단 탭 4개 — 맵/경로/스폰/밸런스. SDD-03 §6.
 * 왜 이 구조인가: 각 탭은 setField 커맨드로 dispatch. 숫자 입력은 blur 에서 한 번 확정.
 *   store.subscribe 로 문서 변경을 따라간다. 단, 편집 중인 입력칸(document.activeElement)은
 *   덮어쓰지 않는다.
 * 바꾸면 안 되는 것: blur/Enter 커맨드 확정 패턴. fld 의 p 가 FieldPath 로 고정 — `as` 캐스트 금지.
 * 근거: SDD-03 §6 [D-03-06]
 */
import type { Store } from '../state.js';
import { UI } from '../../core/palette.js';
import { setField, type FieldPath } from '../../core/commands/fields.js';

export function mountTabs(store: Store, nav: HTMLElement, body: HTMLElement): void {
  const fld = (p: FieldPath, v: number | boolean, min: number, max: number) => {
    const lb = document.createElement('label'); lb.style.display = 'block';
    if (typeof v === 'boolean') {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = v;
      cb.onchange = () => store.dispatch(setField(p, cb.checked));
      lb.append(cb, ' ' + p.split('.').pop()!); body.append(lb); return;
    }
    lb.textContent = p.split('.').pop()! + ' ';
    const inp = document.createElement('input'); inp.type = 'number'; inp.value = String(v);
    inp.style.width = '60px';
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
    body.innerHTML = ''; body.style.cssText = 'overflow-y:auto;max-height:200px;padding:4px';
    const d = store.state.history.doc;
    if (id === 'map') {
      section('맵');
      const ni = document.createElement('input'); ni.value = d.name; ni.style.width = '200px';
      ni.onblur = () => { if (ni.value !== d.name) store.dispatch(setField('name', ni.value)); };
      body.append(ni);
      const sz = document.createElement('p'); sz.style.cssText = 'font-size:12px;color:' + UI.textDim;
      sz.textContent = d.map.width + '×' + d.map.height; body.append(sz);
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
    } else if (id === 'spawn') {
      section('스폰');
      fld('spawn.volleyCount', d.spawn.volleyCount, 1, 50);
      fld('spawn.volleySpacing', d.spawn.volleySpacing, 0.1, 5);
      fld('spawn.restSeconds', d.spawn.restSeconds, 0, 60);
      fld('spawn.telegraphSeconds', d.spawn.telegraphSeconds, 0, 5);
    } else if (id === 'balance') {
      section('밸런스');
      fld('economy.startingResource', d.economy.startingResource, 50, 500);
      fld('economy.shortcutCost', d.economy.shortcutCost, 50, 500);
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

  // store.subscribe: 편집 중인 칸(document.activeElement)은 건너뛰고 다시 그린다
  store.subscribe((_state, changed) => {
    if (!changed.has('history') && !changed.has('doc') && !changed.has('reach') && !changed.has('issues')) return;
    // activeElement 가 우리가 만든 입력칸이면 그 칸만 보존
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT' && body.contains(ae)) return;
    render(active);
  });
}