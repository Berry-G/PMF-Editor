# SDD-08. 확정 API — 구현 계약

- 버전 0.1 · 2026-09-04
- **이 문서의 시그니처는 계약이다.** 이름·인자·반환형을 그대로 써라. 더 나은 이름이 떠올라도 바꾸지 마라. 바꾸려면 이 문서를 먼저 고치고 사용자에게 알려라.
- 시그니처에 없는 함수·필드를 **추가** 하는 것은 허용된다. 있는 것을 바꾸는 것은 허용되지 않는다.
- 알고리즘(어떻게)은 `SDD-09-알고리즘.md`. 이 문서는 무엇(모양)만 정한다.
- 구현자는 이 문서를 읽기 전에 `SDD-00 §6`(주석 규약)과 `SDD-02`(데이터 모델)를 읽어야 한다.

---

## 0. 구현자에게 — 오해하기 쉬운 것 12개 `[D-08-00]`

코드를 쓰기 전에 아래를 소리 내어 읽어라. 전부 이미 결정된 것이고, 다르게 하면 게임과 어긋난다.

| # | 오해 | 사실 | 근거 |
|---|---|---|---|
| 1 | "맵 배열의 첫 행이 y=0" | **`rows` 의 첫 행이 `y = height-1`** (화면 위). `cells` 배열은 `index = y*width + x`, y=0 이 아래. 변환은 `core/toon` 안에서만 | SDD-02 §2-1 |
| 2 | "빈칸 `_` 는 벽 `W` 와 같다" | 게임 런타임에서는 둘 다 통행 불가지만 **화면이 다르고 왕복이 다르다.** 따로 둔다 (`Empty=255`) | SDD-02 §2-2 |
| 3 | "마을 칸에 유닛을 놓을 수 있다" | 못 놓는다. 배치 가능은 **`Buildable` 뿐** | `GridSystem.IsBuildable` |
| 4 | "아군 도달 영역 계산에서 도로는 통행 가능" | **도로는 아군에게 벽이다.** `{Ground, Buildable, VillageSlot}` 만 밟는다 | SDD-04 §7 |
| 5 | "양방향 엣지는 양쪽에 다 적는다" | **한 번만** 적는다. 게임이 역방향을 만든다. 두 번 적으면 V-P08 | SDD-02 §3-2 |
| 6 | "노드를 지우면 번호를 당겨서 다시 매긴다" | **절대 안 된다.** id 는 게임이 이름으로 매칭한다 | ADR-E06 |
| 7 | "지름길은 allowed 를 마음대로" | 지름길이면 `allowed` 는 **정확히 `['Escortee']`**. UI 가 다른 조합을 못 만들게 한다 | V-P04 |
| 8 | "엣지에 비용(cost)을 둔다" | 두지 않는다. 게임이 거리로 계산한다 | SDD-02 §3-2 |
| 9 | "검증 실패하면 저장을 막는다" | 막지 않는다. 경고 주석 + 다이얼로그. **임포터** 가 막는다 | ADR-E08 |
| 10 | "시뮬에 전투를 넣으면 더 유용하다" | 넣지 않는다. 천장만 | ADR-E07 |
| 11 | "core 에서 `Math.random()` / `Date.now()` 를 써도 된다" | **금지.** 결정론이 깨진다. PRNG 는 시드 있는 mulberry32, 시각은 인자로 받는다 | SDD-09 §7 |
| 12 | "라이브러리 하나쯤은" | **런타임 의존성 0.** `devDependencies` 는 vite·vitest·typescript·singlefile 플러그인뿐 | CLAUDE.md §1 |

## 1. 프로젝트 설정 `[D-08-01]`

### 1-1. `package.json`

```json
{
  "name": "pmf-editor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build && node scripts/postbuild.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:size": "node scripts/check-size.mjs",
    "sync:fixtures": "node scripts/sync-fixtures.mjs",
    "deploy": "bash scripts/deploy.sh"
  },
  "devDependencies": {
    "typescript": "latest-stable",
    "vite": "latest-stable",
    "vite-plugin-singlefile": "latest-stable",
    "vitest": "latest-stable"
  }
}
```
`latest-stable` 은 자리표시자다 — M0 에서 `npm view <pkg> version` 으로 확인한 **정확한 버전을 고정** 하라 (`^` 없이). `dependencies` 항목은 존재하지 않아야 한다.
M0(2026-09-04) 에서 고정한 값: `typescript 7.0.2`, `vite 8.2.2`, `vitest 5.0.0`, `vite-plugin-singlefile 2.3.3`, `@types/node 26.4.1`.

