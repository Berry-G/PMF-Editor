# SDD-04. 시뮬레이션 미리보기 — 판의 뼈대만 계산한다

- 버전 0.1 · 2026-09-03
- 관련 ADR: E07(전투·승패를 계산하지 않는다)
- 위치: `core/sim/` (순수 TS) + `ui/panels/sim/` (타임라인·재생)

---

## 1. 무엇을 계산하고 무엇을 계산하지 않는가 `[D-04-01]`

게임 프로젝트는 2026-09-02 에 자동 플레이 시뮬로 밸런스를 판정하려다 **세 번 틀렸다** (게임 메모리 `balance_measurement_harness`).
그 결론이 이 문서의 출발점이다:

| 자동 계측을 믿어도 되는 것 | 믿으면 안 되는 것 |
|---|---|
| 판 길이 · 총 스폰 수 · **총수입 상한** (= 시작 자원 + 처치 보상 × 전부 잡았을 때) | **승패** |
| 모체–보호대상 거리 곡선 · 버스트 창 · 스폰 시각 | 병종 우열 · "이 값이면 할 만하다" |

**툴의 시뮬은 왼쪽만 계산한다.** 아군을 배치하지도, 적을 죽이지도, 보호대상 체력을 깎지도 않는다.
전투를 넣으면 "이 배치로는 이긴다" 는 한 가지 사실만 나오고, 그것이 밸런스 판단으로 오독된다. 오른쪽은 사람이 플레이해서 판정한다.

이 제약 덕분에 시뮬은 **결정론적이고 빠르다** — 판 하나(≈120초 게임 시간)가 밀리초 단위에 끝난다.

## 2. 결정론 `[D-04-02]`

- 고정 스텝 `dt = 1/30 s`. 게임은 가변 프레임이지만 시뮬은 모델이다. 같은 입력 → 같은 출력이어야 회귀 테스트가 된다.
- 난수는 **시드 있는 PRNG** (mulberry32, 32-bit). 시드는 UI 에서 바꾼다 (기본 1). 스폰 표 추첨에만 쓴다 — 게임 `MotherSpawner.PickFromSpawnTable` (`:401-430`) 과 같은 방식: 가중치 합 → `[0,total)` 난수 → 누적 차감.
- 게임과 **수식을 같게** 한다. 각 수식 옆에 출처 라인을 주석으로 단다 (§3). 게임 수식이 바뀌면 여기가 낡는다 — 그 방향은 받아들인다 (SDD-00 §9).

## 3. 모델 `[D-04-03]`

### 3-1. 그래프

- 노드 위치 = 셀 중심 `origin + (x+0.5, y+0.5)`. 엣지 비용 = 두 노드 중심 사이 **유클리드 거리** (`PathEdge.cs:28` `Vector3.Distance`).
- 통행 = `(allowed & agent) != 0 && (!shortcut || opened)` (`PathEdge.cs:35`). 양방향 엣지는 역방향을 만들어 둔다.
- 최단 경로 = 다익스트라. 노드 수십 개라 비용 없음. **재계산은 이벤트 때만** (GDD §6 — 매 프레임 재계산 금지를 시뮬도 따른다).

### 3-2. 보호대상 (`Escortee`)

- 시작 = `start` 노드. 목표 = 첫 번째 `exit` 노드 (`Escortee.cs:63` `ExitNodes[0]`).
- 경로 = Escortee 에이전트 기준 최단. 속도 `escortee.speed` (셀/초). 폴리라인을 따라 이동, 노드를 지날 때 `EscorteeReachedNode(id)` 이벤트.
- 지름길: UI 파라미터 `지름길 개방 시각` (초, 기본 "열지 않음"). 그 시각에 모든 지름길을 열고 경로를 재계산한다 (GDD §11 "열리면 즉시 재계산"). 어느 지름길을 언제 열지는 플레이어 판단이라 시뮬이 정하지 않는다.
- 도착 = 판 종료. 그 시각이 **판 길이 T**.

### 3-3. 모체 (`Mother`)

상태기계 `Idle → Chasing → Burst → Chasing` (`MotherSpawner.cs:14`).

