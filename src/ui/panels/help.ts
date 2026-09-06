/**
 * 목적: 단축키 도움말 오버레이. `?` 또는 `F1`, 상단 바 `?` 버튼으로 연다.
 * 왜 이 구조인가: 단축키를 아무 데도 안 적어 두면 기획자는 도구를 손으로 클릭하는 데만 쓴다
 *   (2026-09-06 첫 배포 후 사용자 피드백: "단축키를 하나도 모르겠다").
 *   별도 문서가 아니라 툴 안에 두는 이유는, 문서는 툴과 같이 안 움직이기 때문이다.
 * 바꾸면 안 되는 것: **여기 적은 키는 전부 실제로 동작해야 한다.** 없는 키를 적으면
 *   기획자는 자기 손을 의심한다. SDD-03 §8 에 있어도 구현이 없으면 적지 마라.
 *   목록은 `ui/input/keyboard.ts` · `pointer.ts` 와 대조해 유지한다.
 * 근거: SDD-03 §8 [D-03-08], SDD-08 §11 [D-08-11]
 */
import { UI } from '../../core/palette.js';

interface Row { keys: string; desc: string }
interface Group { title: string; rows: Row[] }

/** 실제로 동작하는 것만 적는다 (keyboard.ts · pointer.ts 대조, 2026-09-06). */
const GROUPS: Group[] = [
  {
    title: '도구',
    rows: [
      { keys: 'B', desc: '브러시 — 칠하기' },
      { keys: 'L', desc: '선' },
      { keys: 'R', desc: '사각형' },
      { keys: 'F', desc: '채우기' },
      { keys: 'M', desc: '선택 (사각 영역)' },
      { keys: 'I', desc: '스포이드 — 칸 색 집기' },
      { keys: 'N', desc: '노드 — 경로 점 찍기·옮기기' },
      { keys: 'E', desc: '엣지 — 노드 두 개를 잇는다' },
      { keys: 'V', desc: '오브젝트 — 클릭해 선택, 속성 편집' },
    ],
  },
  {
    title: '팔레트',
    rows: [
      { keys: '1 ~ 7', desc: '배치 가능 · 도로 · 벽 · 물 · 마을 · 땅 · 빈칸' },
      { keys: '[ ]', desc: '브러시 크기 1 / 3 / 5' },
    ],
  },
  {
    title: '그리기',
    rows: [
      { keys: '좌클릭', desc: '고른 칸으로 칠한다' },
      { keys: '우클릭', desc: '컨텍스트 메뉴 (도구와 무관)' },
      { keys: 'Shift+클릭', desc: '브러시: 직선 · 사각: 정사각 · 엣지: 지름길로 만들기' },
      { keys: 'Alt+클릭', desc: '잠깐 스포이드 (놓으면 원래 도구로)' },
      { keys: 'Delete', desc: '선택 영역 지우기 · 고른 노드/엣지 삭제' },
    ],
  },
  {
    title: '보기',
    rows: [
      { keys: '휠', desc: '줌 (커서 기준)' },
      { keys: 'Ctrl+0', desc: '100% · 화면 중앙으로' },
      { keys: 'Ctrl+1', desc: '100% (위치 유지)' },
      { keys: 'Space+드래그', desc: '팬. 중클릭 드래그도 같다' },
      { keys: 'G', desc: '격자 켜기/끄기' },
      { keys: 'H', desc: '도달 영역 켜기/끄기' },
    ],
  },
  {
    title: '편집',
    rows: [
      { keys: 'Ctrl+Z', desc: '되돌리기' },
      { keys: 'Ctrl+Y', desc: '다시 하기 (Ctrl+Shift+Z 도 같다)' },
      { keys: 'Ctrl+C / X / V', desc: '선택 영역 복사 · 잘라내기 · 붙여넣기' },
      { keys: 'Esc', desc: '선택 해제 · 이 창 닫기' },
    ],
  },
  {
    title: '파일',
    rows: [
      { keys: 'Ctrl+O', desc: '열기' },
      { keys: 'Ctrl+S', desc: '저장' },
      { keys: 'Ctrl+Shift+C', desc: 'TOON 을 클립보드로 복사' },
      { keys: '?  ·  F1', desc: '이 창' },
    ],
  },
];