`build` 가 `tsc --noEmit` 으로 시작하는 이유: `vite build` 는 타입을 검사하지 않는다. 없으면 타입 오류가 그대로 산출물이 되어 기획자 앞에서 터진다.

- `scripts/postbuild.mjs`: `dist/index.html` → `dist/pmf-editor.html` 로 이름 변경. 그 외 산출물이 있으면 실패 (단일 파일이 깨졌다는 뜻).
- `scripts/check-size.mjs`: `dist/pmf-editor.html` 이 1,048,576 바이트를 넘으면 exit 1.
- `scripts/sync-fixtures.mjs`: `docs/fixtures/**` 를 `../Prowl's Moving Factory/Assets/_Project/Scripts/Tests/Authoring/Fixtures/` 로 복사 (확장자 규칙은 M5 에서 결정, 그때까지 스크립트는 스텁 + `console.log('M5 에서 구현')`).
- `scripts/deploy.sh`: `tar czf` → `scp` → 서버 전개 (경로는 M2 첫 배포 때 채운다).

### 1-2. `vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';   // 왜 'vite' 가 아닌가: test 필드를 같은 파일에 두려면 vitest 확장판이 필요하다
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,   // 왜: 모든 에셋을 인라인. 파일 하나가 목표
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
```
`environment: 'node'` 다 — `core` 테스트에 DOM 이 있으면 안 되기 때문이다. UI 단위 테스트가 꼭 필요하면 파일 단위로 `// @vitest-environment jsdom` 을 쓰되, jsdom 은 M3 까지 도입하지 않는다.

