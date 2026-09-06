# SDD-01. 아키텍처

- 버전 0.1 · 2026-09-03
- 관련 ADR: E01(스택), E03(계층 분리), E04(커맨드 Undo), E09(색상 사본)

---

## 1. 기술 스택 `[D-01-01]`

| 항목 | 선택 | 왜 |
|---|---|---|
| 언어 | TypeScript (strict) | 문서 모델·검증 규칙·시뮬 수식을 타입으로 못박는다. C# 임포터로 옮길 때 1:1 대응이 보인다 |
| 빌드 | Vite + `vite-plugin-singlefile` | 개발은 모듈로, 산출은 **`dist/pmf-editor.html` 파일 하나**. 기획자 설치 0 (ADR-E01) |
| 테스트 | vitest | `core/` 가 DOM 을 모르므로 브라우저 없이 전부 돈다 |
| 렌더 | Canvas 2D 직접 | 32×18~수백 칸 격자에 프레임워크가 필요 없다. 런타임 의존성 0 이 목표 — 몇 년 뒤에 열어도 돌아야 한다 |
| UI 프레임워크 | **없음** (바닐라 DOM) | 패널 대여섯 개에 React 를 얹으면 단일 HTML 이 무거워지고, 캔버스 중심 앱에서 얻는 게 없다 |
| 데이터 포맷 | TOON (자체 코덱) | ADR-E02. 공식 SDK 가 TS 뿐이고 우리는 부분집합만 쓰므로 직접 구현이 더 작다 |

Node 24 / npm 11 이 개발 PC 에 이미 있다. 기획자 PC 에는 **아무것도 필요 없다.**

## 2. 계층과 의존 방향 `[D-01-02]`

```
src/
  core/        순수 TS. DOM · window · fetch 를 모른다.
    model/       StageDocument 타입, 생성·복제·비교
    toon/        encode / decode (부분집합 코덱)
    validate/    규칙 V-* 구현 (SDD-02 §5)
    commands/    Command 인터페이스와 구체 커맨드
    geometry/    격자 좌표, Bresenham, 플러드필, 다익스트라
    sim/         시뮬레이션 코어 (SDD-04)
    palette.ts   색·크기 상수 (출처 주석 필수)
  ui/          캔버스 렌더·패널·입력. core 에만 의존.
    canvas/      레이어 캔버스, 뷰 변환, 더티 영역
    panels/      팔레트·속성·탭·검증·미니맵·시뮬 타임라인
    input/       마우스·키보드 → 도구 상태기계 → 커맨드
    state.ts     EditorState 와 구독
  io/          파일·클립보드·localStorage. core 에만 의존.
  main.ts      조립
```

**의존은 `ui → core`, `io → core` 만 허용한다. `core` 는 아무것도 import 하지 않는다.**

왜:
1. `core` 에 DOM 이 없으면 vitest 가 브라우저 없이 전부 덮는다. 검증 규칙·코덱·시뮬은 이 앱에서 틀리면 안 되는 부분이고, 그 부분이 전부 `core` 다.
2. `core/validate` 와 `core/toon` 은 게임 쪽 C# (`AuthoringValidator`, `ToonReader`) 과 **같은 규칙 ID, 같은 픽스처** 를 공유한다 (SDD-06 §3). 순수 함수여야 옮길 수 있다.
3. 캔버스 렌더는 자주 바뀌지만 문서 모델은 파일 포맷과 묶여 있어 잘 안 바뀐다. 변화 속도가 다른 것은 분리한다.

게이트: `eslint` 없이도 잡히게 `core/` 안에서 `document`·`window` 문자열을 grep 하는 테스트를 둔다 (SDD-06 §4).

## 3. 상태와 커맨드 `[D-01-03]`

```ts
interface EditorState {
  doc: StageDocument;        // 파일의 1:1 대응물. 커맨드 밖에서 바꾸지 않는다
  history: History;          // undo/redo 스택 + 더러움(dirty) 표시
  selection: Selection;      // 셀 영역 | 노드 집합 | 엣지 | 없음
  tool: ToolState;           // 현재 도구와 그 내부 상태 (브러시 크기, 드래그 시작점…)
  view: ViewState;           // 줌·팬·레이어 토글·격자 표시
  validation: Issue[];       // 마지막 검증 결과 (doc 이 바뀌면 재계산, 디바운스 100ms)
  sim?: SimResult;           // 마지막 시뮬 결과 (명시적으로 돌렸을 때만)
}
```

