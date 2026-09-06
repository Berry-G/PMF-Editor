/**
 * 목적: 캔버스 우클릭 컨텍스트 메뉴. 노드·엣지·빈 칸에 따라 다른 항목을 낸다.
 * 왜 이 구조인가: 노드 편집이 "도구를 고르고 → 클릭하고 → 오른쪽 패널에서 고친다" 세 단계라
 *   처음 쓰는 사람이 무엇이 되는지 알 수 없었다 (2026-09-06 사용자 피드백). 대상 위에서
 *   바로 할 수 있는 일을 보여 준다. 커맨드는 기존 것을 그대로 쓴다 — 여기서 문서를 직접
 *   고치지 않는다 (ADR-E04).
 * 바꾸면 안 되는 것: **도구와 무관하게 연다.** 메뉴 내용은 커서 아래에 무엇이 있느냐로만 정한다
 *   — 어떤 도구를 켜 뒀는지로 우클릭이 달라지면 예측할 수 없다 (ADR-E12).
 *   지름길을 켤 때 allowed=Escortee + 단방향을 함께 준다 (V-P04, ADR-E11) — 하나만 주면
 *   툴이 자기 검증 규칙을 어기는 문서를 만든다.
 * 근거: SDD-03 §3 [D-03-03], SDD-02 §3 [D-02-04], ADR-E04, ADR-E11
 */
import type { Store } from '../state.js';
import type { View } from '../canvas/view.js';
import type { PathNode } from '../../core/model/stage.js';
import { UI } from '../../core/palette.js';
import { hitTestNode, hitTestEdge } from '../input/hittest.js';
import { addNode, deleteNode, renameNode, setNodeRole } from '../../core/commands/nodes.js';
import { addEdge, deleteEdge, setEdgeProps } from '../../core/commands/edges.js';
import { setTable } from '../../core/commands/fields.js';

type Item = { label: string; run: () => void } | { sep: true };

let menuEl: HTMLElement | null = null;

/**
 * "지름길 시작" 을 누른 노드. 두 번째 노드를 고르면 이어지고 비워진다.
 * 왜 두 단계인가: 지름길은 도로를 따르지 않는 **새 연결**이라 양 끝을 사람이 정해야 한다.
 *   `E` 도구의 Shift+클릭으로도 되지만 그건 숨은 조작이라 아무도 못 찾았다 (2026-09-06).
 *   메뉴에 글자로 있으면 찾을 수 있다.
 */
let shortcutFrom: string | null = null;

function close(): void {
  if (menuEl) { menuEl.remove(); menuEl = null; }
}

function render(items: Item[], sx: number, sy: number): void {
  close();
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;z-index:200;min-width:200px;padding:4px 0;background:' + UI.panel +
    ';border:1px solid ' + UI.panelBorder + ';color:' + UI.text + ';box-shadow:0 4px 16px rgba(0,0,0,0.5)';
  for (const it of items) {
    if ('sep' in it) {
      const hr = document.createElement('div');
      hr.style.cssText = 'height:1px;background:' + UI.panelBorder + ';margin:4px 0';
      el.append(hr);
      continue;
    }
    const b = document.createElement('div');
    b.textContent = it.label;
    b.style.cssText = 'padding:5px 14px;cursor:pointer;white-space:nowrap';
    b.onmouseenter = () => { b.style.background = UI.selection; };
    b.onmouseleave = () => { b.style.background = ''; };
    b.onclick = () => { close(); it.run(); };
    el.append(b);
  }
  document.body.append(el);

  // 왜 붙인 뒤에 재는가: 화면 밖으로 나가는지 알려면 실제 크기가 필요하다.
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(sx, window.innerWidth - r.width - 4) + 'px';
  el.style.top = Math.min(sy, window.innerHeight - r.height - 4) + 'px';
  menuEl = el;
}

/** 커맨드 하나를 한 스트로크로 실행한다 (Undo 한 번에 되돌아가게). */
function run(store: Store, cmd: ReturnType<typeof addNode>): void {
  store.state.history.beginStroke();
  store.dispatch(cmd);
  store.state.history.endStroke();
}

/** `N` 다음 빈 번호로 id 를 만든다. 기존 id 를 재번호하지 않는다 (ADR-E06). */
function freeNodeId(nodes: readonly PathNode[]): string {
  const used = new Set(nodes.map(n => n.id));
  for (let i = 0; i < 1000; i++) {
    const id = 'N' + String(i).padStart(2, '0');
    if (!used.has(id)) return id;
  }
  return 'N' + Date.now();
}

/**
 * 노드를 시작점으로 지정한다. 기존 시작점은 **같은 스트로크에서** 경유로 내린다.
 * 왜: `start` 는 정확히 1개여야 한다 (V-P02 ❌). 그냥 지정만 하면 두 개가 되어 즉시 오류 문서가
 *   되고, 기획자는 왜 빨간 줄이 떴는지 모른다. Undo 한 번에 둘 다 되돌아간다.
 * `exit` 는 강등하지 않는다 — 여러 개는 ⚠️ 이고 게임이 첫 번째만 쓴다 (Escortee.cs:63).
 */