### 1-3. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true, "noFallthroughCasesInSwitch": true, "noUnusedLocals": true,
    "noUnusedParameters": true, "isolatedModules": true, "verbatimModuleSyntax": true,
    "skipLibCheck": true, "noEmit": true, "resolveJsonModule": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```
`scripts/` 는 `.mjs` 라 타입 검사 대상이 아니다(그래서 `include` 에 없다). 헤더 게이트는 별도로 검사한다.
`noUncheckedIndexedAccess` 때문에 `cells[i]` 는 `number | undefined` 다. `core/model/map.ts` 의 `cellAt` 만 배열을 직접 인덱싱하고, 나머지는 그것을 쓴다.

### 1-4. 폴더와 파일 (M0~M4 에서 생기는 것 전부)

```
src/
  main.ts                       조립만. 로직 없음
  styles.css                    단일 스타일시트 (다크, 시스템 폰트)
  core/
    schema.ts                   SCHEMA 상수 (코덱·게이트가 함께 본다)
    model/cell.ts               Cell enum, 문자 매핑, 표시 이름, 팔레트 순서, 통행 술어
    model/stage.ts              StageDocument 와 하위 타입 (SDD-02 §1 그대로)
    model/map.ts                MapData 생성·조회·불변 갱신
    model/factory.ts            createEmptyStage, SEED (씨앗 내장)
    model/equals.ts             stageEquals
    toon/lexer.ts               텍스트 → ToonNode (범용, 스키마 모름)
    toon/decode.ts              ToonNode → StageDocument (스키마 앎)
    toon/encode.ts              StageDocument → 텍스트 (정규 출력)
    toon/number.ts              formatNumber / parseNumber
    toon/migrate.ts             옛 스키마 → 현재 (M1 에서는 v1 만, 빈 표)
    validate/index.ts           validate()
    validate/rules.ts           RULE_IDS, 규칙별 메타(심각도·메시지 템플릿)
    validate/map.ts path.ts spawn.ts balance.ts file.ts   규칙 구현
    geometry/xy.ts              XY, 인덱스 변환
    geometry/shapes.ts          brushCells, lineCells, rectCells
    geometry/flood.ts           floodFill
    geometry/reach.ts           computeReachability
    graph/build.ts              buildGraph
    graph/dijkstra.ts           dijkstra, shortestPath
    graph/nearest.ts            nearestNode
    sim/params.ts               SimParams, EnemyCatalog
    sim/rng.ts                  mulberry32
    sim/simulate.ts             simulate()
    sim/actors.ts               Escortee/Mother/Enemy 상태 (내부)
    commands/command.ts         Command, History
    commands/paint.ts nodes.ts edges.ts fields.ts resize.ts   구체 커맨드
    palette.ts                  색·크기 (출처 주석)
    version.ts                  TOOL_VERSION (빌드 시 주입)
  io/
    file.ts                     open/save/saveAs (FSAA + 폴백)
    clipboard.ts                copyText
    draft.ts                    localStorage 초안
  ui/
    state.ts                    EditorState, Store
    canvas/view.ts              뷰 변환 (유일한 좌표 변환 지점)
    canvas/layer.ts             LayerCanvas
    canvas/renderer.ts          레이어 4장 그리기 + 합성
    canvas/minimap.ts
    input/pointer.ts            포인터 이벤트 → 도구
    input/keyboard.ts           단축키 표
    input/tools/*.ts            brush line rect fill select eyedropper node edge object
    panels/topbar.ts palette.ts props.ts layers.ts tabs/*.ts validation.ts status.ts sim.ts
tests/
  util/walk.ts                게이트 공용 파일 순회 (ROOT, walk, read)
  gates/header-gate.test.ts core-purity.test.ts palette-source.test.ts schema-version.test.ts fixtures-sync.test.ts
  gates/rules-fixtures.test.ts   (M1)
  golden/seed.test.ts         씨앗 왕복·통계·도달 영역
  sim/regression.test.ts      119 / 56 / 402
```
`core/**/*.test.ts` 는 대상 파일 옆에 둔다 (`decode.ts` ↔ `decode.test.ts`).

## 2. `core/model` `[D-08-02]`

```ts
// cell.ts
export enum Cell { Blocked = 0, Ground = 1, Road = 2, Buildable = 3, VillageSlot = 4, Water = 5, Empty = 255 }
export const CELL_TO_CHAR: Readonly<Record<Cell, string>>;        // { Empty:'_', Ground:'.', Road:'R', Buildable:'B', VillageSlot:'V', Blocked:'W', Water:'~' }
export function cellFromChar(ch: string): Cell | undefined;
export function isAllyWalkable(c: Cell): boolean;                  // Ground | Buildable | VillageSlot
export function isRuntimeWalkable(c: Cell): boolean;               // !Blocked && !Water && !Empty  (게임 IsWalkable)
export const CELL_LABEL: Readonly<Record<Cell, string>>;           // 한국어 표시 이름. 검증 메시지와 팔레트가 같은 문구를 쓴다
export const PALETTE_ORDER: readonly Cell[];                       // 팔레트 순서 = 단축키 1~7 (SDD-03 §2)

// map.ts
export interface XY { readonly x: number; readonly y: number }
export function createMap(width: number, height: number, fill: Cell): MapData;   // origin = [-(width/2), -(height/2)]  왜: 게임 씨앗과 같은 규칙 (32→-16, 18→-9)
export function cellAt(map: MapData, x: number, y: number): Cell;                 // 범위 밖 → Cell.Empty
export function indexOf(map: MapData, x: number, y: number): number;              // y*width + x. 범위 검사 없음 (호출자 책임)
export function inBounds(map: MapData, x: number, y: number): boolean;
export function withCells(map: MapData, changes: ReadonlyArray<{ x: number; y: number; cell: Cell }>): MapData;  // 새 MapData. cells 는 복사
export function countCells(map: MapData): Readonly<Record<Cell, number>>;
export function findCells(map: MapData, cell: Cell): XY[];                        // y 오름차순, 같은 y 면 x 오름차순

// factory.ts
export const SEED_TEXT: string;              // docs/examples/Stage_Greybox.toon 을 `?raw` 로 import
export function createEmptyStage(name: string, width: number, height: number): StageDocument;
//   테두리 1칸 Empty, 안쪽 Buildable, 노드·엣지 없음, 수치는 씨앗과 같은 값. 검증하면 V-M03·V-P02 등이 뜨는 것이 정상
export function loadSeed(): StageDocument;   // decode(SEED_TEXT). 실패하면 throw — 씨앗이 깨졌다는 뜻

