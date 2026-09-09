/**
 * 목적: 속성 패널 (#props). 선택 대상(노드·엣지·마을·없음)의 속성을 표시·편집.
 * 왜 이 구조인가: SDD-03 §5. setField/renameNode/setNodeRole/setEdgeProps 커맨드를 dispatch.
 *   id 변경은 반드시 renameNode 로 (엣지·triggerNodeIds 함께 갱신). 마을 수치는 perVillage를 쓴다.
 * 바꾸면 안 되는 것: id 편집에 renameNode 사용. shortcut on 시 allowed 잠김.
 * 근거: SDD-03 §5 [D-03-05], SDD-09 §8 [D-09-08]
 */
import type { Store, EditorState, Selection } from '../state.js';
import { renameNode, setNodeRole } from '../../core/commands/nodes.js';
import { setEdgeProps } from '../../core/commands/edges.js';
import { computeReachability } from '../../core/geometry/reach.js';
import { UI } from '../../core/palette.js';
import type { StageDocument } from '../../core/model/stage.js';

const ROLES = ['waypoint', 'start', 'exit', 'branch'] as const;
function renderNodes(sel: Selection & { kind: 'nodes' }, store: Store, doc: StageDocument, container: HTMLElement): void {
  for (const id of sel.ids) {
    const node = doc.path.nodes.find(n => n.id === id);
    if (!node) continue;
    const div = document.createElement('div');
    div.style.padding = '4px 8px';
    const idLabel = document.createElement('label'); idLabel.textContent = 'ID ';
    const idInput = document.createElement('input'); idInput.value = node.id; idInput.style.width = '60px';
    idInput.onblur = () => { if (idInput.value !== node.id && idInput.value.length > 0) { store.dispatch(renameNode(doc, node.id, idInput.value)); } };
    idLabel.append(idInput); div.append(idLabel);
    const roleLabel = document.createElement('label'); roleLabel.textContent = ' 역할 ';
    const roleSelect = document.createElement('select');
    for (const r of ROLES) { const o = document.createElement('option'); o.value = r; o.textContent = r; if (node.role === r) o.selected = true; roleSelect.append(o); }
    roleSelect.onchange = () => { const v = roleSelect.value as typeof ROLES[number]; if (ROLES.includes(v)) { store.state.history.beginStroke(); store.dispatch(setNodeRole(doc, node.id, v)); store.state.history.endStroke(); } };
    roleLabel.append(roleSelect); div.append(roleLabel);
    const pos = document.createElement('span'); pos.textContent = ' (' + node.x + ',' + node.y + ')'; pos.style.color = UI.textDim; div.append(pos);
    const edgeList = document.createElement('ul'); edgeList.style.cssText = 'font-size:12px;margin:4px 0;color:' + UI.textDim;
    for (const e of doc.path.edges) { if (e.from === node.id) { const li = document.createElement('li'); li.textContent = '→ ' + e.to + (e.shortcut ? ' (지름길)' : ''); edgeList.append(li); } if (e.to === node.id) { const li = document.createElement('li'); li.textContent = '← ' + e.from + (e.shortcut ? ' (지름길)' : ''); edgeList.append(li); } }
    if (edgeList.children.length > 0) div.append(edgeList);
    container.append(div);
  }
}

function renderEdge(sel: Selection & { kind: 'edge' }, store: Store, doc: StageDocument, container: HTMLElement): void {
  const e = doc.path.edges[sel.index];
  if (!e) { container.textContent = '(엣지 없음)'; return; }
  const div = document.createElement('div'); div.style.padding = '4px 8px';
  div.innerHTML = '<strong>' + e.from + ' → ' + e.to + '</strong>';
  for (const agent of ['Escortee', 'Enemy', 'Ally'] as const) {
    const lb = document.createElement('label'); lb.style.display = 'block';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = (e.allowed as readonly string[]).includes(agent); cb.disabled = e.shortcut;
    cb.onchange = () => {
      const cur = new Set(e.allowed);
      if (agent === 'Escortee') { if (cb.checked) cur.add('Escortee'); else cur.delete('Escortee'); }
      else if (agent === 'Enemy') { if (cb.checked) cur.add('Enemy'); else cur.delete('Enemy'); }
      else { if (cb.checked) cur.add('Ally'); else cur.delete('Ally'); }
      store.state.history.beginStroke();
      store.dispatch(setEdgeProps(sel.index, { allowed: [...cur] }));
      store.state.history.endStroke();
    };
    lb.append(cb, ' ' + agent); div.append(lb);
  }
  const bl = document.createElement('label'); bl.style.display = 'block';
  const bc = document.createElement('input'); bc.type = 'checkbox'; bc.checked = e.bidirectional;
  bc.onchange = () => { store.state.history.beginStroke(); store.dispatch(setEdgeProps(sel.index, { bidirectional: bc.checked })); store.state.history.endStroke(); };
  bl.append(bc, ' 양방향'); div.append(bl);
  const sl = document.createElement('label'); sl.style.display = 'block';
  const sc = document.createElement('input'); sc.type = 'checkbox'; sc.checked = e.shortcut;
  sc.onchange = () => { store.state.history.beginStroke(); store.dispatch(setEdgeProps(sel.index, { shortcut: sc.checked })); store.state.history.endStroke(); };
  sl.append(sc, ' 지름길 (allowed→Escortee)'); div.append(sl);
  container.append(div);
}

export function villageReachability(doc: StageDocument, x: number, y: number): { selected: number; reachable: number; total: number } {
  const reach = computeReachability(doc.map);
  const village = reach.perVillage.find(v => v.village.x === x && v.village.y === y);
  return { selected: village?.buildable ?? 0, reachable: reach.reachableBuildable, total: reach.totalBuildable };
}

function renderVillage(sel: Selection & { kind: 'village' }, _store: Store, doc: StageDocument, container: HTMLElement): void {
  const div = document.createElement('div'); div.style.padding = '4px 8px';
  const p = document.createElement('p'); p.textContent = '마을 (' + sel.x + ',' + sel.y + ')'; div.append(p);
  const r = villageReachability(doc, sel.x, sel.y);
  const selected = document.createElement('p'); selected.textContent = '이 마을의 도달 가능 B: ' + r.selected + ' / ' + r.total; div.append(selected);
  const all = document.createElement('p'); all.textContent = '모든 마을 합집합: ' + r.reachable + ' / ' + r.total; all.style.color = UI.textDim; div.append(all);
  container.append(div);
}

export function mountProps(store: Store, container: HTMLElement): void {
  function render(state: EditorState): void {
    container.innerHTML = ''; const sel = state.selection; const doc = state.history.doc;
    if (sel.kind === 'none') { const p = document.createElement('p'); p.style.cssText = 'color:' + UI.textDim + ';padding:8px'; p.textContent = '대상을 선택하세요'; container.append(p); return; }
    if (sel.kind === 'nodes') { renderNodes(sel, store, doc, container); return; }
    if (sel.kind === 'edge') { renderEdge(sel, store, doc, container); return; }
    if (sel.kind === 'village') { renderVillage(sel, store, doc, container); return; }
  }
  store.subscribe((state) => render(state));
  render(store.state);
}