function makeStart(store: Store, id: string): void {
  store.state.history.beginStroke();
  for (const n of store.state.history.doc.path.nodes) {
    if (n.role === 'start' && n.id !== id) store.dispatch(setNodeRole(store.state.history.doc, n.id, 'waypoint'));
  }
  store.dispatch(setNodeRole(store.state.history.doc, id, 'start'));
  store.state.history.endStroke();
}

function nodeItems(store: Store, node: PathNode): Item[] {
  const doc = store.state.history.doc;
  const isTrigger = doc.burst.triggerNodeIds.includes(node.id);
  const roles: PathNode['role'][] = ['start', 'exit', 'waypoint', 'branch'];
  const roleName: Record<PathNode['role'], string> = {
    start: '시작', exit: '탈출', waypoint: '경유', branch: '분기(아군용)',
  };

  const waiting = shortcutFrom !== null && shortcutFrom !== node.id ? `   [지름길: ${shortcutFrom} → ?]` : '';
  const items: Item[] = [{ label: `노드  ${node.id}  (${node.x}, ${node.y})${waiting}`, run: () => { /* 제목 */ } }, { sep: true }];

  items.push({
    label: '이름 바꾸기…',
    run: () => {
      const next = prompt('새 id (영문·숫자·_ 만, 숫자로 시작 불가)', node.id);
      if (!next || next === node.id) return;
      // renameNode 가 엣지와 burst.triggerNodeIds 의 참조까지 같이 고친다 (ADR-E06).
      run(store, renameNode(store.state.history.doc, node.id, next));
    },
  });

  for (const r of roles) {
    if (r === node.role) continue;
    const hasOtherStart = doc.path.nodes.some(n => n.role === 'start' && n.id !== node.id);
    items.push({
      label: r === 'start' && hasOtherStart ? '역할 → 시작 (기존 시작점은 경유로)' : `역할 → ${roleName[r]}`,
      run: () => { if (r === 'start') makeStart(store, node.id); else run(store, setNodeRole(store.state.history.doc, node.id, r)); },
    });
  }

  items.push({ sep: true });

  // 지름길 잇기 — 두 노드를 고르면 끝이다. 경로를 따라갈 필요가 없다:
  //   지름길은 도로 밖으로 질러가는 연결이고, V-P03 은 비지름길 엣지만 검사한다.
  if (shortcutFrom === null || shortcutFrom === node.id) {
    items.push({
      label: '여기서 지름길 시작 →',
      run: () => { shortcutFrom = node.id; },
    });
  } else {
    const fromId = shortcutFrom;
    const dup = doc.path.edges.some(e =>
      (e.from === fromId && e.to === node.id) || (e.bidirectional && e.from === node.id && e.to === fromId));
    items.push({
      label: `여기로 지름길 잇기  (${fromId} → ${node.id})`,
      run: () => {
        shortcutFrom = null;
        if (dup) { alert(`"${fromId}" 와 "${node.id}" 사이에는 이미 엣지가 있다. 그 엣지를 우클릭해 지름길로 바꿔라 (중복 엣지는 V-P08 이 거부한다).`); return; }
        // allowed=Escortee (V-P04) + 단방향 (V-P10, ADR-E11) 을 함께 준다.
        run(store, addEdge({ from: fromId, to: node.id, allowed: ['Escortee'], bidirectional: false, shortcut: true }));
      },
    });
    items.push({ label: '지름길 시작 취소', run: () => { shortcutFrom = null; } });
  }

  items.push({ sep: true });
  items.push({
    label: isTrigger ? '버스트 트리거 해제' : '버스트 트리거로 지정',
    run: () => {
      const cur = store.state.history.doc.burst.triggerNodeIds;
      const next = isTrigger ? cur.filter(t => t !== node.id) : [...cur, node.id];
      run(store, setTable('burst.triggerNodeIds', next));
    },
  });

  items.push({ sep: true });
  items.push({
    label: '노드 삭제 (붙은 엣지·트리거도 함께)',
    run: () => run(store, deleteNode(store.state.history.doc, node.id)),
  });
  return items;
}