// equals.ts
export function stageEquals(a: StageDocument, b: StageDocument): boolean;   // 깊은 비교. cells 는 바이트 비교
```

`StageDocument` 와 하위 타입은 SDD-02 §1 을 **글자 그대로** `stage.ts` 에 옮긴다. `readonly` 를 붙여도 된다.

## 3. `core/toon` `[D-08-03]`

```ts
// lexer.ts — 스키마를 모르는 범용 파서
export type ToonValue = string | number | boolean;
export type ToonNode =
  | { kind: 'object'; entries: Map<string, ToonNode>; line: number }
  | { kind: 'scalar'; value: ToonValue; line: number }
  | { kind: 'array'; items: ToonValue[]; line: number }                          // key[N]: a,b
  | { kind: 'table'; fields: string[]; rows: ToonValue[][]; line: number };      // key[N]{f}: + 행
export interface ToonError { line: number; message: string }     // line 은 1부터, 주석 제거 **전** 원본 줄 번호
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export function parseToon(text: string): Result<ToonNode /* kind:'object' 루트 */, ToonError>;

// decode.ts
export interface DecodeError { line: number; path: string; message: string }
export function decode(text: string): Result<StageDocument, DecodeError>;
//   parseToon → migrate → 스키마 검사(V-F01/F03 에 해당하는 구조 오류는 여기서 DecodeError 로) → StageDocument
//   왜 검증기가 아니라 여기서 잡나: 구조가 틀리면 문서를 만들 수 없다. 검증기는 "만들어진 문서" 를 본다

// encode.ts
export interface EncodeOptions { toolVersion: string; issues?: ReadonlyArray<Issue> }   // issues 가 있고 error 가 있으면 머리 주석
export function encode(doc: StageDocument, opts: EncodeOptions): string;

// number.ts
export function formatNumber(n: number): string;      // SDD-09 §2-3. 정수 → "150", 실수 → 최단 왕복, 지수 표기 금지, NaN/Infinity → throw
export function parseNumber(s: string): number | undefined;   // TOON 숫자 패턴에 맞을 때만

// migrate.ts
export const SCHEMA = 'pmf.stage/1' as const;
export function migrate(root: ToonNode): Result<ToonNode, ToonError>;   // schema 가 현재면 그대로. 모르는 값이면 오류
```

디코더는 **필드가 빠지면 오류** 다. 기본값으로 채우지 않는다 (SDD-02 §5-1 V-F03 의 정신).

## 4. `core/validate` `[D-08-04]`

```ts
export type Severity = 'error' | 'warning' | 'info';
export type RuleId = 'V-F01' | 'V-F02' | 'V-F03' | 'V-M01' | … | 'V-B03';    // rules.ts 의 문자열 리터럴 유니온
export interface Issue {
  id: RuleId;
  severity: Severity;
  path: string;              // "map.rows[14]", "path.edges[2]", "spawn.table[1].enemy", "burst.triggerNodeIds[0]", "" (문서 전체)
  message: string;           // SDD-09 §3 템플릿으로 만든 완성 문장 (한국어)
  cells?: XY[];              // 캔버스 마커용. 있으면 그 칸을 표시
  nodeIds?: string[];
  edgeIndex?: number;        // path.edges 의 인덱스
}
export interface ValidateContext {
  mode: 'tool' | 'importer';                 // V-S01 심각도가 갈린다
  enemyCatalog: ReadonlySet<string>;         // 툴: 내장+사용자 추가. 임포터: 에셋 이름
}
export function validate(doc: StageDocument, ctx: ValidateContext): Issue[];
//   순서: F → M → P → S → B. 같은 규칙 안에서는 path 순서. F 에 error 가 있으면 나머지를 돌리지 않는다
export const RULE_IDS: ReadonlyArray<RuleId>;                 // 픽스처 파일명 집합과 대조하는 테스트가 쓴다
export interface RuleMeta { id: RuleId; severity: Severity | 'by-mode'; title: string }
export const RULES: ReadonlyArray<RuleMeta>;