### 3-1. 문서는 커맨드로만 바뀐다

```ts
interface Command {
  readonly label: string;                     // Undo 메뉴에 보일 이름 ("벽 칠하기 12칸")
  do(doc: StageDocument): StageDocument;      // 새 문서를 돌려준다 (in-place 변경 금지)
  undo(doc: StageDocument): StageDocument;
  coalesceWith?(next: Command): Command | null; // 같은 스트로크면 합친다
}
```

- **왜 커맨드인가:** 스타크래프트급 Undo(무제한, 라벨 있는 히스토리, 붙여넣기·크기 변경까지 되돌림)는 "이전 상태 스냅샷" 으로는 맵이 커질수록 못 버틴다. 커맨드는 바뀐 셀만 기억한다.
- **왜 새 문서를 돌려주는가:** 렌더가 "무엇이 바뀌었나" 를 참조 비교로 알 수 있다. 맵 셀 배열은 `Uint8Array` 라 통째로 복사해도 32×18 = 576B, 200×100 이어도 20KB 다. 값싸다.
- **코얼레싱:** 브러시 드래그 한 번 = 커맨드 한 개. `mousedown` 에서 시작, 이동마다 `coalesceWith`, `mouseup` 에서 확정. 이러면 Ctrl+Z 한 번에 스트로크 하나가 돌아간다 — 셀 하나씩 돌아가면 아무도 Undo 를 안 쓴다.
- 히스토리 상한은 두지 않는다. 메모리가 문제 되면 그때 상한을 둔다 (YAGNI).

### 3-2. 커맨드 목록 (M2~M3 에서 구현)

| 커맨드 | 하는 일 | 특이사항 |
|---|---|---|
| `PaintCells` | 셀 집합에 타입 지정 | 코얼레싱 대상. 이전 값 맵을 기억 |
| `FillRect` / `FloodFill` | 영역 채우기 | `PaintCells` 로 환원 |
| `PasteCells` | 클립보드 영역 붙여넣기 | 앵커 좌표 + 잘림 |
| `ResizeMap` | 크기·앵커 변경 | 잘리는 셀·맵 밖으로 나가는 노드를 미리 경고 (SDD-03 §7) |
| `AddNode` / `MoveNode` / `DeleteNode` | 노드 편집 | Delete 는 붙은 엣지·버스트 트리거 참조까지 지우고 undo 때 복원 |
| `RenameNode` | id 변경 | **엣지·`burst.triggerNodeIds` 참조를 함께 갱신** (ADR-E06) |
| `SetNodeRole` | start/exit/branch/waypoint | start 는 하나뿐 → 이전 start 를 waypoint 로 내린다 |
| `AddEdge` / `DeleteEdge` / `SetEdgeProps` | 엣지 편집 | shortcut 켜면 allowed 를 Escortee 로 강제 (V-P04 를 애초에 못 어기게) |
| `SetField` | 스폰·밸런스 폼의 스칼라 | 경로 문자열(`spawn.restSeconds`)로 범용 |
| `SetTableRows` | 스폰 표·난이도 표·체력 곡선 | 표 전체 교체 |

## 4. 렌더 파이프라인 `[D-01-04]`

```
      ┌ tiles        (오프스크린) 셀 색. 셀이 바뀐 영역만 다시 칠한다
      ├ overlay      (오프스크린) 도달 가능 영역 · 검증 마커 · 선택 영역
      ├ objects      (오프스크린) 노드·엣지·마을 마커·시작/탈출 표시
      └ sim          (오프스크린) 궤적·현재 위치
      ─────────────────────────────────────────────────
  화면 캔버스 = 배경(#141419) + 위 4장을 view 변환(줌·팬)으로 합성 + 격자선 + 커서 프리뷰
  미니맵 = tiles 레이어를 축소 + 뷰포트 사각형
```

