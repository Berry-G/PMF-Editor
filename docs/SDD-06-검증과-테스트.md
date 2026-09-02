# SDD-06. 검증과 테스트

- 버전 0.1 · 2026-09-03
- 원칙: **`core/` 는 전부 테스트로 덮인다. UI 는 손으로 본다.** 이 경계가 SDD-01 §2 계층 분리의 이유다.

---

## 1. 테스트 층 `[D-06-01]`

| 층 | 도구 | 무엇을 | 언제 |
|---|---|---|---|
| 코어 단위 | vitest | 코덱·검증·기하·시뮬·커맨드 | `npm test`, 매 커밋 |
| 골든 왕복 | vitest | 씨앗 파일 바이트 동일 | 매 커밋 |
| 게이트 | vitest | 헤더 주석 · `core/` DOM 무접촉 | 매 커밋 |
| 게임 EditMode | Unity Test Runner | 파서·검증기·임포터 (SDD-05 §11) | M5 부터 |
| 수동 | 사람 | 편집 UX · 기획자 왕복 | M2, M3, M6 |

E2E 브라우저 테스트(Playwright 등)는 두지 않는다. 캔버스 앱의 UI 회귀는 픽셀 비교가 되어야 의미가 있고, 그 비용이 지금 규모에 맞지 않는다. 대신 **UI 가 하는 일을 커맨드로 환원** 해 커맨드를 테스트한다.

## 2. 골든 파일과 회귀 `[D-06-02]`

| 테스트 | 기대 | 왜 |
|---|---|---|
| `decode(seed)` 가 성공하고 이슈 0 | `examples/Stage_Greybox.toon` | 씨앗이 유효하지 않으면 모든 게 흔들린다 |
| `encode(decode(seed)) === seed` (바이트) | 정규 출력 (SDD-02 §6-1) | git diff 가 실제 변경만 보이게. 게임 Exporter 와 같은 결과 |
| `decode(encode(doc)) deepEqual doc` | 임의 문서 (property test 몇 개) | 정보 손실 없음 |
| 셀 통계 | B 381 · R 51 · W 36 · ~ 10 · V 2 · . 0 · _ 96 | 씨앗 = 게임 `GreyboxMapData` 렌더 (조사 실측 2026-09-03) |
| 도달 영역 | 마을 (10,13)·(27,9) 둘 다 같은 구역. 도달 가능 `B` 203 (구역 205 = B 203 + V 2), 도달 불가 `B` 178 | 2026-09-03 씨앗으로 계산. 게임 주석 `GreyboxMapData.cs:30-32` 의 215 는 물 10칸 추가 전 값 |
| 시뮬 | 판 길이 119±3% · 총 스폰 56±2 · 수입 천장(Normal) 402±10 | SDD-04 §6 |
| 노드·엣지 수 | 16 / 18 (일반 17 + 지름길 1) | `GreyboxMapData.cs:68-115` |

기대값이 게임 실측에서 온 것이면 **출처와 날짜** 를 테스트 이름이나 주석에 남긴다. 게임이 바뀌면 여기부터 다시 잰다.

## 3. 공유 픽스처 — 규칙 ID 당 파일 하나 `[D-06-03]`

```
docs/fixtures/
  README.md            규약 (이 절의 요약)
  valid/
    Stage_Greybox.toon → ../examples/Stage_Greybox.toon 의 사본이 아니라 그 파일을 직접 읽는다
    minimal.toon       통과하는 가장 작은 문서 (8×8, 노드 2, 엣지 1)
  invalid/
    V-F01.toon  V-F02.toon  V-F03.toon
    V-M01.toon  …  V-M08.toon
    V-P01.toon  …  V-P09.toon
    V-S01.toon  …  V-S05.toon
    V-B01.toon  V-B02.toon  V-B03.toon
```