| 상태 | 규칙 | 출처 |
|---|---|---|
| Idle | `mother.spawnDelay` 초 동안 `start` 셀에 정지. **스폰 없음 (가정 — M4 착수 시 `MotherSpawner.cs` 로 확인)** | `:107-127` |
| Chasing | 목표 = Enemy 에이전트 기준 **보호대상에 가장 가까운 노드** (`PathGraph.FindNearestNode(escortee, Enemy)`), 다익스트라로 이동. 재계산은 `EscorteeReachedNode` 때만. 속도 `mother.speed` (× `recoverySpeedMultiplier`, 회복 타이머 동안) | `:257-278`, `:161` |
| Burst | 보호대상이 `burst.triggerNodeIds` 의 노드를 **처음** 지나면 진입. 이동 정지. `burst.duration` 초 뒤 종료 | `:167`, `:248-253` |
| `followsPath=false` | 그래프 무시, 보호대상 쪽 직진 (D-06 실험) | `:298-304` |

버스트 종료 시 **총량 보존** (`ExitBurst`, `:197-223`):
```
expected = NormalSpawnRate × duration
debt     = max(0, burstSpawned − expected)
payback  = min(debt / NormalSpawnRate, duration × 2)
restTimer     = max(spawn.restSeconds, payback)
recoveryTimer = burst.recoverySeconds      // 이 동안 속도 × recoverySpeedMultiplier
```

### 3-4. 스폰 리듬 (`UpdateSpawnRhythm`, `:313-366`)

```
[Rest]   restTimer −= dt.  0 이 되면 → [Volley]
[Volley] volleyRemaining = volleyCount 마리를 volleySpacing 간격으로 방출. 끝나면 restTimer = restSeconds → [Rest]
```
- 평시 파라미터 = `spawn.*`, 버스트 중 = `burst.volleyCount / burst.restSeconds`.
- 예고(`telegraphSeconds`)는 휴지 안에 포함되므로 타이밍에 영향 없음 — 시뮬은 표시만 한다.
- 파생값 (`StageDefinition.cs:94-100`): `SpawnCycleSeconds = (volleyCount−1)×volleySpacing + restSeconds`, `NormalSpawnRate = volleyCount / SpawnCycleSeconds`. 스폰 탭이 같은 식을 즉시 보여 준다 (SDD-03 §6).

### 3-5. 적 마커 (`Enemy`)

- 스폰 위치 = 모체 현재 위치. 종류 = 스폰 표 추첨. 이동 속도 = **카탈로그** 의 `moveSpeed` (파일에 없다 — `EnemyDefinition` 값. 툴 내장 카탈로그 기본값 Walker 0.7 / Scout 1.19, 스폰 탭에서 수정 가능. 출처 `Robot_*.asset`).
- 경로 = Enemy 에이전트 기준, 보호대상의 현재 노드까지 최단. 보호대상이 노드를 지나면 재계산.
- 보호대상에 닿으면 **"접촉"** 으로 기록하고 사라진다. 피해·전투 없음. 접촉 시각 분포가 "언제 압박이 오는가" 를 보여 준다.

## 4. 출력 `[D-04-04]`

```ts
interface SimResult {
  seed: number; dt: number;
  stageSeconds: number;                 // 판 길이 T
  totalSpawned: number;                 // 종류별 포함
  spawnedByEnemy: Record<string, number>;
  incomeCeiling: Record<Difficulty, number>;  // start + killReward × totalSpawned + resourcePerSecond × T
  bursts: { triggerId: string; start: number; end: number; spawned: number; payback: number }[];
  samples: { t: number; escortee: XY; mother: XY; distance: number; alive: number }[];   // 매 스텝 or 0.5초 간격
  spawnEvents: { t: number; enemy: string; at: XY }[];
  contacts: { t: number; enemy: string }[];
  warnings: string[];                   // 예: "모체가 보호대상에 닿았다 (t=…)" — V-B01 이 막지만 followsPath=false 실험용
}
```