- **왜 오프스크린 4장인가:** 셀 하나 칠할 때 노드·엣지·오버레이를 다시 그리면 안 된다. 각 레이어가 자기 더티 영역만 갱신하고, 화면 합성은 `requestAnimationFrame` 한 번에 한다.
- **왜 view 변환을 합성 단계에서만 적용하는가:** 레이어는 항상 "셀 단위 픽셀" 로 그린다 (1셀 = 32px 고정). 줌은 합성 시 `drawImage` 스케일이라 레이어를 다시 그리지 않는다. 미니맵도 같은 tiles 레이어를 쓴다.
- 좌표 변환은 **`ui/canvas/view.ts` 한 곳** 에서만 한다 (게임의 "격자↔월드 변환은 GridSystem 안에서만" 규칙과 같은 이유 — 나중에 뷰가 바뀌면 그 파일만 고친다).
- 셀 크기 32px 는 게임 스프라이트 32px 와 맞춘 것이지 필수는 아니다. 상수 하나.

## 5. 색과 크기 — 사본과 출처 `[D-01-05]`

`core/palette.ts` 가 유일한 색 정의다. 값은 게임 코드에서 **복사** 한 것이고 파일 헤더에 출처를 박는다 (ADR-E09).

| 항목 | 값 | 출처 (게임 프로젝트) |
|---|---|---|
| 배경 | `#141419` | `SceneBootstrap.cs:54-63` `(0.08, 0.08, 0.1)` |
| Ground | `#3D3D45` | `SceneParts.cs:41-42` |
| Road | `#BD9966` | `SceneParts.cs:44-45` |
| Buildable | `#598CA6` | `SceneParts.cs:46-47` |
| VillageSlot | `#40994D` | `SceneParts.cs:48-49` |
| Blocked | `#1A1A1F` | `SceneParts.cs:50-51` |
| Water | `#214780` | `SceneParts.cs:54-55` |
| Empty (타일 없음) | 배경색 그대로 | `GridSystem.cs:76` — 타일 없는 칸은 런타임 Blocked, 화면엔 배경 |
| 보호대상 (하트) | `#F35A8C`, 0.9셀 | `GreyboxFactory.cs:127` |
| 모체 (사각) | `#6B1E8C`, 1.5셀 | `GreyboxFactory.cs:137-138` |
| 마을 마커 (사각) | `#33BF4D`, 1.4셀 | `GreyboxFactory.cs:195` |
| 탈출 마커 (테두리) | `#FFD600`, 반변 0.55, 선폭 0.08 | `SceneParts.cs:194-202` |
| Robot_Walker (원) | `#E62626`, 0.4셀 | `GreyboxFactory.cs:146` |
| Robot_Scout (원) | `#FF9E29`, 0.4셀 | `GreyboxFactory.cs:162` |
| 일반 엣지 | `rgba(179,179,179,0.9)` 실선 + 화살표 | `PathNodeAuthoring.cs:38-61` (기즈모) |
| 지름길 엣지 | 노란 점선 (dash 0.25셀) | 같은 곳 |
| 노드 | 시작 흰색 · 탈출 금색 · 일반 회색 | 같은 곳 |

hex 는 `round(v*255)` 로 계산했다 (감마 변환 없음). Unity 컬러스페이스에 따라 화면 픽셀이 미묘하게 다를 수 있으나 "게임과 비슷하게" 에는 충분하다.

툴 전용 색 (게임에 없는 것)은 표에 넣지 않고 `palette.ts` 의 별도 섹션에 둔다: 선택 영역, 도달 가능 영역 하이라이트(마을별), 검증 마커(빨강/노랑), 브러시 프리뷰.

## 6. 파일 IO `[D-01-06]`

| 동작 | 1순위 | 폴백 | 왜 |
|---|---|---|---|
| 열기 | `showOpenFilePicker()` (File System Access API) | `<input type=file>` | FSAA 면 핸들을 쥐고 있어 **덮어쓰기 저장** 이 된다. 기획자 PC 는 Windows + Chrome/Edge 라 1순위가 거의 항상 된다 |
| 저장 | 쥐고 있는 핸들에 `write()` | Blob 다운로드 (`파일명.toon`) | 다운로드 폴백은 "다운로드 폴더에 사본이 쌓이는" 경험이라 2순위 |
| 다른 이름으로 | `showSaveFilePicker()` | Blob 다운로드 | |
| TOON 복사 | `navigator.clipboard.writeText` | 텍스트 영역 선택 | LLM 프롬프트 경로. **브라우저가 저장을 막는 최악의 환경에서도 이 경로는 남는다** |
| 초안 복구 | `localStorage` 에 5초 디바운스로 현재 문서 저장 | — | 브라우저 탭이 죽었을 때 복구용. **진실이 아니다** — 열 때 "복구할까요?" 만 묻는다 |