/** 지름길은 자주 묻는다 — 표만으로는 안 보이므로 한 줄 더 둔다. */
const NOTES: string[] = [
  '캔버스 우클릭 = 메뉴. 어떤 도구를 켜 뒀든 같다 — 커서 아래에 무엇이 있느냐로만 정해진다. 노드 위면 이름·역할·버스트 트리거·삭제, 엣지 위면 지름길·방향·삭제, 빈 칸이면 노드/시작점/탈출점 놓기.',
  '지우는 것은 팔레트에서 칸을 골라 덧칠하면 된다. 선택 영역은 Delete 로 지운다.',
  '출발점·도착점은 따로 있는 물건이 아니라 노드의 역할이다. 시작 노드에서 보호대상과 공장(모체)이 함께 출발한다. 시작은 정확히 1개, 탈출은 1개 이상이어야 한다 (V-P02).',
  '지름길 만들기: 노드를 우클릭 → "여기서 지름길 시작", 다른 노드를 우클릭 → "여기로 지름길 잇기". 두 점만 고르면 된다. allowed 가 보호대상(Escortee)으로 잠기고 단방향이 된다 (ADR-E11). E 도구에서 두 번째 노드를 Shift+클릭해도 같다.',
  '지름길은 도로를 따라가지 않는다 — 도로 밖으로 질러가는 새 연결이다. 그래서 축 정렬 검사(V-P03)를 받지 않는다. 구매하면 게임이 경로를 다시 푼다.',
  '화살촉은 단방향 엣지에만 그린다. 화살표가 없으면 양방향이다.',
  '노드 색: 시작 흰색 · 탈출 금색 · 그 외 회색. ⚡ 는 버스트 트리거 노드.',
];

let open = false;

export function isHelpOpen(): boolean { return open; }

export function closeHelp(container: HTMLElement): void {
  open = false;
  container.innerHTML = '';
  container.style.cssText = '';
}

export function showHelp(container: HTMLElement): void {
  if (open) { closeHelp(container); return; }
  open = true;

  // 왜 backdrop 을 두는가: 캔버스가 화면을 꽉 채워서, 창만 띄우면 어디까지가 창인지 모른다.
  container.style.cssText =
    'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:' + UI.panel + ';border:1px solid ' + UI.panelBorder + ';color:' + UI.text +
    ';padding:20px 24px;max-height:86vh;overflow:auto;min-width:640px;max-width:min(1000px,92vw)';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:baseline;margin-bottom:14px';
  const title = document.createElement('strong');
  title.textContent = '단축키';
  title.style.fontSize = '15px';
  const hint = document.createElement('span');
  hint.textContent = 'Esc 로 닫기';
  hint.style.cssText = 'margin-left:auto;color:' + UI.textDim;
  head.append(title, hint);
  panel.append(head);

  const cols = document.createElement('div');
  cols.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px 28px';
  for (const g of GROUPS) {
    const sec = document.createElement('div');
    const h = document.createElement('div');
    h.textContent = g.title;
    h.style.cssText = 'color:' + UI.info + ';margin-bottom:6px';
    sec.append(h);
    const tbl = document.createElement('table');
    tbl.style.cssText = 'border-collapse:collapse;width:100%';
    for (const r of g.rows) {
      const tr = document.createElement('tr');
      const kd = document.createElement('td');
      kd.textContent = r.keys;
      // 왜 monospace 인가: 키 이름은 폭이 들쭉날쭉하면 눈으로 훑기 어렵다.
      kd.style.cssText = 'font-family:monospace;white-space:nowrap;padding:2px 12px 2px 0;vertical-align:top;color:' + UI.text;
      const dd = document.createElement('td');
      dd.textContent = r.desc;
      dd.style.cssText = 'padding:2px 0;color:' + UI.textDim;
      tr.append(kd, dd);
      tbl.append(tr);
    }
    sec.append(tbl);
    cols.append(sec);
  }
  panel.append(cols);

  const notes = document.createElement('div');
  notes.style.cssText = 'margin-top:16px;border-top:1px solid ' + UI.panelBorder + ';padding-top:12px';
  for (const n of NOTES) {
    const p = document.createElement('div');
    p.textContent = '· ' + n;
    p.style.cssText = 'color:' + UI.textDim + ';margin:4px 0;line-height:1.5';
    notes.append(p);
  }
  panel.append(notes);

  // 왜 stopPropagation 인가: 패널 안을 클릭했다고 닫히면 표를 읽다가 사라진다.
  panel.onclick = (e) => e.stopPropagation();
  container.onclick = () => closeHelp(container);
  container.append(panel);
}

/** 상단 바에 `?` 버튼을 단다. */
export function mountHelpButton(container: HTMLElement): void {
  const btn = document.createElement('button');
  btn.textContent = '?';
  btn.title = '단축키 (?, F1)';
  btn.style.marginLeft = '4px';
  btn.onclick = () => {
    const di = document.querySelector<HTMLElement>('#dialogs');
    if (di) showHelp(di);
  };
  container.append(btn);
}