수입 천장 식은 게임 메모리 `difficulty_and_economy` 의 실측 정의와 같다: *보호대상 무적 + 스폰되는 적 전부 즉사* = 시작 + 처치 보상 × 총 스폰 (+ 시간 수입 × T, Easy 만 0 이 아니다).

## 5. UI `[D-04-05]`

- 상단 바 `시뮬 ▶` / `Ctrl+Enter` → 실행 → 시뮬 레이어 켜짐 + 하단에 시뮬 패널.
- **요약 카드**: 판 길이 · 총 스폰(종류별) · 수입 천장(난이도별) · 버스트 N회(각 스폰 수·paybacked 초).
- **타임라인 그래프** (캔버스 직접 그림): x=시간. 선 1 = 모체–보호대상 거리, 막대 = 스폰 시각(종류 색), 띠 = 버스트 창·회복 창, 점 = 접촉.
- **재생**: 스크러버 + 재생/일시정지 + 1×/4×/16×. 캔버스에 보호대상(하트)·모체(사각)·적(원) 위치와 지나온 궤적. 색은 게임 팔레트.
- 파라미터: 시드, 지름길 개방 시각, (카탈로그) 적 속도. 문서를 바꾸지 않는다 — `localStorage`.
- 문서가 바뀌면 결과에 "낡음" 표시. 자동 재실행은 하지 않는다 (SDD-01 §7).

## 6. 검증 기준 `[D-04-06]`

씨앗 `Stage_Greybox.toon` 으로 돌렸을 때 게임 실측(2026-09-02, 스폰 묶음 4)과 맞아야 한다:

| 지표 | 게임 실측 | 허용 오차 | 근거 |
|---|---|---|---|
| 판 길이 | 119초 | ±3% | 경로 길이 / 0.42. 결정론이라 거의 정확해야 한다 |
| 총 스폰 | 56기 | ±2기 | 스폰 리듬 + 버스트 2회 + 총량 보존 |
| 수입 천장 (Normal) | 402 | ±10 | 150 + 4.5×56 = 402 |
| Idle 가정 (§3-3) | ✅ 확인됨 | — | A1·A2 는 `MotherSpawner.cs:231-240` 과 일치 (2026-09-04) |

> 🔴 **미해결 (2026-09-04).** 현재 구현 실측은 **119.07 / 52기 / 384** 다. 판 길이는 맞고 스폰이 4기 모자라다.
> `enterBurst`(§7-5)·묶음 종료 규칙을 게임과 맞춘 뒤에도 남는 차이라, 원인은 경로 재계산 또는 최근접 노드 쪽으로 좁혀진다.
> **허용 범위를 넓혀 통과시키지 마라** — 이 표가 무의미해진다.

이 세 값은 **회귀 테스트** 로 고정한다 (SDD-06 §2). 게임 수식이 바뀌어 실측이 움직이면 기대값과 출처 날짜를 같이 갱신한다.

## 7. 도달 가능 영역 (시뮬이 아니라 검증이지만 같은 기하) `[D-04-07]`

- 마을 셀에서 `{Ground, Buildable, VillageSlot}` 만 밟는 **4-연결 플러드필**. `Road`·`Blocked`·`Water`·`Empty` 는 벽.
- 왜 도로가 벽인가: 아군은 도로를 밟지 않는다 (`GridSystem.cs` 헤더 주석, `AllyUnit.CanReach`). 현재 맵이 도로로 2구역(마을 쪽 205칸 / 건너편 178칸 — 게임 주석 `GreyboxMapData.cs:30-32` 의 215 는 물 10칸을 넣기 전 값)으로 갈리는 게 바로 이 규칙 때문이다.
- 왜 4-연결인가: 게임 아군은 가시성 그래프(`AllyWalkGraph.cs`)로 걷지만 대각선으로 도로를 "건너뛰지" 는 않는다. 4-연결이 보수적이고, M4 에서 `AllyUnit.CanReach` 와 씨앗 맵으로 대조한다 (SDD-06 §2).
- 결과는 마을별 집합. V-M06/V-M07 과 레이어 표시가 이걸 쓴다.