// reach.ts (geometry 이지만 검증이 쓴다)
export interface Reachability {
  villages: XY[];                                    // findCells(VillageSlot) 순서
  regionOf: Int32Array;                              // cells 와 같은 길이. 도달 가능한 마을 구역 번호(0..), 아니면 -1
  reachableBuildable: number; totalBuildable: number;
  perVillage: ReadonlyArray<{ village: XY; region: number; buildable: number }>;
}
export function computeReachability(map: MapData): Reachability;
```

## 5. `core/geometry` · `core/graph` `[D-08-05]`

```ts
// shapes.ts — 전부 "칠할 칸 목록" 을 돌려준다. 범위 밖 칸은 제외. 중복 없음. 순서는 y, x 오름차순
export function brushCells(map: MapData, cx: number, cy: number, size: 1 | 3 | 5): XY[];
export function lineCells(map: MapData, x0: number, y0: number, x1: number, y1: number): XY[];   // SDD-09 §4-2
export function rectCells(map: MapData, x0: number, y0: number, x1: number, y1: number, outlineOnly: boolean): XY[];
// flood.ts
export function floodFill(map: MapData, sx: number, sy: number, same: (c: Cell) => boolean): XY[];   // 4-연결, 시작 칸 포함

// graph/build.ts
export interface GraphNode { id: string; index: number; x: number; y: number; role: NodeRole }
export interface GraphEdge { from: number; to: number; cost: number; allowed: number /* 비트 */; shortcut: boolean; sourceIndex: number }
export interface Graph { nodes: GraphNode[]; out: GraphEdge[][]; byId: Map<string, number> }
export const AGENT_BIT: Readonly<Record<Agent, number>>;    // Escortee 1, Enemy 2, Ally 4
export function buildGraph(path: PathData, opts: { openShortcuts: boolean }): Graph;
//   bidirectional 이면 역방향 GraphEdge 도 만든다 (sourceIndex 는 같은 값). cost = 유클리드(셀 중심)
// graph/dijkstra.ts
export function dijkstra(g: Graph, from: number, agent: Agent): { dist: Float64Array; prev: Int32Array };  // 도달 불가 = Infinity / -1
export function shortestPath(g: Graph, from: number, to: number, agent: Agent): number[] | null;         // 노드 인덱스 열, from 포함 to 포함
// graph/nearest.ts
export function nearestNode(g: Graph, pos: XY /* 연속 좌표, 셀 중심 기준 */, agent: Agent): number | null;
```

## 6. `core/sim` `[D-08-06]`

```ts
export interface EnemyCatalogEntry { name: string; moveSpeed: number }
export const DEFAULT_CATALOG: ReadonlyArray<EnemyCatalogEntry>;     // Robot_Walker 0.7, Robot_Scout 1.19  // 출처: Robot_*.asset
export interface SimParams { seed: number; dt: number /* 1/30 */; shortcutOpenAt: number | null; maxSeconds: number /* 600 */ }
export const DEFAULT_SIM_PARAMS: SimParams;
export function simulate(doc: StageDocument, params: SimParams, catalog: ReadonlyArray<EnemyCatalogEntry>): SimResult;   // SDD-04 §4 의 SimResult
//   전제: validate(doc) 에 error 가 없다. error 가 있으면 throw (호출자가 먼저 검증한다)
//   maxSeconds 에 닿으면 stageSeconds = maxSeconds, warnings 에 "보호대상이 도착하지 못했다"
```

## 7. `core/commands` `[D-08-07]`

```ts
export interface Command {
  readonly label: string;
  apply(doc: StageDocument): StageDocument;
  revert(doc: StageDocument): StageDocument;
  coalesce?(next: Command): Command | null;     // 합칠 수 있으면 합친 새 커맨드, 아니면 null
}
export class History {
  constructor(initial: StageDocument);
  readonly doc: StageDocument;                  // 현재 문서
  readonly canUndo: boolean; readonly canRedo: boolean;
  readonly undoLabel: string | null; readonly redoLabel: string | null;
  readonly dirty: boolean;                      // 마지막 markSaved 이후 변경 여부
  push(cmd: Command): void;                     // apply 후 스택에. 스트로크 중이면 coalesce 시도
  beginStroke(): void; endStroke(): void;       // 이 사이의 push 는 top 과 coalesce 를 시도한다. 밖에서는 시도하지 않는다
  undo(): void; redo(): void;
  markSaved(): void;
  replace(doc: StageDocument): void;            // 파일 열기. 스택 초기화
}
// 구체 커맨드 (생성 함수. 클래스여도 된다)
export function paintCells(map: MapData, changes: ReadonlyArray<{ x: number; y: number; cell: Cell }>, label: string): Command;   // 변화 없는 칸은 제외. 전부 제외면 null 이 아니라 no-op 커맨드
export function pasteCells(map: MapData, anchor: XY, clip: Clipboard): Command;
export function resizeMap(doc: StageDocument, width: number, height: number, anchor: Anchor): Command;
export type Anchor = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';
export function addNode(node: PathNode): Command;
export function moveNode(id: string, to: XY): Command;
export function deleteNode(doc: StageDocument, id: string): Command;                 // 붙은 엣지·트리거 참조를 기억했다가 revert 에서 복원
export function renameNode(doc: StageDocument, id: string, newId: string): Command;  // 엣지·트리거 참조 갱신
export function setNodeRole(doc: StageDocument, id: string, role: NodeRole): Command; // start 로 바꾸면 기존 start 는 waypoint 로
export function addEdge(edge: PathEdge): Command;
export function deleteEdge(index: number): Command;
export function setEdgeProps(index: number, props: Partial<Pick<PathEdge, 'allowed' | 'bidirectional' | 'shortcut'>>): Command;   // shortcut:true 면 allowed 를 ['Escortee'] 로 강제
export function setField(path: FieldPath, value: number | boolean | string): Command;   // "spawn.restSeconds" 같은 점 경로. 타입은 FieldPath 유니온으로 제한
export function setTable(path: 'spawn.table' | 'spawn.healthByProgress' | 'economy.difficulties' | 'burst.triggerNodeIds', rows: unknown[]): Command;
export interface Clipboard { width: number; height: number; cells: Uint8Array }
```

`apply`/`revert` 는 **새 문서** 를 돌려준다. 입력 문서를 바꾸는 순간 Undo 가 깨진다 — 테스트가 `stageEquals(input, inputCopy)` 로 잡는다.

## 8. `core/palette.ts` · `core/version.ts` `[D-08-08]`

```ts
export const CELL_PX = 32;
export const COLOR: Readonly<Record<Cell, string>>;       // SDD-01 §5 표. Empty 는 BACKGROUND
export const BACKGROUND = '#141419';                       // 출처: SceneBootstrap.cs:54-63
export const ACTOR: Readonly<{ escortee: string; mother: string; village: string; exit: string; walker: string; scout: string }>;
export const ACTOR_SCALE: Readonly<{ escortee: 0.9; mother: 1.5; village: 1.4 }>;
export const EDGE: Readonly<{ normal: string; shortcut: string; dash: number }>;
export const UI: Readonly<{ selection: string; reach: string[]; unreachHatch: string; error: string; warning: string; grid: string; gridMajor: string; brushPreview: string }>;   // 툴 전용. 출처 주석 불필요
export const TOOL_VERSION: string;   // version.ts — vite define 으로 package.json version + 빌드 시각(UTC, 분 단위)
```
`COLOR`·`ACTOR`·`ACTOR_SCALE`·`EDGE` 의 **모든 값 같은 줄** 에 `// 출처: 파일:라인`.
게이트는 파일을 두 구역으로 나눠 본다: 줄 시작의 `/* @출처-불필요` 마커 **위쪽** 의 색 리터럴은 출처가 필수, 아래쪽(툴 전용 `UI` 색)은 면제.
새 게임 색은 반드시 마커 위에 둔다. `EDGE` 에는 노드 색 3종(`nodeStart`/`nodeExit`/`nodeNormal`)도 포함한다.