- `file://` 로 열린 페이지에서도 FSAA 는 동작한다 (사용자 제스처 필요). 정적 호스팅(ADR-E01)에서는 **HTTPS 가 보안 컨텍스트를 만들어** 같은 API 가 그대로 동작한다. 서버로 가는 요청은 HTML 한 번뿐이라 CORS 이슈가 없다.
- 파일 인코딩 UTF-8, 줄 끝 `\n`. 한글 표시 이름(`쉬움`)이 들어가므로 BOM 은 붙이지 않는다 (git diff 와 C# 파서 둘 다에 불필요).

## 7. 검증·시뮬 실행 시점 `[D-01-07]`

- **검증** 은 문서가 바뀔 때마다 돌린다 (100ms 디바운스). 규칙 전부 합쳐도 수백 칸 격자에서 1ms 대라 비용이 없다. 결과는 검증 패널 + 캔버스 마커로 즉시 보인다.
- **시뮬** 은 버튼으로만 돌린다. 판 하나가 게임 시간 100초+ 라 매 편집마다 돌릴 이유가 없고, 결과가 편집 도중에 계속 흔들리면 오히려 방해다.
- 도달 가능 영역(플러드필)은 검증의 일부다 (V-M06) — 상시 표시.

## 8. 에러 정책 `[D-01-08]`

- 파일 열기 실패(파싱 불가·스키마 불일치)는 **문서를 바꾸지 않고** 다이얼로그에 위치(행·열)와 이유를 보여 준다. 반쯤 읽힌 문서를 띄우지 않는다.
- 검증 실패는 저장을 막지 않는다 (ADR-E08). 임포터가 막는다.
- 예외는 최상위에서 잡아 "복구 가능한 초안이 있다" 는 안내와 함께 보여 준다. 조용히 삼키지 않는다.

## 9. 빌드 산출물 `[D-01-09]`

```
npm run dev      개발 서버 (HMR)
npm test         vitest (core 전부 + 헤더 게이트 + 골든 왕복)
npm run build    dist/pmf-editor.html  ← 기획자에게 주는 유일한 파일
npm run deploy   위 파일을 VPS 웹루트로 scp. 올린 뒤 URL 헤더까지 확인한다 (빌드는 하지 않는다)
```

**호스팅 규약 (ADR-E01):** Caddy 정적 사이트 블록 하나, 웹루트 `/var/www/pmf-editor` (www-data, 755/644), 파일은 `index.html` 하나. 백엔드 없음.
캐시 방지를 위해 HTML 에 `Cache-Control: no-cache` 헤더를 Caddy 에서 붙인다 — 기획자가 옛 버전을 붙들고 있지 않게.

**서브도메인: `pmf.manjac.co.kr`. 2026-09-06 배포 완료.** 서버는 만작 VPS 한 대를 공용으로 쓴다 (전역 메모리 `manjac_vps`).
DNS 는 A 가 아니라 **CNAME → `manjac.co.kr`** 이다 (`www` 와 같은 방식). `/etc/caddy/Caddyfile` 의 블록:

```caddyfile
pmf.manjac.co.kr {
	root * /var/www/pmf-editor
	encode zstd gzip
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		-X-Powered-By
		-Server
		# 왜 no-cache 인가: 기획자가 옛 버전을 붙들면 버그 재현이 안 된다.
		# 파일이 하나뿐이라 캐시로 아낄 것도 없다.
		Cache-Control "no-cache, must-revalidate"
	}
	handle /.well-known/* { file_server }
	handle { file_server }
}
```

`log` 지시어를 일부러 넣지 않았다 — 새 로그 파일을 만들면 `caddy validate` 를 root 로 돌렸을 때
`root:600` 으로 생겨 서비스가 기동 실패한다(전역 메모리에 기록된 함정). 접근 기록은 journald 에 남는다.

배포 절차: `npm run build` → `npm run deploy`. 스크립트가 scp 로 올린 뒤 **URL 헤더까지 스스로 확인**한다.

산출 HTML 은 **버전 문자열** (`package.json` version + 빌드 시각) 을 상단 바에 표시하고, 저장하는 `.toon` 첫 주석에도 넣는다.
기획자가 "어느 버전 툴로 만든 파일인지" 를 말할 수 있어야 문제를 재현할 수 있다.
