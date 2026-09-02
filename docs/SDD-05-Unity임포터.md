# SDD-05. Unity 임포터 — 게임 프로젝트 쪽 설계

- 버전 0.1 · 2026-09-03
- 대상 저장소: `G:\Project\Prowl's Moving Factory` (이 SDD 의 다른 문서와 달리 **게임 프로젝트에 코드가 들어간다**)
- 게임 쪽 정본과의 관계: `.docs/PLAN-authoring-pipeline.md` §5 를 이 문서가 대체한다. `ADR-0022` 는 포맷 서술(CSV/JSON)을 TOON 으로 정정한다.
- 게임 `CLAUDE.md` 규칙을 전부 따른다: `Assets/_Project/` 아래만, `.meta` 손대지 않기, 씬 YAML 손대지 않기, CLI 로 컴파일·테스트 확인.

---

## 1. 한 줄 `[D-05-01]`

> `.toon` → (파싱 → 검증 → 전부 성공 시에만) `MapDefinition` + `PathDefinition` + `StageDefinition` 에셋. **씬은 건드리지 않는다.** 씬 반영은 개발자가 `PMF/Create Greybox Scene` 으로.

```
지금:  GreyboxMapData.cs (C# 상수) ──▶ SceneBootstrap ──▶ 씬          ← 기획자 작업을 지운다
이후:  Stage_X.toon ──▶ Map/PathDefinition ──▶ SceneBootstrap ──▶ 씬   ← 기획자 작업을 반영한다
```

## 2. 파일 배치 `[D-05-02]`

```
Assets/_Project/Scripts/
  Runtime/Data/
    MapDefinition.cs          신규 SO. 격자. SceneParts.BuildMap 이 읽는다
    PathDefinition.cs         신규 SO. 노드·엣지. SceneParts.BuildPathNodes 가 읽는다
    StageDefinition.cs        기존. 필드를 바꾸지 않는다 — 임포터가 채울 뿐
  Editor/Authoring/           (PMF.Editor.asmdef, 네임스페이스 PMF.EditorTools.Authoring)
    Toon/ToonReader.cs        텍스트 → ToonNode 트리. Unity 타입 의존 0
    Toon/ToonWriter.cs        ToonNode → 텍스트 (Exporter 용, SDD-02 §6-1 정규 출력)
    StageDocument.cs          ToonNode → 순수 DTO. SDD-02 §1 의 C# 판
    AuthoringValidator.cs     DTO → Issue 목록. 규칙 ID 는 SDD-02 §5 그대로
    AuthoringImporter.cs      DTO → SO. **여기서만 AssetDatabase 를 만진다**
    AuthoringExporter.cs      SO (+GreyboxMapData) → DTO → 텍스트. 씨앗 생성·튜닝 회수
    AuthoringWindow.cs        메뉴 PMF/Authoring… — 경로, [검증] [임포트] [익스포트], 로그
  Tests/Authoring/            EditMode: 파서·검증기·왕복
```

**경계:** `ToonReader`·`StageDocument`·`AuthoringValidator` 는 `UnityEngine` 을 참조하지 않는다 (`Vector2Int` 도 안 쓴다 — 자체 `struct Cell {int X,Y}`).
왜: EditMode 테스트가 에셋 없이 돌고, 툴의 `core/` 와 1:1 로 대응해 규칙을 나란히 놓고 비교할 수 있다. 이 경계가 흐려지면 테스트가 불가능해진다.

## 3. 파서 `ToonReader` `[D-05-03]`

SDD-02 §6 의 부분집합만. 구현 순서:

1. **주석 제거 pre-pass**: 앞 공백 뒤 첫 문자가 `#` 인 줄 삭제 (사양이 요구하는 lexical pre-pass). 빈 줄 삭제.
2. 들여쓰기 → 깊이 (2칸 단위. 탭이나 홀수 칸이면 오류 + 행 번호).
3. 줄 분류: `key:`(객체 열기) / `key: value` / `key[N]: a,b` / `key[N]{f,g}:` + 다음 N 줄이 값 행.
4. 값 해석: `true|false` → bool, 숫자 패턴 → double, 인용 → 이스케이프 해제, 그 외 → 문자열 그대로.
5. 표의 행 수가 `N` 과 다르면 오류 (**맵 행이 빠지는 사고를 헤더의 N 이 잡는다** — TOON 을 고른 이유 중 하나).