## 9. `io/` `[D-08-09]`

```ts
// file.ts
export interface OpenedFile { name: string; text: string; handle: FileSystemFileHandle | null }
export function openFile(): Promise<OpenedFile | null>;                       // 사용자가 취소하면 null
// 저장은 **취소를 성공과 구분한다** (2026-09-06). 예전에는 둘 다 null 이라, 취소해도 호출부가
//   markSaved() 를 불러 "저장됨" 으로 표시했고 창을 닫을 때 경고도 안 떴다.
export type SaveOutcome = { status: 'saved'; handle: FileSystemFileHandle | null } | { status: 'cancelled' };
export function saveFile(text: string, handle: FileSystemFileHandle | null, suggestedName: string): Promise<SaveOutcome>;
//   handle 이 있으면 덮어쓴다. 없으면 saveAs. FSAA 가 없으면 다운로드 후 { saved, handle: null }
export function saveFileAs(text: string, suggestedName: string): Promise<SaveOutcome>;
//   피커에서 AbortError 면 { cancelled } — 폴백 다운로드로 내려가지 않는다. 그 밖의 오류는 폴백.
export const hasFsAccess: boolean;                                            // 'showOpenFilePicker' in window
// clipboard.ts
export function copyText(text: string): Promise<boolean>;
// draft.ts
export function saveDraft(text: string, name: string): void;                 // 키 'pmf-editor.draft', { savedAt, name, text }
export function loadDraft(): { savedAt: number; name: string; text: string } | null;
export function clearDraft(): void;                                          // **저장 성공 시 반드시 부른다** (안 부르면 다음에 열 때 복구 프롬프트가 또 뜬다)
```

