# SDD-02. 데이터 모델 — `StageDocument` 와 TOON 스키마 `pmf.stage/1`

- 버전 0.1 · 2026-09-03
- **이 문서는 계약이다.** 툴(TS)·임포터(C#)·기획자 파일 셋이 이 문서 하나를 본다. 바꾸면 `schema` 버전을 올린다 (§7).
- 관련 ADR: E02(TOON), E05(마을=셀·시작/탈출=노드), E06(노드 id 불변), E08(검증 실패 시 저장)
- 씨앗 = `examples/Stage_Greybox.toon`. 이 문서의 모든 예시는 그 파일과 일치한다.

---

## 1. 문서 모델 `StageDocument` `[D-02-01]`

`core/model/stage.ts`. 파일과 1:1 이다. UI 상태(선택·줌·도구)는 여기 **없다** — 파일에 들어가면 안 되는 것은 문서에도 없어야 저장이 단순해진다.

```ts
export const SCHEMA = 'pmf.stage/1' as const;

/** 게임 CellType 과 숫자가 같다 (CellType.cs:12-20). 값 바꾸지 말 것 — 임포터가 byte 로 그대로 넘긴다. */
export enum Cell { Blocked = 0, Ground = 1, Road = 2, Buildable = 3, VillageSlot = 4, Water = 5, Empty = 255 }

export interface MapData {
  width: number;             // 8..256
  height: number;            // 8..256
  origin: [number, number];  // 셀 (0,0) 의 좌하단 월드 좌표. 게임 GridSystem._origin 과 동일 의미
  cells: Uint8Array;         // 길이 width*height. index = y*width + x. y=0 이 아래. 값은 Cell
}

export type NodeRole = 'start' | 'exit' | 'branch' | 'waypoint';
export interface PathNode { id: string; x: number; y: number; role: NodeRole }

export type Agent = 'Escortee' | 'Enemy' | 'Ally';
export interface PathEdge {
  from: string; to: string;
  allowed: ReadonlyArray<Agent>;   // 비면 안 됨. 파일에서는 'All' 또는 'Escortee+Ally' 로 적힘
  bidirectional: boolean;
  shortcut: boolean;
}
export interface PathData { nodes: PathNode[]; edges: PathEdge[] }

export interface SpawnEntry { enemy: string; weight: number }
export interface CurveKey  { t: number; mul: number }
export interface SpawnData {
  volleyCount: number; volleySpacing: number; restSeconds: number; telegraphSeconds: number;
  table: SpawnEntry[]; healthByProgress: CurveKey[];
}
export interface BurstData {
  triggerNodeIds: string[]; duration: number; volleyCount: number; restSeconds: number;
  recoverySpeedMultiplier: number; recoverySeconds: number;
}
export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export interface DifficultyTier { difficulty: Difficulty; displayName: string; killReward: number; resourcePerSecond: number }
export interface EconomyData { startingResource: number; shortcutCost: number; difficulties: DifficultyTier[] }
export interface EscorteeData { speed: number; maxHealth: number }
export interface MotherData   { speed: number; spawnDelay: number; followsPath: boolean }
export interface PresentationData {
  uiSlowMotionScale: number; shotLineSeconds: number; magicMissileSpeed: number;
  hitFlashSeconds: number; debrisCount: number; debrisSeconds: number; healthBarHideWhenFull: boolean; masterVolume: number;
}
export interface ToggleData { alliesCanDieWhileMarching: boolean; enemiesTargetAllies: boolean }

export interface StageDocument {
  schema: typeof SCHEMA;
  name: string;
  map: MapData; path: PathData; spawn: SpawnData; burst: BurstData; economy: EconomyData;
  escortee: EscorteeData; mother: MotherData; presentation: PresentationData; toggles: ToggleData;
}
```

**왜 `cells` 가 `Uint8Array` 인가:** 값이 게임 `CellType` 과 같은 숫자라 임포터가 변환 없이 `MapDefinition.cells(byte[])` 에 넣는다.
복사가 싸서 커맨드가 새 문서를 돌려주는 설계(SDD-01 §3)와 맞는다. `Empty=255` 는 게임에 없는 값이지만 "타일 없음" 을 잃지 않기 위해 둔다 (§2-2).

## 2. 맵 `[D-02-02]`

### 2-1. 좌표계 — 게임과 동일

- 셀 (0,0) 은 **좌하단**. x 오른쪽, y 위. 출처 `GridSystem.cs:11-14`, GDD §5.
- `origin` 은 셀 (0,0) 의 **좌하단 모서리** 월드 좌표 (중심 아님). 셀 중심 = `origin + (x+0.5, y+0.5)`. 출처 `GridSystem.cs:120`.
- 파일의 `rows` 는 **맨 위 행이 `y = height-1`** 이다 — 사람이 파일을 열면 화면과 같은 그림이 보여야 한다. 행 `r` ↔ `y = height-1-r`. 이 변환은 `core/toon` 안에서만 한다.

### 2-2. 셀 문자 `[D-02-03]`

| 문자 | `Cell` | 게임 | 왜 이 문자 |
|---|---|---|---|
| `_` | `Empty` (255) | 타일 없음 → 런타임 `Blocked` (`GridSystem.cs:76`), 화면엔 배경색 | 씨앗 맵의 테두리 96칸이 이것이다. `W` 로 뭉개면 왕복이 안 맞고 화면도 달라진다 (Blocked 타일은 배경보다 살짝 밝다) |
| `.` | `Ground` (1) | 통행 가능·배치 불가 | 현재 맵엔 0칸이지만 게임 enum 에 있으니 팔레트에 둔다 |
| `R` | `Road` (2) | 적·보호대상 통로. **아군은 밟지 않는다** | |
| `B` | `Buildable` (3) | 아군 배치 가능한 유일한 칸 | |
| `V` | `VillageSlot` (4) | 마을. 배치 불가 (`IsBuildable` 이 false) | ADR-E05 — 마을은 이 셀 자체다 |
| `W` | `Blocked` (0) | 벽. 이동·사거리 차단 | **`#` 는 금지.** TOON 이 `#` 로 시작하는 줄을 주석으로 지운다 |
| `~` | `Water` (5) | 이동 불가, **원거리는 관통** (ADR-0017) | |

문자 선택 규칙: TOON 의 인용 강제 조건(`#`·`-` 로 시작, `:` `"` `\` `[` `]` `{` `}` 포함, 공백 시작/끝, `true/false/null`, 숫자 패턴)에 걸리지 않을 것. 7개 전부 통과한다. 문자를 추가할 때도 같은 조건을 검사한다.

## 3. 경로 `[D-02-04]`

### 3-1. 노드

| 필드 | 규칙 | 왜 |
|---|---|---|
| `id` | `^[A-Za-z_][A-Za-z0-9_]*$`, 문서 안에서 유일 | 게임의 GameObject 이름이 된다. `burst.triggerNodeIds` 가 **이 문자열로 정확 일치** 매칭한다 (`MotherSpawner.cs:142` `PathGraph.FindByName`). 툴은 **절대 재번호하지 않는다** — ADR-E06 |
| `x`,`y` | 셀 좌표. 게임이 셀 중심으로 스냅한다 (`PathNode.WorldPosition`) | 소수 좌표는 의미가 없으므로 정수만 |
| `role` | `start` 정확히 1개 · `exit` 1개 이상(게임은 첫 번째만 씀) · `branch` · `waypoint` | PLAN 초안의 `-` 는 TOON 이 인용을 요구해 폐기. `branch` 는 도로 밖에 있어도 되는 노드 (씨앗의 `B01_branch`, `B02_branch`). **의도는 아군 행군용이었지만 게임에서 실제로 쓰이지 않는다** — 2026-09-06 확인, 아래 참조 |

> **`branch` 노드는 현재 죽은 데이터다 (2026-09-06 조사).**
> 게임에서 `PathAgent.Ally` 를 쓰는 곳은 `Village.cs:46` 의 `FindNearestNode(pos, PathAgent.Ally)` 하나뿐이고,
> 그 결과인 `Village.DepartureNode` 를 **읽는 코드가 없다.** 아군은 `PathGraph` 를 아예 쓰지 않는다 —
> `AllyUnit` 은 `AllyWalkGraph.TryFindPath`(장애물 모서리 가시성 그래프)로만 걷는다 (`AllyUnit.cs:364,407`).
>
> 그래서 씨앗의 `B01_branch(12,8)` `B02_branch(20,10)` 이 지금 하는 일은:
> - `allowed=All` 이라 그래프에 남아 `N04–N05`, `N08–N09` 와 **삼각형(우회로)** 을 만든다.
>   비용은 거리 자동 계산이라 우회가 더 길다 → 다익스트라가 고르지 않는다.
> - 게임 테스트 `PathGraphTests.Branch_CheaperSideChosen` 의 픽스처.
>
> **역할(`branch`) 자체는 스키마에 남긴다** — 게임 `PathNodeRole` 에 `Branch = 3` 이 있고(SDD-05 §5),
> 아군 행군을 그래프로 옮기는 기획이 살아나면 쓰인다. 다만 **씨앗에 두 개가 꼭 있어야 할 이유는 없다.**
> 지울지는 게임 쪽 결정이다(씬·테스트가 딸려 온다).

보호대상 시작 위치 = `start` 노드 셀. 모체 시작 위치 = **같은 셀** (`GreyboxMapData.cs:62-66` — "추격자는 같은 곳에서 출발해야 뒤쫓는 그림이 된다"). 별도 필드를 두지 않는다 (ADR-E05).

### 3-2. 엣지

| 필드 | 규칙 |
|---|---|
| `from`,`to` | 존재하는 노드 id |
| `allowed` | `All` 또는 `Escortee`/`Enemy`/`Ally` 를 `+` 로 결합 (예 `Escortee+Ally`). 게임 `PathAgent` 비트플래그 `{Escortee=1, Enemy=2, Ally=4, All=7}` 로 변환 (`PathAgent.cs:6-14`) |
| `bidirectional` | `true` 면 **파일엔 한 번만** 적는다. 게임이 역방향을 만든다. 양쪽 다 적으면 게임이 중복 경고를 낸다 (`PathGraph.cs:101-102`) → V-P08 |
| `shortcut` | `true` 면 `allowed` 는 반드시 `Escortee` (ADR-0004: 적이 지름길을 지나가면 안 된다) → V-P04. 툴 UI 는 이 조합을 애초에 못 만들게 한다 |
| `cost` | **없다.** 게임이 월드 거리로 자동 계산한다 (`PathEdge.cs:28`). 입력란을 만들면 안 된다 |

### 3-3. 코너 규칙 (검증 V-P03 의 근거)

`GreyboxMapData.cs:86-89`: "코너 노드는 반드시 도로가 꺾이는 셀에 정확히 놓아야 한다. 한 칸이라도 어긋나면 이웃 노드와의 직선 구간이 대각선이 되어 코너를 가로지른다."
→ 일반 엣지(비지름길, 양 끝이 `branch` 가 아님)는 **가로 또는 세로(축 정렬)** 여야 하고, **두 끝 사이(끝 포함) 모든 셀이 `R`** 이어야 한다. 대각선 엣지는 그 자체로 위반이다 — 코너에 노드를 놓으면 두 축 정렬 엣지가 된다. 이 한 규칙이 "코너 어긋남" 과 "도로 밖 엣지" 를 둘 다 잡는다.
(초안은 Bresenham 직선 검사였다. 축 정렬로 바꾼 이유: Bresenham 은 방향에 따라 결과가 달라 두 구현(TS·C#)이 어긋날 수 있고, 게임 도로는 어차피 축 정렬 세그먼트로만 그려진다.)

### 3-4. 버스트 트리거

`burst.triggerNodeIds` 는 노드 id 목록. 보호대상이 그 노드를 통과하면 진입, 같은 트리거로 재진입 없음 (`MotherSpawner.cs:167`). 스타크래프트 Locations 의 자리다 — 영역이 아니라 노드라서 별도 도형이 없다.

## 4. 수치 필드 ↔ `StageDefinition` 대응표 `[D-02-05]`

게임 `StageDefinition.cs` 의 `[SerializeField]` **31개 전부** 를 다룬다. 이름은 `_camelCase` 에서 `_` 를 뗀 것이고, 섹션은 인스펙터 헤더 순서를 따른다.
"실측" 은 `Stage_Greybox.asset` 2026-09-02 값이고 씨앗 파일과 같다.

| # | SO 필드 | TOON 경로 | 타입 | 실측 | 검증 |
|---|---|---|---|---|---|
| 1 | `_escorteeSpeed` | `escortee.speed` | float | 0.42 | > 0 (V-S03) |
| 2 | `_escorteeMaxHealth` | `escortee.maxHealth` | float | 100 | > 0 |
| 3 | `_motherSpeed` | `mother.speed` | float | 0.28 | > 0, **< escortee.speed** (V-B01) |
| 4 | `_motherSpawnDelay` | `mother.spawnDelay` | float | 5 | ≥ 0 |
| 5 | `_spawnVolleyCount` | `spawn.volleyCount` | int | 4 | ≥ 1 |
| 6 | `_spawnVolleySpacing` | `spawn.volleySpacing` | float | 0.4 | ≥ 0 |
| 7 | `_spawnRestSeconds` | `spawn.restSeconds` | float | 8.2 | > 0 (사이클 0 방지) |
| 8 | `_spawnTable` | `spawn.table[N]{enemy,weight}` | 표 | Walker 70 / Scout 30 | V-S01, V-S02 |
| 9 | `_enemyHealthByProgress` | `spawn.healthByProgress[N]{t,mul}` | 표 | (0,1),(1,1) | V-S05 |
| 10 | `_motherFollowsPath` | `mother.followsPath` | bool | true | — |
| 11 | `_burstTriggerNodeIds` | `burst.triggerNodeIds[N]` | string[] | N06,N10 | V-P01, V-P06 |
| 12 | `_burstDuration` | `burst.duration` | float | 10 | ≥ 0 |
| 13 | `_burstVolleyCount` | `burst.volleyCount` | int | 6 | ≥ 1, > spawn.volleyCount 권장 (V-B03) |
| 14 | `_burstRestSeconds` | `burst.restSeconds` | float | 2.5 | ≥ 0 |
| 15 | `_burstRecoverySpeedMultiplier` | `burst.recoverySpeedMultiplier` | float | 1.6 | ≥ 1 |
| 16 | `_burstRecoverySeconds` | `burst.recoverySeconds` | float | 4 | ≥ 0 |
| 17 | `_startingResource` | `economy.startingResource` | int | 150 | ≥ 0 |
| 18 | `_resourcePerSecond` | **(없음)** | float | 8 | 난이도 표가 비었을 때의 폴백 (`StageDefinition.cs:52`). V-S04 가 난이도 3종을 강제하므로 도달 불가 코드. 임포터는 **건드리지 않는다** |
| 19 | `_shortcutCost` | `economy.shortcutCost` | int | 120 | ≥ 0 |
| 20 | `_difficulties` | `economy.difficulties[3]{difficulty,displayName,killReward,resourcePerSecond}` | 표 | 쉬움 4.5/3 · 보통 4.5/0 · 어려움 3/0 | V-S04 |
| 21 | `_uiSlowMotionScale` | `presentation.uiSlowMotionScale` | float | 0.1 | 0 < x ≤ 1 (`GameClock` 이 거부) |
| 22 | `_shotLineSeconds` | `presentation.shotLineSeconds` | float | 0.07 | ≥ 0 |
| 23 | `_magicMissileSpeed` | `presentation.magicMissileSpeed` | float | 8 | ≥ 0.1 |
| 24 | `_hitFlashSeconds` | `presentation.hitFlashSeconds` | float | 0.08 | ≥ 0 |
| 25 | `_debrisCount` | `presentation.debrisCount` | int | 5 | ≥ 0 |
| 26 | `_debrisSeconds` | `presentation.debrisSeconds` | float | 0.35 | ≥ 0 |
| 27 | `_healthBarHideWhenFull` | `presentation.healthBarHideWhenFull` | bool | true | — |
| 28 | `_spawnTelegraphSeconds` | `spawn.telegraphSeconds` | float | 0.6 | ≥ 0 |
| 29 | `_masterVolume` | `presentation.masterVolume` | float | 1 | 0..1 |
| 30 | `_alliesCanDieWhileMarching` | `toggles.alliesCanDieWhileMarching` | bool | false | — |
| 31 | `_enemiesTargetAllies` | `toggles.enemiesTargetAllies` | bool | false | — |

검증의 하한은 SO getter 의 클램프(`StageDefinition.cs` `Mathf.Max(...)`)와 같다. 게임이 조용히 클램프하는 값을 툴은 **소리 내어** 거부한다 — 기획자가 0.05 를 넣었는데 게임이 1 로 돌면 원인을 못 찾는다.

`difficulty` 열은 게임 enum 이름 `Easy/Normal/Hard` (`Difficulty.cs:14-19`), `displayName` 은 화면 표시용 한글. 둘 다 파일에 있다 — 표시명이 코드에 없기 때문이다.

## 5. 검증 규칙표 `[D-02-06]`

**툴과 임포터가 같은 ID 로 같은 규칙을 구현한다.** 메시지 형식은 `❌|⚠️|ℹ️ <ID> <위치> — <무엇이 왜 잘못인가>. <고치는 힌트>`.
심각도: ❌ 오류(임포트 거부) · ⚠️ 경고(임포트는 되지만 표시) · ℹ️ 정보(통계).
픽스처 파일명 = 규칙 ID (SDD-06 §3). **규칙을 추가하면 픽스처도 같이 추가한다.**

### 5-1. 파일 (F)

| ID | 심각도 | 조건 | 왜 |
|---|---|---|---|
| V-F01 | ❌ | `schema` ≠ `pmf.stage/1` | 옛 파일·다른 파일을 조용히 오독하지 않기 위해. 버전이 올라가면 변환기를 따로 둔다 |
| V-F02 | ❌ | `name` 이 비었거나 `\ / : * ? " < > \|` 를 포함 | Unity 에셋 파일명이 된다 |
| V-F03 | ❌ | 필수 섹션·필드 누락, 타입 불일치 (문자열 자리에 숫자 등) | 기본값으로 채워 넣지 않는다 — "안 적었는데 됐다" 는 다음 사람에게 함정이다 |

> **decode 소관 규칙은 넷뿐이다 — `V-F01` `V-F03` `V-M01` `V-M02`.** (2026-09-05 확정)
> 구조가 깨진 문서는 `StageDocument` 를 만들 수조차 없으므로 검증기가 볼 대상이 없다.
> **다른 규칙을 여기에 넣지 마라.** 픽스처를 구조적으로 깨뜨려 decode 에서 죽게 만들면
> 그 규칙은 영영 실행되지 않는데 테스트는 초록불이 된다 — 실제로 그렇게 규칙 6개가 미실행이었다.
> `tests/fixtures.test.ts` 의 마지막 감사 테스트가 이 경계를 지킨다 (발화 24/28 이 기준선).

### 5-2. 맵 (M)

| ID | 심각도 | 조건 | 왜 |
|---|---|---|---|
| V-M01 | ❌ | `rows` 수 ≠ `height`, 또는 어떤 행의 길이 ≠ `width` | 행 하나가 밀리면 맵 전체가 어긋난다. 몇 행인지 찍는다 |
| V-M02 | ❌ | §2-2 에 없는 문자 (행·열 위치 표시, 쓸 수 있는 문자 목록 첨부) | |
| V-M03 | ❌ | `V` 가 0개 | 마을이 없으면 아군을 뽑을 수 없다 |
| V-M04 | ❌ | `B` 가 0개 | 배치할 곳이 없다 |
| V-M05 | ⚠️ | `R` 셀이 4-연결 성분 2개 이상 | 적은 그래프를 따르므로 치명적이진 않지만, 끊긴 도로는 거의 항상 실수다 |
| V-M06 | ℹ️/⚠️ | 마을에서 도달 불가한 `B` 비율. **상시 표시**, 50% 초과면 ⚠️ | 실제로 391칸 중 178칸이 도달 불가였고 그게 계측을 통째로 오염시켰다 (게임 메모리 `balance_measurement_harness`). 도달 = `{., B, V}` 4-연결 플러드필, **`R` 은 벽 취급** (아군은 도로를 밟지 않는다) |
| V-M07 | ❌ | 어떤 마을에서 도달 가능한 `B` 가 0개 | 그 마을은 쓸모가 없다 |
| V-M08 | ❌ | `width`/`height` 가 8..256 밖 | 아래는 게임이 성립 안 하고, 위는 캔버스·SO 크기 상한 |

### 5-3. 경로 (P)

| ID | 심각도 | 조건 | 왜 |
|---|---|---|---|
| V-P01 | ❌ | 엣지·`burst.triggerNodeIds` 가 없는 id 를 가리킴 | 게임은 `LogError` 후 트리거를 무시한다 (`MotherSpawner.cs:132-151`) |
| V-P02 | ❌ | `start` ≠ 1개, 또는 `exit` = 0개. `exit` ≥ 2 는 ⚠️ | 게임은 `ExitNodes[0]` 만 쓴다 (`Escortee.cs:63`) |
| V-P03 | ❌ | 일반 엣지(비지름길·양 끝 비`branch`)가 대각선이거나, 축 정렬인데 두 끝 사이에 `R` 아닌 셀이 있음 | §3-3 코너 규칙. 대각선이 코너를 가로지르면 적이 벽을 뚫고 걷는 것처럼 보인다. 알고리즘은 SDD-09 §4-6 |
| V-P04 | ❌ | `shortcut=true` 인데 `allowed` ≠ `Escortee` | ADR-0004. 적이 지름길을 지나가면 지름길의 존재 이유가 없다 |
| V-P05 | ❌ | `start`→`exit` 경로가 없음 (Escortee 기준, 지름길 제외) **또는** Enemy 기준으로 start 에서 exit 에 못 감 | 전자는 판이 안 끝나고, 후자는 모체가 얼어붙는다 (게임 메모리 `project_overview` "지름길 부작용") |
| V-P06 | ⚠️ | 트리거가 `start` 또는 `exit` 노드 | 시작 즉시 버스트 / 도착 후 버스트는 의미가 없다 |
| V-P07 | ❌ | `start`/`exit`/`waypoint` 가 `R` 아닌 셀, 또는 `branch` 가 통행 불가 셀(`W ~ _`) | 노드는 도로 위에 있어야 한다. `branch` 는 아군용이라 `B`/`.`/`V` 면 된다 |
| V-P08 | ❌ | 같은 (from,to) 중복, 또는 `bidirectional` 엣지의 역방향이 따로 존재 | 게임이 중복 엣지를 경고하고 탐색이 이상해진다 (`PathGraph.cs:143-152`) |
| V-P09 | ❌ | id 형식 위반 또는 중복 | §3-1 |
| V-P10 | ⚠️ | `shortcut=true` 인데 `bidirectional=true` | 지름길은 보호대상 전용(V-P04)이고 보호대상은 앞으로만 간다 — 반대 엣지는 아무도 지나지 않는 죽은 엣지다. 게임이 반대 엣지도 함께 열어 주므로(`PathGraph.OpenShortcut:126-130`) 당장 깨지지는 않아 ⚠️. 다만 양방향 그래프는 "지름길을 지나친 뒤 구매하면 되돌아간다" 버그의 원인이었고(2026-08-29 사용자 보고, `Escortee.RecalculateRoute` 주석), 그 우회책은 `Escortee` 안에만 있다 → ADR-E11 |

### 5-4. 스폰·경제 (S)

| ID | 심각도 | 조건 | 왜 |
|---|---|---|---|
| V-S01 | 툴 ⚠️ / 임포터 ❌ | `enemy` 이름이 카탈로그(툴) / `EnemyDefinition` 에셋(임포터)에 없음. **있는 것 목록을 같이 찍는다** | 툴은 Unity 를 못 보므로 내장 카탈로그(`Robot_Walker`, `Robot_Scout`, 스폰 탭에서 추가 가능)로 경고만. 진짜 판정은 임포터 |
| V-S02 | ❌ | 가중치 합 0, 또는 음수 가중치 | 게임 `LogError` (`MotherSpawner.cs:401-430`) |
| V-S03 | ❌ | §4 표의 범위 위반 | 게임 클램프와 동일 하한 |
| V-S04 | ❌ | `Easy/Normal/Hard` 가 각 1개가 아님 | `TierFor()` 는 없으면 전부 0 인 티어를 돌려준다 — 조용히 수입 0 이 된다 (`Difficulty.cs:128-143`) |
| V-S05 | ❌ | `healthByProgress` 의 `t` 가 오름차순 아님, `[0,1]` 밖, `mul ≤ 0` | AnimationCurve 로 변환 시 키 순서가 꼬인다 |

### 5-5. 밸런스 관계 (B)

| ID | 심각도 | 조건 | 왜 |
|---|---|---|---|
| V-B01 | ❌ | `mother.speed ≥ escortee.speed` | 게임이 `LogError` (`MotherSpawner.cs:107-109`). 모체가 따라잡으면 게임이 성립하지 않는다 (GDD §7) |
| V-B02 | ⚠️ | `burst.triggerNodeIds` 에 중복 | 두 번째는 무시된다 |
| V-B03 | ⚠️ | `burst.volleyCount ≤ spawn.volleyCount` | 버스트가 평시와 같으면 "최대 부하 구간" 이라는 의미를 잃는다 (2026-09-02 스폰 조정 때의 판단) |

## 6. TOON 인코딩 규칙 `[D-02-07]`

부분집합만 쓴다. 사양은 TOON v4.1 (Working Draft, 2026-07-26).

| 쓰는 것 | 형태 |
|---|---|
| 스칼라 | `key: value` — 숫자 / `true` / `false` / 문자열 |
| 중첩 객체 | `key:` 뒤 2칸 들여쓰기 |
| 원시 배열 | `key[N]: a,b,c` |
| 표 | `key[N]{f1,f2}:` + 들여쓴 값 행 |
| 주석 | `#` 로 시작하는 줄. **디코더는 구조 파싱 전에 지운다** (사양의 lexical pre-pass) |
| 인용 문자열 | `"..."` + 이스케이프 `\\ \" \n \r \t \uXXXX` — 기획자가 이름에 `:` 를 넣었을 때만 나온다 |

쓰지 않는 것: 키 있는 표(`[N:]`), 탭·파이프 구분자, 배열 안의 객체, 루트 배열, `null`. 디코더는 이런 것을 만나면 **행 번호와 함께 거부** 한다. 조용히 넘기면 기획자는 반영된 줄 안다.

**편차 (ADR-E02):** 사양은 "인코더는 주석을 내지 않는다" 이지만 **우리 인코더는 주석을 낸다.** 파일이 LLM 프롬프트로 쓰이고 기획자가 읽기 때문이다. 디코더는 어차피 주석을 지우므로 파일은 여전히 사양 적합 입력이다. 기획자가 직접 쓴 주석은 **저장 시 사라진다** — 툴이 낸 주석만 남는다. 이 한계는 툴 상단에 명시한다.

### 6-1. 정규 출력 (canonical) `[D-02-08]`

같은 문서는 **바이트까지 같은** 파일이 되어야 한다. git diff 가 실제 변경만 보여 주고, 골든 왕복 테스트(SDD-06 §2)가 성립하려면 필요하다.

- 섹션 순서 고정: `schema, name, map, path, spawn, burst, economy, escortee, mother, presentation, toggles`. 섹션 안 키 순서는 §4 표 순서.
- 숫자: 정수는 `150`, 실수는 **최단 왕복 표현** (JS `Number.prototype.toString`; C# 은 `float.ToString("R")` — `double` 로 올려서 찍으면 `0.41999998...` 이 나오므로 반드시 `float` 로). 지수 표기 금지 (`1e-7` 같은 값은 이 도메인에 없다).
- 불리언 `true`/`false`. 문자열은 인용 조건에 걸릴 때만 인용.
- `rows` 는 `height` 행, 각 `width` 문자. `nodes` 는 파일에 있던 순서 유지(툴이 정렬하지 않는다 — 순서가 게임의 노드 `Id` 가 된다). `edges` 도 순서 유지.
- 줄 끝 `\n`, 파일 끝 `\n` 하나, BOM 없음, UTF-8.
- 툴이 내는 주석은 고정 문구 + 툴 버전 한 줄. 문구가 바뀌면 골든 파일도 갱신한다.

## 7. 스키마 버전 `[D-02-09]`

- `pmf.stage/1` 이 현재. 필드 추가·삭제·의미 변경 = 버전 상승.
- 임포터와 툴은 자기 버전만 읽는다. 옛 파일은 **명시적 변환기** (`core/toon/migrate.ts`, 버전당 함수 하나)로 올린 뒤 읽는다. 자동 추측 없음.
- 버전을 올릴 때 할 일: 이 문서 §4·§5 갱신 → 씨앗 재생성 → 픽스처 갱신 → ADR 한 장.

## 8. 결정 요약 — 왜 파일에 없는가 `[D-02-10]`

| 없는 것 | 왜 |
|---|---|
| `objects` 섹션 (마을·시작·모체·탈출 좌표) | 마을은 `V` 셀, 시작/탈출은 노드 `role`, 모체는 start 와 같은 셀. 지금 마을에 저작 속성이 하나도 없고(`Village.cs` 의 직렬화 필드는 `_hireableUnits` 하나, 그것도 프리팹 배선) 같은 사실을 두 곳에 적으면 검증 규칙이 하나 더 필요하다. 속성이 생기면 그때 `villages[N]{x,y,...}` 를 추가하고 `V` 를 파생으로 바꾼다 — ADR-E05 |
| 엣지 `cost` | 게임이 거리로 계산. §3-2 |
| 유닛(`UnitDefinition`) 수치 | 스테이지가 아니라 병종 데이터다. 다른 파일·다른 스키마(`pmf.units/1`)의 일이고 이번 범위 밖 |
| 색상 | 게임 코드가 원본 (ADR-E09). 파일에 넣으면 세 번째 사본이 된다 |
| 툴 상태 (줌·선택·레이어 토글) | 파일은 스테이지다. 툴 상태는 `localStorage` |