거부(명확한 메시지 + 행 번호): 탭·파이프 구분자, `[N:]` 키 있는 표, 배열 안 객체, `null`, 루트 배열, 지원 안 하는 이스케이프.
**조용히 무시하는 경우는 없다.**

## 4. DTO 와 검증 `[D-05-04]`

- `StageDocument` (C#): SDD-02 §1 과 필드명·타입을 맞춘다. `cells` 는 `byte[]` (값 = `CellType`, 255 = 없음).
- `AuthoringValidator.Validate(doc, EnemyNames) → List<Issue { Id, Severity, Path, Message }>`.
  규칙 ID·심각도·조건은 SDD-02 §5 표와 **글자까지 같다.** 툴 쪽 `core/validate` 와 차이가 나면 이 SDD 가 이기고 둘 다 고친다.
- `EnemyNames` 는 `AssetDatabase.FindAssets("t:EnemyDefinition")` 로 모은 **에셋 파일명** (`Robot_Walker`). `_displayName`(`워커`)이 아니다 — 표시명은 바뀌어도 되는 값이라 참조 키로 쓰면 안 된다. V-S01 은 여기서 ❌ 다.
- 공유 픽스처: 에디터 저장소 `docs/fixtures/` 의 파일을 그대로 읽는다 (경로 상수 하나, SDD-06 §3). 규칙 ID 당 픽스처 하나가 **정확히 그 ID 하나만** 내는지 테스트.

## 5. 신규 SO `[D-05-05]`

```csharp
namespace PMF.Data
{
    /// 격자의 원본. 씬 타일맵은 이것의 파생물이다. 런타임은 읽지 않는다 (GridSystem 은 여전히 타일맵을 스캔).
    [CreateAssetMenu(menuName = "PMF/Map Definition")]
    public sealed class MapDefinition : ScriptableObject
    {
        [SerializeField] private int _width, _height;
        [SerializeField] private Vector3 _origin;
        [SerializeField] private byte[] _cells;     // index = y*width + x. 값 = CellType, 255 = 타일 없음
        public int Width => _width;  public int Height => _height;  public Vector3 Origin => _origin;
        public bool TryGetCell(int x, int y, out CellType cell);   // 255 면 false
    }

    public enum PathNodeRole { Waypoint = 0, Start = 1, Exit = 2, Branch = 3 }

    [CreateAssetMenu(menuName = "PMF/Path Definition")]
    public sealed class PathDefinition : ScriptableObject
    {
        [System.Serializable] public struct NodeDef { public string Id; public Vector2Int Cell; public PathNodeRole Role; }
        [System.Serializable] public struct EdgeDef { public string From, To; public PathAgent Allowed; public bool Bidirectional; public bool IsShortcut; }
        [SerializeField] private NodeDef[] _nodes;
        [SerializeField] private EdgeDef[] _edges;
        public IReadOnlyList<NodeDef> Nodes => _nodes;  public IReadOnlyList<EdgeDef> Edges => _edges;
    }
}
```

- 왜 런타임이 `MapDefinition` 을 직접 읽지 않는가: `GridSystem.BuildFromTilemaps()` 와 6레이어 구조는 이미 검증된 경로다. 원본만 바꾸고 파이프라인은 그대로 둔다 (ADR-0022 "런타임은 텍스트를 읽지 않는다" 의 연장). 나중에 타일맵을 없애고 싶어지면 그때 `GridSystem` 이 `MapDefinition` 을 읽게 바꾼다 — 별도 ADR.
- 에셋 경로: `Assets/_Project/Data/Stages/<name>.asset` (Stage), `<name>.map.asset`, `<name>.path.asset`. `name` 은 `.toon` 의 `name` (V-F02 가 파일명 안전성을 보장).
- 클래스명 `~Definition` — 게임 CLAUDE.md §4 네이밍.

## 6. 임포터 `[D-05-06]`

```
Import(path):
  text  = File.ReadAllText(path)                         // Assets/ 밖이어도 된다
  tree  = ToonReader.Parse(text)                          // 실패 → 행 번호와 함께 중단
  doc   = StageDocument.From(tree)                        // V-F01/F03
  issues = AuthoringValidator.Validate(doc, enemyNames)
  if (issues.Any(Error)) → 로그에 전부 찍고 중단.  "→ N개 문제. 임포트하지 않았다."
  // ---- 여기까지 AssetDatabase 무접촉 ----
  map   = LoadOrCreate<MapDefinition>(mapPath);  Fill(map, doc)
  pathD = LoadOrCreate<PathDefinition>(pathPath); Fill(pathD, doc)
  stage = LoadOrCreate<StageDefinition>(stagePath)
  using (SerializedObject so = new(stage)) { 31개 필드 중 30개 기록 (표 SDD-02 §4). _resourcePerSecond 는 건드리지 않는다 }
  EditorUtility.SetDirty ×3 → AssetDatabase.SaveAssets()
  로그: "✅ 임포트 완료 — <name>. 씬 재생성(PMF/Create Greybox Scene) 후 총수입 천장을 다시 재라."
```

- **검증 통과 전에는 에셋을 건드리지 않는다.** 이것이 "전부 성공하거나 전부 취소" 의 실체다. 쓰기 단계에서 예외가 나면 그건 기획자 데이터 문제가 아니라 버그다 — 로그에 "git 으로 `Data/Stages` 를 되돌려라" 를 찍는다.
- `_spawnTable`: 이름 → `AssetDatabase.LoadAssetAtPath<EnemyDefinition>` (guid 는 임포터만 안다).
- `_enemyHealthByProgress`: `(t, mul)` 키로 `AnimationCurve` 생성, 탄젠트 **Linear** (`AnimationUtility.SetKeyLeftTangentMode/Right…`). 왜 Linear: 툴 그래프가 구간 선형으로 보여 주므로 게임도 그렇게 보간해야 "본 대로 돈다". 현재 씨앗은 키 2개 상수라 차이가 없다.
- `_difficulties`: `Easy/Normal/Hard` 문자열 → enum, `displayName` 그대로.
- `_burstTriggerNodeIds`: 문자열 배열 그대로 (V-P01 이 존재를 보장했다).
- 임포터는 **기획자 파일에 쓰지 않는다.** 되쓰기는 Exporter 만, 개발자가 명시적으로.

## 7. 씬 빌더 연결 `[D-05-07]`

| 지점 (게임 코드) | 지금 | 이후 |
|---|---|---|
| `GreyboxFactory.BuildAll()` → `Result` | 스프라이트·SO·프리팹 | + `Map`, `Path` 로드. 현재 스테이지 이름은 `EditorPrefs["PMF.Authoring.CurrentStage"]` (기본 `Stage_Greybox`). 없으면 `null` |
| `SceneParts.BuildMap` `:62` `GreyboxMapData.GetCategory(x,y)` | C# 상수 | `factory.Map != null ? map.TryGetCell(x,y) : GreyboxMapData…`. 255 → 타일 안 칠함. `Width/Height/Origin` 도 SO 에서 |
| `SceneParts.BuildPathNodes` `:224-242` `GreyboxMapData.Nodes/Edges` | C# 상수 | `factory.Path` 의 노드 → GameObject(이름 = `Id`) + `PathNodeAuthoring` (`_isEscorteeStart = Role==Start`, `_isExit = Role==Exit`), 엣지 → `Connect(from, to, allowed, bidirectional, shortcut)` |
| `SceneParts.BuildActors` (`Escortee`, `Mother`, `Villages`) | `EscorteeSpawnCell`/`MotherSpawnCell`/`Villages[]` | 시작 = `Start` 노드 셀 (둘 다). 마을 = `cells` 에서 `VillageSlot` 인 칸 전부, 이름 `Village_{i+1}` (**순서 = y 내림차순, x 오름차순** — 씬 계층 순서가 안정돼야 diff 가 조용하다) |
| `GreyboxFactory.CreateStageDefinition` | "있으면 손대지 않음" | 그대로. 임포터가 미리 채워 두면 자연히 존중된다 |
| `GreyboxMapData.cs` | 원본 | **폴백.** `Map == null` 일 때만. M5 DoD 통과 후 삭제 (SDD-07) |

`SceneParts.cs:286` 의 낡은 주석("마을 3곳")은 이때 같이 고친다.

## 8. 익스포터 `[D-05-08]`

- 입력: 현재 `Stage_Greybox.asset` + (`Map`/`Path` SO 가 있으면 그것, 없으면 `GreyboxMapData.GetCategory` 32×18 전수 + `Nodes`/`Edges`).
- 출력: SDD-02 §6-1 정규 출력. `float` 은 `ToString("R", InvariantCulture)` — `double` 로 올리면 `0.41999998` 이 나온다.
- 용도: (1) **씨앗 생성** — 기획자가 빈 화면에서 시작하지 않게. `docs/examples/Stage_Greybox.toon` 이 이 결과와 바이트 동일해야 한다 (SDD-06 §2 골든). (2) 개발자가 인스펙터로 튜닝한 값을 파일로 회수.
- 방향은 단방향이 원칙(파일 → SO). Export 는 명시적 조작이고, 겹치면 파일이 이긴다 (ADR-0022).

## 9. 창 `AuthoringWindow` `[D-05-09]`

메뉴 `PMF/Authoring/Stage Authoring…`. 필드: 파일 경로(찾아보기), 현재 스테이지 이름(EditorPrefs). 버튼 `[검증] [임포트] [익스포트]`. 아래에 로그(규칙 ID·경로·메시지, 더블클릭 시 클립보드 복사).
UI Toolkit 금지 규칙(ADR-0006)은 **런타임 UI** 이야기라 에디터 창은 IMGUI 든 UI Toolkit 이든 된다 — 기존 `GridSystemEditor` 와 맞춰 IMGUI.

## 10. 임포트 후 절차 (개발자 체크리스트) `[D-05-10]`

1. `PMF/Create Greybox Scene` — 편집 모드에서만 (플레이 중이면 조용히 실패, 게임 메모리 `scene_rebuild_wipes_handwork`).
2. 재생성 확인: `SelectionController` 존재 · 스테이지 SO 튜닝값 그대로 · 마을이 병종 2종 고용 · `git status` 에 유령 에셋 없음.
3. **총수입 천장 재측정** (현재 402 / 56기 / 119초). 맵·스폰이 바뀌면 통째로 움직인다 (게임 메모리 `difficulty_and_economy`). 툴 시뮬의 수입 천장(SDD-04)과 대조 — 크게 다르면 시뮬 가정이 틀린 것이니 SDD-04 §3 을 고친다.
4. EditMode 테스트 전체 통과 (`unity command run_tests --mode EditMode`).

## 11. 테스트 (EditMode) `[D-05-11]`

| 테스트 | 내용 |
|---|---|
| `ToonReaderTests` | 스칼라·중첩·배열·표·주석·인용 각 1개 이상. 거부 케이스(탭, `[N:]`, 행 수 불일치)가 **행 번호를 포함** 하는지 |
| `ValidatorFixtureTests` | `docs/fixtures/invalid/<ID>.toon` 각각이 정확히 그 ID 를 내는지. `valid/*.toon` 은 이슈 0 |
| `RoundTripTests` | 씨앗 → DTO → Writer → 텍스트 == 씨앗 (바이트) |
| `ImporterTests` | 임시 폴더에 임포트 → SO 필드 30개가 DTO 와 같은지 → 임시 에셋 삭제. `_resourcePerSecond` 가 안 바뀌었는지 |

## 12. 위험 `[D-05-12]`

| 위험 | 대응 |
|---|---|
| 맵이 바뀌면 밸런스가 통째로 무효 | §10-3 을 필수 절차로. 툴 시뮬이 사전 경고 |
| `AutoBuild.cs` 가 도메인 리로드 때 씬을 자동 재생성 | 마커 파일이 있으면 안 돈다. 임포터는 마커를 건드리지 않는다 |
| 노드 이름을 기획자가 바꿔 트리거가 깨짐 | 툴의 `RenameNode` 가 참조를 같이 바꾸고, V-P01 이 파일 단계에서 잡는다 |
| 마을 순서가 바뀌어 `Village_1/2` 가 뒤바뀜 | §7 의 결정적 정렬. 씬 오브젝트 이름은 게임 로직이 참조하지 않는다 (위치로만 동작) |
| 색상이 세 곳 (게임 코드·타일 에셋·툴) | 원본은 게임 코드. 툴은 출처 주석 (ADR-E09). 데이터로 뺄지는 미결 |