## 10. `ui/` `[D-08-10]`

```ts
// state.ts
export type ToolId = 'brush' | 'line' | 'rect' | 'fill' | 'select' | 'eyedropper' | 'node' | 'edge' | 'object';
export type Selection =
  | { kind: 'none' } | { kind: 'cells'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'nodes'; ids: string[] } | { kind: 'edge'; index: number } | { kind: 'village'; x: number; y: number };
export interface ViewState { zoom: number; panX: number; panY: number; layers: Record<LayerId, boolean>; showGrid: boolean }
export type LayerId = 'tiles' | 'path' | 'objects' | 'reach' | 'issues' | 'sim';
export interface EditorState {
  history: History; selection: Selection; tool: ToolId; brushSize: 1 | 3 | 5; paletteCell: Cell; eraserCell: Cell;
  view: ViewState; issues: Issue[]; reach: Reachability; sim: SimResult | null; simStale: boolean;
  fileName: string; fileHandle: FileSystemFileHandle | null; catalog: EnemyCatalogEntry[];
}
export class Store {
  readonly state: EditorState;
  update(fn: (s: EditorState) => Partial<EditorState>): void;   // 얕은 병합 후 구독자 호출. history 가 바뀌면 issues·reach 재계산(디바운스 100ms)
  subscribe(fn: (s: EditorState, changed: ReadonlySet<keyof EditorState>) => void): () => void;
  dispatch(cmd: Command): void;                                    // history.push + update
}

// canvas/view.ts — 좌표 변환의 유일한 장소
export class View {
  zoom: number; panX: number; panY: number;                        // pan 은 화면 픽셀 단위 (CSS px)
  cellToScreen(x: number, y: number, map: MapData): { sx: number; sy: number };   // 셀 (x,y) 의 화면 좌상단. y 뒤집기 여기서
  screenToCell(sx: number, sy: number, map: MapData): { x: number; y: number; fx: number; fy: number };   // 정수 셀 + 셀 내부 소수
  zoomAt(sx: number, sy: number, factor: number): void;            // 커서 고정 줌
  fitToMap(map: MapData, viewportW: number, viewportH: number): void;
}
// canvas/layer.ts
export class LayerCanvas { readonly canvas: OffscreenCanvas | HTMLCanvasElement; markDirty(x0, y0, x1, y1): void; markAllDirty(): void; takeDirty(): { x0, y0, x1, y1 } | null }
// canvas/renderer.ts
export class Renderer { constructor(target: HTMLCanvasElement, store: Store); requestFrame(): void; }   // rAF 한 번에 한 프레임

// input/tools/tool.ts
export interface PointerInfo { cell: XY; fx: number; fy: number; button: 0 | 1 | 2; shift: boolean; ctrl: boolean; alt: boolean; sx: number; sy: number }
export interface Tool {
  readonly id: ToolId;
  onDown(p: PointerInfo, ctx: ToolContext): void;
  onMove(p: PointerInfo, ctx: ToolContext): void;
  onUp(p: PointerInfo, ctx: ToolContext): void;
  onCancel(ctx: ToolContext): void;                                 // Esc 또는 도구 전환
  preview(ctx: ToolContext): { cells?: XY[]; line?: [XY, XY]; rect?: [XY, XY] } | null;   // 커서 프리뷰 (렌더가 그린다)
}
export interface ToolContext { store: Store; view: View }
```

## 11. DOM 골격 `[D-08-11]`

`index.html` 의 `body` 는 아래 id 를 가진 요소만 갖는다. 패널은 각자 자기 요소 안에만 그린다.

