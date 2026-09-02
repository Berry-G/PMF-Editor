# CLAUDE.md — PMF Editor

이 파일은 **모든 세션에서 자동으로 읽히는 강제 규칙**이다. 충돌하는 판단을 하지 마라. 충돌하면 멈추고 물어라.

## 0. 이것이 무엇인가 (한 문장)

> **`Prowl's Moving Factory` 의 맵·경로·스폰·밸런스를 기획자가 Unity 없이 브라우저에서 그리고 `.toon` 하나로 넘기는 툴.**

대상 게임: `G:\Project\Prowl's Moving Factory` (Unity 6000.5.7f1). **게임 코드가 진실이고 이 툴은 사본이다** (SDD-00 §9).
현재 상태: **설계 확정, 구현 0** (2026-09-03). 착수는 `docs/SDD-07-로드맵.md` M0 부터.

## 1. 환경

| 항목 | 값 |
|---|---|
| 언어 | TypeScript strict |
| 빌드 | Vite + `vite-plugin-singlefile` → **`dist/pmf-editor.html` 파일 하나** |
| 테스트 | vitest (`npm test`) |
| 런타임 의존성 | **0.** 라이브러리를 넣으려면 물어라 |
| Node | 24 (개발 PC). 기획자 PC 에는 아무것도 필요 없다 |
| 포맷 | TOON v4.1 부분집합, 스키마 `pmf.stage/1` (`docs/SDD-02-데이터모델.md`) |

## 2. 확정된 설계 결정 (뒤집지 마라 — 근거는 `docs/adr/`)

1. **단일 HTML 산출.** 웹 배포·설치형 아님 → ADR-E01
2. **TOON 이 저장 포맷.** 인코더는 주석을 낸다(의도적 사양 편차) → ADR-E02
3. **`core/` 는 DOM 을 모른다.** 의존은 `ui→core`, `io→core` 만 → ADR-E03
4. **문서는 커맨드로만 바뀐다.** 스트로크당 커맨드 하나 → ADR-E04
5. **마을은 `V` 셀, 시작·탈출은 노드 role. `objects` 섹션 없음** → ADR-E05
6. **노드 id 는 툴이 재번호하지 않는다.** rename 은 참조 갱신 포함 → ADR-E06
7. **시뮬은 천장(판 길이·스폰·수입)만 계산한다. 전투·승패 없음** → ADR-E07
8. **검증 실패해도 저장은 된다. 임포트만 거부** → ADR-E08
9. **색·수식은 게임 코드에서 복사하고 출처를 주석으로** → ADR-E09

## 3. 코드 규칙

- **헤더 주석 4항목 필수** (`목적 / 왜 이 구조인가 / 바꾸면 안 되는 것 / 근거: SDD-0x §n, ADR-E0n`). 테스트가 검사한다 (`header-gate.test.ts`). SDD-00 §6.
- 비자명한 줄은 `// 왜:`. 게임에서 옮긴 값은 `// 출처: 파일:라인`. 사양 편차는 `// 편차:`.
- 팔레트 값(`src/core/palette.ts`)을 **손으로 고치지 마라.** 게임 `SceneParts.cs` / `GreyboxFactory.cs` 에서 복사하고 출처 라인을 갱신하라.
- 스키마를 바꾸면: `SCHEMA` 버전 ↑ → `docs/SDD-02` §4·§5 → 씨앗 재생성 → 픽스처 → ADR 한 장. 하나라도 빠지면 `schema-version.test.ts` 가 잡는다.
- 검증 규칙을 추가하면 `docs/fixtures/invalid/<ID>.toon` 도 같은 커밋에.
- 좌표 변환은 `ui/canvas/view.ts` 한 곳. 행↔y 변환은 `core/toon` 한 곳.
- 커맨드 밖에서 `doc` 을 바꾸지 마라. in-place 변경 금지.

## 4. 작업 방식

- 한 번에 마일스톤 하나 (`docs/SDD-07-로드맵.md`). DoD 를 먼저 읽어라.
- **M4 까지 게임 프로젝트를 건드리지 않는다.** M5 에서 건드릴 때는 게임 `CLAUDE.md` 를 따른다 (Unity CLI 로 컴파일·테스트 확인, `.meta`·씬 YAML 손대지 않기).
- 테스트를 돌리지 않았으면 "통과" 라고 쓰지 마라.
- 결정을 내렸으면 `docs/adr/ADR-E<nn>.md` 한 장. 짧게.
- Serena: 세션 시작 시 `activate_project` → `list_memories`. 프로젝트 지식은 Serena 메모리에 (`.serena/memories/`).

## 5. 문서 지도

| 파일 | 내용 |
|---|---|
| `docs/SDD-00-개요.md` | 목표·비목표·스타크래프트 대응표·**주석 규약**·용어·진실의 위치 |
| `docs/SDD-01-아키텍처.md` | 계층·커맨드/Undo·렌더·팔레트 출처·파일 IO |
| `docs/SDD-02-데이터모델.md` | **계약.** `StageDocument`·TOON 스키마·SO 31필드 대응·검증 규칙표 |
| `docs/SDD-03-편집UX.md` | 화면·도구·레이어·오브젝트 계층·단축키 |
| `docs/SDD-04-시뮬레이션.md` | 무엇을 계산하고 무엇을 안 하는가·게임 수식·검증 기준 |
| `docs/SDD-05-Unity임포터.md` | 게임 쪽 파서·검증·임포터·익스포터·씬 빌더 연결 |
| `docs/SDD-06-검증과-테스트.md` | 골든·픽스처·게이트·수용 조건 |
| `docs/SDD-07-로드맵.md` | M0~M6 |
| `docs/adr/` | 결정과 이유 |
| `docs/examples/Stage_Greybox.toon` | 씨앗 = 골든 파일 |
| `docs/fixtures/` | 검증 픽스처 (툴·임포터 공용) |

게임 쪽 정본: 게임 `CLAUDE.md`, `.docs/GDD.md`, `.docs/ARCHITECTURE.md`, `.docs/adr/`, `.docs/PLAN-authoring-pipeline.md`(1차 계획 — 설계 정본은 이제 여기 SDD).
