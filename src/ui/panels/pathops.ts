/**
 * 목적: 경로 일괄 정리 — 지금은 "도로 밖 노드 삭제" 하나. 왼쪽 패널에 둔다.
 * 왜 이 구조인가: `도로에서 경로 만들기` 로 초안을 뽑고 나면 손으로 찍어 둔 낡은 노드가 도로
 *   밖에 남는다. 하나씩 지우면 지루하고 빠뜨린다 — V-P07 이 잡아 주긴 하지만 고치는 건 손이다.
 * 바꾸면 안 되는 것: **지우기 전에 목록을 보여 준다.** 그리고 `branch` 노드를 위반과 섞지 마라 —
 *   분기 노드는 **원래 도로 밖에 두는 것**이다 (씨앗의 `B01_branch` 는 Buildable 위, SDD-02 §3-1).
 *   섞어서 한 번에 지우면 멀쩡한 데이터가 조용히 사라진다.
 * 근거: SDD-02 §3-1 [D-02-04], SDD-03 §3 [D-03-03], ADR-E04
 */
import type { Store } from '../state.js';
import type { PathNode } from '../../core/model/stage.js';
import { UI } from '../../core/palette.js';
import { cellAt, inBounds } from '../../core/model/map.js';
import { Cell } from '../../core/model/cell.js';
import { deleteNode } from '../../core/commands/nodes.js';

/** 도로 위가 아닌 노드 (맵 밖도 포함). */
function offRoad(store: Store): PathNode[] {
  const doc = store.state.history.doc;
  return doc.path.nodes.filter(n =>
    !inBounds(doc.map, n.x, n.y) || cellAt(doc.map, n.x, n.y) !== Cell.Road);
}

function removeAll(store: Store, ids: string[]): void {
  if (ids.length === 0) return;
  // 왜 한 스트로크인가: 사용자에겐 한 동작이다. Undo 한 번에 전부 되돌아가야 한다.
  store.state.history.beginStroke();
  for (const id of ids) {
    // 매번 현재 문서로 만든다 — 앞선 삭제가 엣지·트리거를 이미 정리했을 수 있다.
    store.dispatch(deleteNode(store.state.history.doc, id));
  }
  store.state.history.endStroke();
}

function line(text: string, dim = false): HTMLElement {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = 'margin:3px 0;line-height:1.5' + (dim ? ';color:' + UI.textDim : '');
  return d;
}

function showDialog(store: Store, container: HTMLElement, violators: PathNode[], branches: PathNode[]): void {
  container.style.cssText =
    'position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)';
  const panel = document.createElement('div');
  panel.style.cssText =
    'background:' + UI.panel + ';border:1px solid ' + UI.panelBorder + ';color:' + UI.text +
    ';padding:18px 22px;max-width:min(680px,92vw);max-height:80vh;overflow:auto';

  const title = document.createElement('strong');
  title.textContent = '도로 밖 노드 삭제';
  panel.append(title);

  if (violants(violators)) {
    panel.append(line(''));
    panel.append(line(`규칙 위반 ${violators.length}개 — start/exit/waypoint 인데 도로(R) 위가 아니다 (V-P07 ❌)`));
    panel.append(line(violators.map(n => `${n.id}(${n.x},${n.y})`).join(', '), true));
  }
  if (branches.length > 0) {
    panel.append(line(''));
    panel.append(line(`분기 노드 ${branches.length}개 — 이건 원래 도로 밖에 둔다`));
    panel.append(line(branches.map(n => `${n.id}(${n.x},${n.y})`).join(', '), true));
    panel.append(line('아군 행군용이라 도로를 밟지 않는다. 지우면 붙은 엣지도 함께 사라진다.', true));
  }
  panel.append(line(''));
  panel.append(line('노드를 지우면 그 노드에 붙은 엣지와 버스트 트리거 참조도 함께 지워진다.', true));

  const close = (): void => { container.innerHTML = ''; container.style.cssText = ''; };
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:6px;margin-top:14px;justify-content:flex-end';

  if (violators.length > 0) {
    const b1 = document.createElement('button');
    b1.textContent = `규칙 위반만 지우기 (${violators.length})`;
    b1.onclick = () => { close(); removeAll(store, violators.map(n => n.id)); };
    bar.append(b1);
  }
  if (branches.length > 0) {
    const b2 = document.createElement('button');
    b2.textContent = `전부 지우기 (${violators.length + branches.length})`;
    b2.onclick = () => { close(); removeAll(store, [...violators, ...branches].map(n => n.id)); };
    bar.append(b2);
  }
  const b3 = document.createElement('button');
  b3.textContent = '취소';
  b3.onclick = close;
  bar.append(b3);
  panel.append(bar);

  panel.onclick = (e) => e.stopPropagation();
  container.onclick = close;
  container.append(panel);
}

/** 위반 목록이 비지 않았는지. 이름을 따로 둔 이유는 위 조건문을 읽기 쉽게 하려고. */
function violants(v: PathNode[]): boolean { return v.length > 0; }

export function mountPathOps(store: Store, container: HTMLElement): void {
  const heading = document.createElement('p');
  heading.className = 'section-title';
  heading.textContent = '경로 정리';
  container.append(heading);

  const btn = document.createElement('button');
  btn.textContent = '도로 밖 노드 삭제';
  btn.title = '도로(R) 위에 있지 않은 노드를 찾아 지운다. 지우기 전에 목록을 보여 준다';
  btn.style.width = '100%';
  btn.onclick = () => {
    const off = offRoad(store);
    if (off.length === 0) { alert('도로 밖 노드가 없다.'); return; }
    const di = document.querySelector<HTMLElement>('#dialogs');
    if (!di) return;
    showDialog(store, di,
      off.filter(n => n.role !== 'branch'),
      off.filter(n => n.role === 'branch'));
  };
  container.append(btn);

  // 몇 개인지 늘 보이게 둔다 — 버튼을 눌러야 아는 것보다 낫다.
  const count = document.createElement('div');
  count.style.cssText = 'color:' + UI.textDim + ';font-size:11px;margin-top:4px';
  container.append(count);
  store.subscribe(() => {
    const off = offRoad(store);
    const bad = off.filter(n => n.role !== 'branch').length;
    const br = off.filter(n => n.role === 'branch').length;
    count.textContent = off.length === 0 ? '도로 밖 노드 없음'
      : `도로 밖 ${off.length}개 (위반 ${bad} · 분기 ${br})`;
    count.style.color = bad > 0 ? UI.warning : UI.textDim;
  });
}