```html
<div id="app">
  <header id="topbar"></header>
  <aside id="left"><section id="palette"></section><section id="tools"></section><section id="path-ops"></section></aside>
  <main id="canvas-wrap"><canvas id="canvas"></canvas><div id="statusbar"></div></main>
  <aside id="right"><section id="props"></section><section id="minimap"><canvas id="minimap-canvas"></canvas></section><section id="layers"></section></aside>
  <footer id="bottom"><div id="bottom-resize"></div><nav id="tabs"></nav><div id="tab-body"></div><div id="issues"></div></footer>
  <div id="dialogs"></div>
</div>
```
CSS 는 `styles.css` 하나. CSS Grid 로 `topbar / left canvas right / bottom`. 캔버스는 `ResizeObserver` 로 크기를 따라가고 `devicePixelRatio` 를 반영한다 (SDD-09 §9-3).

하단 행 높이는 고정이 아니라 `--bottom-h` (기본 200px) 다. `#bottom-resize` 를 끌면 `ui/input/split.ts` 가 그 변수만 바꾸고, 캔버스는 `ResizeObserver` 로 따라온다 — 캔버스 크기를 두 곳에서 계산하지 않는다. 값은 `localStorage["pmf-editor.bottomHeight"]` 에 남고, 더블클릭하면 기본값으로 돌아간다. 최소 72px(탭 줄이 잘리지 않게) / 최대는 캔버스에 160px 을 남긴 만큼.

## 12. 헤더 게이트 정규식 `[D-08-12]`

`tests/gates/header-gate.test.ts` 는 `src/**/*.ts`, `tests/**/*.ts`, `scripts/**/*.mjs` 각 파일에 대해:

1. 파일의 첫 비공백 토큰이 `/**` 로 시작하는 블록 주석이다.
2. 그 블록 안에 다음 네 정규식이 **모두** 한 번 이상 매치된다 (여러 줄 모드):
   - `^\s*\*\s*목적:\s*\S`
   - `^\s*\*\s*왜 이 구조인가:\s*\S`
   - `^\s*\*\s*바꾸면 안 되는 것:\s*\S`
   - `^\s*\*\s*근거:.*(SDD-0\d|ADR-E\d\d)`
3. 실패 메시지는 파일 경로 + 빠진 항목 이름.

`*.test.ts` 도 예외가 아니다 — 테스트가 **무엇을 왜** 지키는지가 헤더에 있어야 한다.

## 13. 하지 마라 `[D-08-13]`

| 금지 | 왜 |
|---|---|
| `any`, `as unknown as`, `!` non-null 단언 (테스트 제외) | strict 를 켠 이유가 없어진다 |
| `core` 에서 `console.*` | 테스트 출력이 더러워지고 결정론과 무관한 부작용 |
| `core` 에서 `async`/`Promise` | 순수 함수여야 C# 과 1:1 |
| 전역 가변 상태 (`let` 모듈 변수) — `Store` 하나 제외 | 상태가 두 곳이면 Undo 가 거짓말한다 |
| 클래스 상속 (도구·커맨드·패널) | 조합으로 충분하다. 상속 계층은 "어디서 무슨 일이" 를 숨긴다 |
| `innerHTML` 에 사용자 문자열 삽입 | 노드 id·적 이름은 사용자 입력이다. `textContent` |
| `Number.prototype.toFixed` 로 파일에 숫자 쓰기 | 정규 출력이 깨진다. `formatNumber` 만 |
| 파일 저장 전 `validate` 생략 | 경고 주석·다이얼로그가 빠진다 |
| 게임 값 하드코딩 (`0.42` 같은 것을 `core` 에) | 파일이 원본이다. 기본값은 씨앗에서 읽는다 |
| 테스트 없이 "통과" 보고 | CLAUDE.md §4 |

## 14. 완료 보고 형식 (구현자 → 사용자) `[D-08-14]`

마일스톤 하나를 끝내면 아래 다섯 줄로 보고한다. 실제 명령 출력이 없으면 "실행하지 않음" 이라고 쓴다.

```
1. 무엇을 만들었나 (파일 목록, 각 한 줄)
2. npm test 결과 (통과/실패 수, 실패 목록 원문)
3. npm run build 결과 (dist/pmf-editor.html 크기)
4. SDD 와 다르게 한 것 + 이유 (없으면 "없음")
5. 확정하지 못한 가정 (없으면 "없음")
```