- **파일명 = 규칙 ID.** 파일은 `minimal.toon` 에서 **딱 하나만** 어긋나게 만든다. 테스트는 "이 파일이 정확히 이 ID 를, 그리고 다른 ❌ 는 내지 않는다" 를 확인한다.
- 툴(`core/validate.test.ts`)과 게임(`ValidatorFixtureTests.cs`)이 **같은 파일** 을 읽는다. 게임 쪽은 경로 상수 하나 (`../Prowl's Moving Factory Editor/docs/fixtures`, 상대경로; 없으면 테스트를 `Ignore` 로 표시하고 이유를 찍는다 — 조용히 통과시키지 않는다).
- 규칙을 추가·삭제하면 픽스처도 같이. SDD-02 §5 표의 ID 집합 == `invalid/` 파일명 집합 을 검사하는 테스트를 둔다 (표는 문서라 테스트가 못 읽으므로, `core/validate/rules.ts` 의 ID 목록과 대조).
- V-S01 은 툴에서 ⚠️, 임포터에서 ❌ 다. 픽스처 하나로 두 테스트가 각자 기대 심각도를 본다.

## 4. 게이트 테스트 `[D-06-04]`

| 게이트 | 검사 | 왜 |
|---|---|---|
| `header-gate.test.ts` | `src/**/*.ts` 첫 주석 블록에 `목적:` `왜 이 구조인가:` `바꾸면 안 되는 것:` `근거:` 4줄이 있고, `근거:` 에 `SDD-0\d` 또는 `ADR-E\d\d` 가 하나 이상 | SDD-00 §6. 주석을 문화가 아니라 게이트로 |
| `core-purity.test.ts` | `src/core/**` 에 `document`·`window`·`navigator`·`localStorage`·`fetch`·`import … from '../ui` 문자열 없음 | SDD-01 §2 계층 분리 |
| `palette-source.test.ts` | `core/palette.ts` 의 각 색 상수 옆 줄에 `출처:` 주석 | ADR-E09 |
| `schema-version.test.ts` | `SCHEMA` 상수와 씨앗·픽스처의 `schema:` 줄이 같다 | 버전 올릴 때 하나라도 빠뜨리면 즉시 |

## 5. 커맨드 테스트 `[D-06-05]`

각 커맨드에 대해 `undo(do(doc)) deepEqual doc` 과 `do(undo(do(doc))) deepEqual do(doc)`. 코얼레싱은 "스트로크 3번 합친 것을 undo 하면 한 번에 원상" 을 확인한다.
`RenameNode` 는 엣지·트리거 참조가 같이 바뀌는지, `DeleteNode` 는 붙은 엣지·트리거가 지워지고 undo 로 돌아오는지.

## 6. 수동 수용 조건 `[D-06-06]`

| 단계 | 조건 |
|---|---|
| M2 | 씨앗을 열어 벽 한 덩어리를 옮기고, Ctrl+Z 로 되돌리고, 저장 → 다시 열면 그대로. 미니맵 클릭으로 이동. 60fps 유지 (DevTools) |
| M3 | 노드를 추가·연결·지름길 지정·트리거 지정하고 검증 패널에 오류 0. 스폰 표에 적을 추가하고 파생값(마리/초)이 즉시 바뀐다 |
| M4 | 씨앗으로 시뮬 → 요약 카드가 §2 기대와 맞다. 지름길 개방 시각을 바꾸면 판 길이가 줄어든다 |
| M5 | 툴에서 만든 `.toon` 을 임포트 → 씬 재생성 → 플레이에서 바꾼 벽·경로·스폰이 보인다. `git status` 에 `Data/Stages` 3개와 씬만 |
| M6 | **기획자가 설명서 없이** 씨앗을 열어 스테이지 하나를 수정해 돌려준다. 에러 메시지를 읽고 스스로 고친다. 막힌 지점을 전부 기록 → SDD-03 개정 |

## 7. 실행 `[D-06-07]`

```
npm test                 vitest 전체 (수 초)
npm run test:watch       개발 중
npm run build && npm run check:size    dist/pmf-editor.html 이 1MB 이하인지 (의존성 0 을 지키고 있다는 간접 증거)
```

게임 쪽: `unity command run_tests --mode EditMode --no-banner` (게임 `CLAUDE.md` §5).
