/**
 * 목적: 도구 목록 — 9종을 보여 주고 **지금 무엇이 켜져 있는지** 표시한다. 클릭해도 바뀐다.
 * 왜 이 구조인가: 도구를 단축키로만 고를 수 있었고 화면 어디에도 현재 도구가 없었다. 그래서
 *   브러시인 줄 알고 노드를 찍는 식의 오조작이 났다 (2026-09-06 사용자 피드백).
 *   팔레트와 같은 모양으로 바로 아래에 둔다 — 스타크래프트 배치를 따른다 (SDD-03 §1).
 * 바꾸면 안 되는 것: 표시 순서와 단축키 글자. 단축키는 `ui/input/keyboard.ts` 의 TOOL_KEYS 가
 *   정본이고 여기는 그것을 **보여 주기만** 한다 — 두 곳이 어긋나면 화면이 거짓말을 한다.
 *   셀 도구와 경로 도구를 갈라 둔 것도 유지하라 — 하는 일이 다르다.
 * 근거: SDD-03 §1 [D-03-01], SDD-03 §3 [D-03-03], SDD-08 §11 [D-08-11]
 */
import type { Store } from '../state.js';
import type { ToolId } from '../state.js';
import { UI } from '../../core/palette.js';

interface Entry { id: ToolId; key: string; label: string; hint: string }

/** 순서·글자는 keyboard.ts 의 TOOL_KEYS 와 같아야 한다. */
const CELL_TOOLS: Entry[] = [
  { id: 'brush', key: 'B', label: '브러시', hint: '칠하기. [ ] 로 크기 1/3/5, Shift+클릭 직선' },
  { id: 'line', key: 'L', label: '선', hint: '두 점을 잇는 직선' },
  { id: 'rect', key: 'R', label: '사각', hint: 'Shift 로 정사각' },
  { id: 'fill', key: 'F', label: '채우기', hint: '같은 칸으로 이어진 영역을 채운다' },
  { id: 'select', key: 'M', label: '선택', hint: '사각 영역. Ctrl+C/X/V, Delete' },
  { id: 'eyedropper', key: 'I', label: '스포이드', hint: '칸 종류 집기. Alt+클릭으로 잠깐 쓸 수도 있다' },
];

const PATH_TOOLS: Entry[] = [
  { id: 'node', key: 'N', label: '노드', hint: '경로 점 찍기·옮기기' },
  { id: 'edge', key: 'E', label: '엣지', hint: '노드 두 개를 잇는다. 두 번째를 Shift+클릭하면 지름길' },
  { id: 'object', key: 'V', label: '오브젝트', hint: '클릭해 선택 → 오른쪽 속성 패널' },
];

function row(store: Store, e: Entry): HTMLElement {
  const el = document.createElement('div');
  el.dataset.tool = e.id;
  el.title = e.hint;
  el.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;cursor:pointer;padding:1px 3px';

  const key = document.createElement('span');
  key.textContent = e.key;
  // 왜 monospace + 고정폭인가: 글자 폭이 들쭉날쭉하면 이름이 세로로 안 맞아 훑기 어렵다.
  key.style.cssText =
    'font-family:monospace;width:14px;height:14px;line-height:14px;text-align:center;' +
    'border:1px solid ' + UI.panelBorder + ';color:' + UI.textDim;
  el.append(key);

  const label = document.createElement('span');
  label.textContent = e.label;
  el.append(label);

  el.onclick = () => store.update((_s) => ({ tool: e.id }));
  return el;
}

export function mountTools(store: Store, container: HTMLElement): void {
  const heading = document.createElement('p');
  heading.className = 'section-title';
  heading.textContent = '도구';
  container.append(heading);

  const rows: HTMLElement[] = [];
  for (const e of CELL_TOOLS) { const r = row(store, e); container.append(r); rows.push(r); }

  // 왜 가르는가: 위는 칸을 칠하고 아래는 경로를 만진다. 하는 일이 달라 섞이면 헷갈린다.
  const sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:' + UI.panelBorder + ';margin:6px 0';
  container.append(sep);
  const note = document.createElement('div');
  note.textContent = '경로';
  note.style.cssText = 'color:' + UI.textDim + ';font-size:11px;margin-bottom:4px';
  container.append(note);

  for (const e of PATH_TOOLS) { const r = row(store, e); container.append(r); rows.push(r); }

  store.subscribe((state) => {
    for (const r of rows) {
      const on = r.dataset.tool === state.tool;
      r.style.background = on ? UI.selection + '30' : 'transparent';
      // 왼쪽 띠 하나를 더 둔다 — 배경색만으로는 밝은 화면에서 잘 안 보인다.
      r.style.boxShadow = on ? 'inset 2px 0 0 ' + UI.selection : '';
      const key = r.firstElementChild as HTMLElement | null;
      if (key) key.style.color = on ? UI.text : UI.textDim;
    }
  });
}