function edgeItems(store: Store, index: number): Item[] {
  const e = store.state.history.doc.path.edges[index]!;
  const items: Item[] = [
    { label: `엣지  ${e.from} ${e.bidirectional ? '↔' : '→'} ${e.to}${e.shortcut ? '  (지름길)' : ''}`, run: () => { /* 제목 */ } },
    { sep: true },
  ];

  items.push({
    label: e.shortcut ? '지름길 해제' : '지름길로 만들기',
    run: () => {
      // 왜 세 값을 함께 바꾸는가: 지름길은 allowed=Escortee 여야 하고(V-P04) 단방향이어야
      //   한다(V-P10, ADR-E11). 하나만 바꾸면 툴이 자기 규칙을 어기는 문서를 만든다.
      run(store, e.shortcut
        ? setEdgeProps(index, { shortcut: false, allowed: ['Escortee', 'Enemy', 'Ally'], bidirectional: true })
        : setEdgeProps(index, { shortcut: true, allowed: ['Escortee'], bidirectional: false }));
    },
  });

  if (!e.shortcut) {
    items.push({
      label: e.bidirectional ? '단방향으로' : '양방향으로',
      run: () => run(store, setEdgeProps(index, { bidirectional: !e.bidirectional })),
    });
  }

  items.push({ sep: true });
  items.push({ label: '엣지 삭제', run: () => run(store, deleteEdge(index)) });
  return items;
}

function emptyItems(store: Store, cx: number, cy: number): Item[] {
  const doc = store.state.history.doc;
  const items: Item[] = [{ label: `빈 칸  (${cx}, ${cy})`, run: () => { /* 제목 */ } }, { sep: true }];
  items.push({
    label: '여기에 노드 추가',
    run: () => run(store, addNode({ id: freeNodeId(doc.path.nodes), x: cx, y: cy, role: 'waypoint' })),
  });
  // 출발점·도착점은 별도 오브젝트가 아니라 **노드의 role** 이다 (ADR-E05: 같은 사실을 두 곳에
  //   두지 않는다). 게임도 그렇다 — 보호대상과 모체가 같은 start 셀에서 출발한다.
  //   여기서 바로 놓을 수 있게 해 두는 이유는, 노드를 찍고 역할을 따로 고르는 두 단계를
  //   처음 쓰는 사람이 못 찾기 때문이다.
  const hasStart = doc.path.nodes.some(n => n.role === 'start');
  items.push({
    label: hasStart ? '여기에 시작점 (기존 시작점은 경유로)' : '여기에 시작점 — 보호대상·공장이 함께 출발',
    run: () => {
      const d = store.state.history.doc;
      const id = freeNodeId(d.path.nodes);
      store.state.history.beginStroke();
      for (const n of d.path.nodes) {
        if (n.role === 'start') store.dispatch(setNodeRole(store.state.history.doc, n.id, 'waypoint'));
      }
      store.dispatch(addNode({ id, x: cx, y: cy, role: 'start' }));
      store.state.history.endStroke();
    },
  });
  items.push({
    label: '여기에 탈출점 — 보호대상이 도착하면 승리',
    run: () => run(store, addNode({ id: freeNodeId(doc.path.nodes), x: cx, y: cy, role: 'exit' })),
  });

  // 노드가 하나뿐이면 이을 상대가 없다.
  if (doc.path.nodes.length >= 1) {
    items.push({
      label: '여기에 노드 추가 + 가장 가까운 노드와 잇기',
      run: () => {
        const d = store.state.history.doc;
        let near = d.path.nodes[0]!;
        let best = Infinity;
        for (const n of d.path.nodes) {
          const dist = (n.x - cx) ** 2 + (n.y - cy) ** 2;
          if (dist < best) { best = dist; near = n; }
        }
        const id = freeNodeId(d.path.nodes);
        // 왜 한 스트로크인가: 두 커맨드지만 사용자에겐 한 동작이다. Undo 한 번에 둘 다 사라져야 한다.
        store.state.history.beginStroke();
        store.dispatch(addNode({ id, x: cx, y: cy, role: 'waypoint' }));
        store.dispatch(addEdge({ from: near.id, to: id, allowed: ['Escortee', 'Enemy', 'Ally'], bidirectional: true, shortcut: false }));
        store.state.history.endStroke();
      },
    });
  }
  return items;
}

export function mountContextMenu(canvas: HTMLCanvasElement, store: Store, view: View): void {
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const doc = store.state.history.doc;
    const { x, y } = view.screenToCell(e.offsetX, e.offsetY, doc.map);
    const node = hitTestNode(x, y, doc.path.nodes);
    // 노드를 먼저 본다 — 노드는 엣지 위에 그려지므로 엣지가 이기면 노드를 못 고른다.
    const items = node
      ? nodeItems(store, node)
      : (() => { const ei = hitTestEdge(x, y, doc.path.nodes, doc.path.edges); return ei >= 0 ? edgeItems(store, ei) : emptyItems(store, x, y); })();

    render(items, e.clientX, e.clientY);
  });

  // 바깥 클릭·Esc·스크롤·창 크기 변경이면 닫는다. 열어 둔 채로 화면이 바뀌면 엉뚱한 곳을 가리킨다.
  document.addEventListener('pointerdown', (e) => { if (menuEl && !menuEl.contains(e.target as Node)) close(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shortcutFrom = null; close(); } }, true);
  window.addEventListener('resize', close);
  canvas.addEventListener('wheel', close, { passive: true });
}
