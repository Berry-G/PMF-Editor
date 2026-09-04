# SDD-09. 알고리즘 명세 — "어떻게" 를 못박는다

- 버전 0.1 · 2026-09-04
- 시그니처는 `SDD-08-확정API.md`. 이 문서는 그 함수들의 **본문** 을 정한다. 의사코드는 TypeScript 에 가깝게 썼고, 그대로 옮겨도 된다.
- 여기 적힌 순서·동률 처리·경계 조건은 **결정론과 테스트 재현** 을 위한 것이다. "같은 결과면 다른 방법도 되지 않나" — 된다. 단, 골든·회귀 테스트가 바이트/숫자까지 같아야 하므로 순서와 동률 규칙은 지켜라.
- 각 절 끝의 **검증** 은 그 알고리즘의 단위 테스트 최소 목록이다.

---

## 1. TOON 디코더 (`core/toon/lexer.ts`) `[D-09-01]`

### 1-1. 전처리

```
lines = text.split('\n')                       // '\r\n' 도 받는다: 각 줄 끝의 '\r' 제거
keep = []
for (i, raw) of lines:                          // i 는 0부터. 오류 메시지의 line = i+1
  if raw.trimEnd() === '' → continue            // 빈 줄
  if /^\s*#/.test(raw) → continue               // 주석 (사양: 앞 공백만 허용)
  if raw.includes('\t') → error(i+1, "탭은 쓸 수 없다. 스페이스 2칸 들여쓰기")
  indent = raw.length - raw.trimStart().length
  if indent % 2 !== 0 → error(i+1, `들여쓰기가 홀수(${indent})다`)
  keep.push({ line: i+1, depth: indent/2, body: raw.trim() })
```

### 1-2. 줄 분류 (정규식, 이 순서로 시도)

| 종류 | 정규식 | 의미 |
|---|---|---|
| 표 헤더 | `^([A-Za-z_][A-Za-z0-9_.]*)\[(\d+)\]\{([^}]*)\}:$` | `key[N]{f1,f2}:` — 다음 N 줄(깊이 +1)이 값 행 |
| 원시 배열 | `^([A-Za-z_][A-Za-z0-9_.]*)\[(\d+)\]:(.*)$` | `key[N]: a,b` — 나머지를 구분자로 자름. `N=0` 이면 나머지는 공백 |
| 객체 열기 | `^([A-Za-z_][A-Za-z0-9_.]*):$` | 다음 줄들(깊이 +1)이 자식 |
| 스칼라 | `^([A-Za-z_][A-Za-z0-9_.]*):\s(.*)$` | `key: value` (콜론 뒤 **공백 하나** 필수) |
| 그 외 | — | `error(line, "해석할 수 없는 줄")` |

키가 인용된 형태(`"a b":`)는 **지원하지 않는다** — 우리 스키마에 없다. 만나면 위 "그 외" 로 떨어져 오류.

### 1-3. 재귀 하강

```
parseObject(depth, startIdx) → (node, nextIdx):
  entries = new Map()
  k = startIdx
  while k < keep.length and keep[k].depth === depth:
    L = keep[k]
    if keep[k].depth > depth → error(L.line, "들여쓰기가 너무 깊다")
    match 종류:
      표 헤더: fields = split(f, ','); trim 각각; 빈 필드명 → error
               rows = []; for j in 1..N: R = keep[k+j]
                 if !R or R.depth !== depth+1 → error(L.line, `표 ${key} 는 ${N}행이어야 하는데 ${j-1}행뿐이다`)
                 cells = splitDelimited(R.body); if cells.length !== fields.length → error(R.line, `${fields.length}열이어야 하는데 ${cells.length}열`)
                 rows.push(cells.map(parseValue))
               k += 1+N
               다음 줄이 depth+1 이면 error(그 줄, `표 ${key} 는 ${N}행이라고 했는데 행이 더 있다`)   // 왜: 행 수 불일치를 반드시 잡는다
      원시 배열: items = N===0 ? [] : splitDelimited(rest).map(parseValue); length !== N → error; k += 1
      객체 열기: (child, k2) = parseObject(depth+1, k+1); if child.entries.size === 0 → error(L.line, "빈 객체"); k = k2
      스칼라: entries.set(key, scalar(parseValue(v))); k += 1
    if entries.has(key) (set 전에 검사) → error(L.line, `키 ${key} 중복`)
  return ({ kind:'object', entries }, k)

루트: parseObject(0, 0) 후 nextIdx !== keep.length → error(keep[nextIdx].line, "루트 깊이가 아닌 줄")
```

### 1-4. 값과 구분

```
splitDelimited(s):                       // 콤마 분할. 인용 안의 콤마는 보존
  out=[]; cur=''; inQ=false; i=0
  while i < s.length:
    c = s[i]
    if inQ: if c==='\\' → cur += c + s[i+1]; i+=2; continue     // 이스케이프는 parseValue 가 푼다
            if c==='"' → inQ=false
            cur += c
    else: if c==='"' → inQ=true; cur+=c
          else if c===',' → out.push(cur); cur=''; i++; continue
          else cur+=c
    i++
  out.push(cur); return out.map(t => t.trim())

parseValue(t):
  if t === 'true' → true ; if t === 'false' → false
  if t === 'null' → error("null 은 쓰지 않는다")
  if t.startsWith('"'):
     if !t.endsWith('"') or t.length < 2 → error("닫히지 않은 인용")
     return unescape(t.slice(1,-1))       // \\ \" \n \r \t \uXXXX 만. 다른 \x → error
  if /^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(t) → Number(t)
  return t                                 // 인용 없는 문자열
```
빈 문자열은 `""` 로만 온다. `parseValue('')` 는 error("빈 값").

### 1-5. 검증 (단위 테스트)

정상: 스칼라 4종 · 중첩 3단 · `[0]:` 빈 배열 · 표 1열/4열 · 인용 안 콤마·콜론 · `한` 이스케이프.
오류(행 번호 포함 확인): 탭 · 홀수 들여쓰기 · 표 행 부족 · 표 행 초과 · 열 수 불일치 · 키 중복 · `null` · 닫히지 않은 인용 · 콜론 뒤 공백 없음(`key:value`).

## 2. TOON 인코더 — 정규 출력 (`core/toon/encode.ts`) `[D-09-02]`

### 2-1. 골격

```
out = []
out.push(`# Prowl's Moving Factory — 스테이지 데이터 (${SCHEMA})`)
out.push(`# PMF Editor ${toolVersion} 가 만들었다. 손으로 고쳐도 되지만 저장은 툴로 하는 편이 안전하다.`)
if issues?.some(error): out.push(`# ⚠ 검증 실패 ${errorCount}건 — 임포트되지 않는다. 툴의 검증 탭을 보라.`)
out.push(`schema: ${SCHEMA}`)
out.push(`name: ${str(doc.name)}`)
out.push('')
section('map', …) ; section('path', …) ; section('spawn', …) ; section('burst', …)
section('economy', …) ; section('escortee', …) ; section('mother', …) ; section('presentation', …) ; section('toggles', …)
return out.join('\n') + '\n'
```
섹션마다 앞에 빈 줄 하나, 씨앗 파일과 **같은 위치에 같은 문구의 주석** 을 낸다 (주석 문구는 `encode.ts` 상단 상수 배열 `SECTION_COMMENTS` 하나에 모아 둔다 — 골든 파일과 동기화 지점이 한 곳이어야 한다).
씨앗 `docs/examples/Stage_Greybox.toon` 이 곧 기대 출력이다. **주석 문구를 바꾸면 씨앗도 같이 바꾼다.**

키 순서는 SDD-02 §4 표 순서. 표는 `key[N]{fields}:` + 행. 행의 값 순서는 필드 순서.

### 2-2. 문자열 인용 판정 `str(s)`

다음 중 하나면 `"` 로 감싸고 이스케이프(`\\` `"` `\n` `\r` `\t`, 제어문자는 `\uXXXX`):
`s === ''` · 앞/뒤 공백 · `s ∈ {true,false,null}` · 숫자 패턴(§1-4) 매치 · `[:"\\\[\]{}]` 포함 · `,` 포함 · 제어문자 포함 · `-` 또는 `#` 로 시작.
그 외는 그대로. (한글·`+`·`_`·`.`·`~` 는 그대로다.)

### 2-3. 숫자 `formatNumber(n)`

```
if !Number.isFinite(n) → throw
if Number.isInteger(n) → return String(n)              // "150", "-16"
s = String(n)                                          // JS 최단 왕복 표현
if s.includes('e') → throw                             // 이 도메인에 없는 값. 있으면 설계 오류
return s                                               // "0.42", "8.2", "0.07"
```
C# 쪽은 `((float)v).ToString("R", CultureInfo.InvariantCulture)` — `float` 로 저장된 값을 `double` 로 올려 찍으면 `0.41999998` 이 되므로 **반드시 `float`** 로. 정수 필드(`int`)는 `ToString()`.

`-0` 은 `0` 으로 쓴다 (`Object.is(n, -0) ? 0 : n`).

### 2-4. 맵 행

`rows[height]{row}:` 뒤에 `r = 0..height-1` 순으로, `y = height-1-r` 행의 문자열 `cells[y*width .. y*width+width-1]` 을 `CELL_TO_CHAR` 로. 행은 인용 없이 그대로 (§2-2 판정에 걸리는 문자가 없다 — `cellFromChar` 표에 새 문자를 넣을 때 이 판정을 다시 확인).

### 2-5. 검증

- `encode(decode(seed)) === seed` (바이트).
- `decode(encode(doc))` deepEqual `doc` — 임의 문서 20개(작은 property test: 크기 8~40, 노드 0~10, 난수 시드 고정).
- `formatNumber`: `150→"150"`, `0.42→"0.42"`, `8.2→"8.2"`, `-16→"-16"`, `1e21→throw`, `-0→"0"`.
- `str`: `"쉬움"→쉬움`, `"a,b"→"\"a,b\""`, `"-x"→"\"-x\""`, `"12"→"\"12\""`, `""→"\"\""`.

## 3. 검증 규칙 — 알고리즘과 메시지 `[D-09-03]`

`validate()` 는 SDD-08 §4 의 순서로 아래를 실행한다. 메시지는 **템플릿 그대로** (임포터 C# 도 같은 문장). `{}` 안이 치환 자리.

### 3-1. F

| ID | 알고리즘 | 메시지 |
|---|---|---|
| V-F01 | `decode` 단계에서 `schema !== 'pmf.stage/1'` | `schema 가 "{schema}" 다. 이 툴은 pmf.stage/1 만 읽는다` |
| V-F02 | `name === ''` 또는 `/[\\\/:*?"<>|]/.test(name)` 또는 `name.trim() !== name` | `name "{name}" 은 파일 이름으로 쓸 수 없다. \ / : * ? " < > \| 와 앞뒤 공백을 빼라` |
| V-F03 | `decode` 에서 필수 키 누락·타입 불일치·표 필드명 불일치 | `{path} — {기대 타입} 이어야 하는데 {실제} 다` / `{path} 가 없다` |

F01/F03 은 `decode` 가 `DecodeError` 로 내고, `validate` 는 이미 만들어진 문서에 대해 F02 만 본다. 툴의 검증 탭에는 둘 다 같은 모양으로 보인다.

### 3-2. M — 준비: `counts = countCells(map)`, `reach = computeReachability(map)`

| ID | 알고리즘 | 메시지 (심각도) |
|---|---|---|
| V-M08 | `width<8 || width>256 || height<8 || height>256` | `맵 크기 {w}×{h} — 8~256 사이여야 한다` (❌). **M08 을 M01 보다 먼저** — 크기가 틀리면 나머지가 의미 없다 |
| V-M01 | 디코더가 `rows.length !== height` 또는 어떤 행 `length !== width` | `map.rows[{r}] — 길이가 {len} 인데 width 는 {w} 다` / `map.rows — {n}행인데 height 는 {h} 다` (❌) |
| V-M02 | 디코더가 `cellFromChar(ch) === undefined` | `map.rows[{r}] — 알 수 없는 문자 '{ch}' ({r+1}행 {c+1}열). 쓸 수 있는 문자: _ . R B V W ~` (❌) |
| V-M03 | `counts[VillageSlot] === 0` | `마을(V)이 없다. 아군을 고용할 곳이 없다` (❌) |
| V-M04 | `counts[Buildable] === 0` | `배치 가능 칸(B)이 없다` (❌) |
| V-M05 | 도로 칸 4-연결 성분 수 `> 1` (§4-4 floodFill 을 R 칸에 반복) | `도로가 {k}조각으로 끊겨 있다. 첫 조각 밖의 도로 칸 예: ({x},{y})` (⚠️) `cells` = 두 번째 이후 성분 전부 |
| V-M06 | `ratio = 1 - reach.reachableBuildable / reach.totalBuildable`. 항상 ℹ️ 하나 (`path=''`), `ratio > 0.5` 면 ⚠️ 로 승격 | `마을에서 갈 수 없는 배치 칸이 {n}/{total} ({pct}%) 다` `cells` = 도달 불가 B 전부 |
| V-M07 | `reach.perVillage` 중 `buildable === 0` | `마을 ({x},{y}) 에서 갈 수 있는 배치 칸이 없다` (❌) |

M01/M02 는 디코더에서 잡힌다(문서를 만들 수 없으므로). 규칙 ID 는 유지한다.

### 3-3. P — 준비: `byId = Map(id → index)`, `g = buildGraph(path, {openShortcuts:false})`

| ID | 알고리즘 | 메시지 |
|---|---|---|
| V-P09 | 각 노드 `!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)` 또는 중복 | `path.nodes[{i}] — id "{id}" 형식 위반 (영문·숫자·_ 만, 숫자로 시작 불가)` / `id "{id}" 가 {n}번 있다` (❌). **P09 를 먼저** — id 가 깨지면 참조 검사가 의미 없다 |
| V-P01 | 엣지 `from`/`to`, `burst.triggerNodeIds[i]` 가 `byId` 에 없음 | `path.edges[{i}] — 노드 "{id}" 가 없다` / `burst.triggerNodeIds[{i}] — 노드 "{id}" 가 없다` (❌) |
| V-P02 | `starts = nodes.filter(role==='start')`, `exits = …exit` | `start 노드가 {n}개다. 정확히 1개여야 한다` (❌) / `exit 노드가 없다` (❌) / `exit 노드가 {n}개다. 게임은 첫 번째({id})만 쓴다` (⚠️) |
| V-P07 | 노드 셀 `c = cellAt(map,x,y)`. `role∈{start,exit,waypoint}` 이고 `c !== Road` → ❌. `role==='branch'` 이고 `!isAllyWalkable(c)` → ❌. 맵 밖(`!inBounds`) → ❌ | `path.nodes[{i}] "{id}" — ({x},{y}) 는 {셀이름} 이다. {start/exit/waypoint} 노드는 도로(R) 위에 있어야 한다` / `… branch 노드는 통행 가능한 칸(. B V)에 있어야 한다` / `… 맵 밖이다` |
| V-P03 | 비지름길이고 양 끝 role 이 `branch` 가 아닌 엣지: `(x0===x1) || (y0===y1)` 이 아니면 ❌ "대각선". 축 정렬이면 두 끝 사이(끝 포함) 모든 칸이 `Road` 인지. 아니면 ❌ | `path.edges[{i}] {from}→{to} — 대각선 엣지다. 일반 엣지는 가로 또는 세로여야 한다 (코너에 노드를 놓아라)` / `path.edges[{i}] {from}→{to} — 도로 밖 칸 ({x},{y}) 을 지난다` `cells` = 위반 칸 |
| V-P04 | `shortcut && !(allowed.length===1 && allowed[0]==='Escortee')` | `path.edges[{i}] — 지름길인데 allowed 가 "{allowed}" 다. 지름길은 보호대상(Escortee)만 지나간다 (ADR-0004)` (❌) |
| V-P08 | 키 `k = bidirectional ? min(from,to)+'|'+max(from,to) : from+'>'+to`. 방향 엣지 `a>b` 와 양방향 `a|b` 도 충돌로 본다: 양방향 키 집합에 `{a,b}` 가 있고 방향 `a>b` 또는 `b>a` 가 있으면 충돌 | `path.edges[{i}] — {from}↔{to} 가 path.edges[{j}] 와 중복이다. 양방향 엣지는 한 번만 적는다` (❌) |
| V-P05 | `shortestPath(g, start, exits[0], 'Escortee') === null` → ❌. `shortestPath(g, start, exits[0], 'Enemy') === null` → ❌ (지름길은 닫힌 그래프) | `start "{s}" 에서 exit "{e}" 까지 보호대상이 갈 수 있는 경로가 없다` / `… 적(Enemy)이 갈 수 있는 경로가 없다. 모체가 얼어붙는다` |
| V-P06 | 트리거 id 의 role 이 `start` 또는 `exit` | `burst.triggerNodeIds[{i}] "{id}" 는 {start/exit} 노드다. 시작 즉시/도착 후 버스트는 의미가 없다` (⚠️) |

### 3-4. S

| ID | 알고리즘 | 메시지 |
|---|---|---|
| V-S01 | `!ctx.enemyCatalog.has(entry.enemy)`. 심각도 `ctx.mode==='tool' ? warning : error` | `spawn.table[{i}].enemy "{name}" 을 찾지 못했다. 있는 것: {catalog 를 콤마로}` |
| V-S02 | `weight < 0` 인 행 있음, 또는 `sum(weight) === 0`, 또는 `table.length === 0` | `spawn.table[{i}] — 가중치 {w} 는 음수일 수 없다` / `spawn.table — 가중치 합이 0 이다. 아무것도 스폰되지 않는다` / `spawn.table 이 비었다` (❌) |
| V-S03 | SDD-02 §4 표의 범위. 각 필드마다 `path` 를 그 필드 경로로 | `{path} = {v} — {조건 설명, 예: 1 이상이어야 한다}` (❌) |
| V-S04 | `difficulties` 에서 `Easy/Normal/Hard` 각각 정확히 1개, 그 외 값 없음 | `economy.difficulties — {name} 이 {n}개다 (정확히 1개)` / `economy.difficulties[{i}] — "{d}" 는 Easy/Normal/Hard 가 아니다` (❌) |
| V-S05 | `healthByProgress` 가 비었거나, `t` 가 `[0,1]` 밖, `t[i] <= t[i-1]`, `mul <= 0` | `spawn.healthByProgress[{i}] — t={t} 는 이전 키({prev})보다 커야 한다` 등 (❌) |

V-S03 의 조건표 (`path` → 조건): `escortee.speed > 0`, `escortee.maxHealth > 0`, `mother.speed > 0`, `mother.spawnDelay >= 0`, `spawn.volleyCount >= 1 && 정수`, `spawn.volleySpacing >= 0`, `spawn.restSeconds > 0`, `spawn.telegraphSeconds >= 0`, `burst.duration >= 0`, `burst.volleyCount >= 1 && 정수`, `burst.restSeconds >= 0`, `burst.recoverySpeedMultiplier >= 1`, `burst.recoverySeconds >= 0`, `economy.startingResource >= 0 && 정수`, `economy.shortcutCost >= 0 && 정수`, `economy.difficulties[i].killReward >= 0`, `economy.difficulties[i].resourcePerSecond >= 0`, `presentation.uiSlowMotionScale ∈ (0,1]`, `presentation.shotLineSeconds >= 0`, `presentation.magicMissileSpeed >= 0.1`, `presentation.hitFlashSeconds >= 0`, `presentation.debrisCount >= 0 && 정수`, `presentation.debrisSeconds >= 0`, `presentation.masterVolume ∈ [0,1]`.

### 3-5. B

| ID | 알고리즘 | 메시지 |
|---|---|---|
| V-B01 | `mother.speed >= escortee.speed` | `mother.speed {m} ≥ escortee.speed {e} — 모체가 보호대상을 따라잡는다. 게임이 거부한다` (❌) |
| V-B02 | `triggerNodeIds` 중복 | `burst.triggerNodeIds — "{id}" 가 {n}번 있다. 두 번째부터는 무시된다` (⚠️) |
| V-B03 | `burst.volleyCount <= spawn.volleyCount` | `burst.volleyCount {b} ≤ spawn.volleyCount {s} — 버스트가 평시보다 약하면 "최대 부하 구간" 이 아니다` (⚠️) |

### 3-6. 검증

규칙마다 `docs/fixtures/invalid/<ID>.toon` 이 **정확히 그 ID 하나** 를 error/warning 으로 내고 다른 ❌ 는 없다 (`minimal.toon` 은 이슈 0 이어야 하므로 V-M06 의 ℹ️ 만 허용). 픽스처를 만들 때 `minimal.toon` 에서 한 군데만 바꾼다.

## 4. 기하 (`core/geometry`) `[D-09-04]`

### 4-1. 브러시

```
brushCells(map, cx, cy, size):
  r = (size-1)/2
  for y in cy-r..cy+r: for x in cx-r..cx+r: if inBounds → push
```
(순서 y 오름차순, x 오름차순. `paintCells` 가 중복을 제거하므로 스트로크 중 겹쳐도 된다.)

### 4-2. 선 — 정수 Bresenham, **양 끝 포함, 대칭 아님을 감수**

```
lineCells(map, x0,y0,x1,y1):
  dx=|x1-x0|, dy=-|y1-y0|, sx = x0<x1?1:-1, sy = y0<y1?1:-1, err=dx+dy
  loop: push(x0,y0) if inBounds; if x0==x1&&y0==y1 break
        e2=2*err; if e2>=dy {err+=dy; x0+=sx}; if e2<=dx {err+=dx; y0+=sy}
```
선 도구는 항상 (첫 클릭 → 현재 커서) 방향으로 호출하므로 대칭성이 필요 없다. 브러시 크기가 3·5 면 선 위 각 칸에 `brushCells` 를 펼친다.

### 4-3. 사각

`x0..x1`, `y0..y1` 을 정렬 후 채움. `outlineOnly` 면 경계 칸만. 결과는 y, x 오름차순, 중복 없음.

### 4-4. 플러드필 — 반복(스택), 4-연결

```
floodFill(map, sx, sy, same):
  if !inBounds(sx,sy) || !same(cellAt(sx,sy)) → []
  seen = new Uint8Array(w*h); stack=[idx(sx,sy)]; seen[...] = 1; out=[]
  while stack: i = stack.pop(); x=i%w; y=(i-x)/w; out.push({x,y})
    for (nx,ny) of [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
      if inBounds && !seen[j] && same(cellAt(nx,ny)) → seen[j]=1; stack.push(j)
  out.sort(y, x)
```
재귀 금지 (256×256 에서 스택 넘침).

### 4-5. 도달 영역 `computeReachability(map)`

```
villages = findCells(map, VillageSlot)
regionOf = Int32Array(w*h).fill(-1); regions = 0; perVillage=[]
for (k, v) of villages:
  if regionOf[idx(v)] !== -1 → perVillage.push({village:v, region: regionOf[idx(v)], buildable: (그 구역의 B 수)}); continue
  cells = floodFill(map, v.x, v.y, isAllyWalkable)          // R, W, ~, _ 는 벽
  for c of cells: regionOf[idx(c)] = regions
  buildable = cells.filter(cell===Buildable).length
  perVillage.push({village:v, region:regions, buildable}); regions++
reachableBuildable = count(cell===Buildable && regionOf!==-1); totalBuildable = counts[Buildable]
```
씨앗 기대값: `villages = [(27,9),(10,13)]` (findCells 순서 = y 오름차순), 구역 1개(둘 다 region 0), 구역 크기 205, `reachableBuildable 203`, `totalBuildable 381`, 도달 불가 178.

### 4-6. 축 정렬 도로 검사 (V-P03)

```
roadCheck(map, a: XY, b: XY): { diagonal: true } | { offRoad: XY[] }
  if a.x !== b.x && a.y !== b.y → { diagonal: true }
  cells = a.x === b.x ? [ (a.x, y) for y in min..max ] : [ (x, a.y) for x in min..max ]
  return { offRoad: cells.filter(c => cellAt(map, c) !== Road) }
```

## 5. 그래프 (`core/graph`) `[D-09-05]`

### 5-1. 구성

```
buildGraph(path, {openShortcuts}):
  nodes = path.nodes.map((n,i) => ({...n, index:i}))      // 파일 순서 = index. 정렬하지 않는다
  byId = Map(id → index)
  out = nodes.map(() => [])
  for (si, e) of path.edges:
    f = byId.get(e.from), t = byId.get(e.to)              // V-P01 통과를 전제. 없으면 throw
    if e.shortcut && !openShortcuts → continue            // 닫힌 지름길은 그래프에 없다
    cost = hypot(nodes[t].x - nodes[f].x, nodes[t].y - nodes[f].y)   // 셀 중심 간 거리 = 정수 좌표 차의 유클리드
    bits = e.allowed 가 'All' 이면 7, 아니면 OR(AGENT_BIT)
    out[f].push({from:f, to:t, cost, allowed:bits, shortcut:e.shortcut, sourceIndex:si})
    if e.bidirectional → out[t].push({from:t, to:f, ... 같은 값})
```
`allowed` 문자열 파싱: `'All'` → `['Escortee','Enemy','Ally']`; 그 외 `split('+')` 각 토큰이 세 이름 중 하나여야 한다 (아니면 디코더 V-F03). 직렬화: 세 개 다 있으면 `All`, 아니면 **고정 순서** `Escortee+Enemy+Ally` 중 있는 것만.

### 5-2. 다익스트라 — 배열 스캔, 동률은 낮은 index

```
dijkstra(g, from, agent):
  n = g.nodes.length; dist = Float64Array(n).fill(Infinity); prev = Int32Array(n).fill(-1); done = Uint8Array(n)
  dist[from] = 0
  repeat n times:
    u = -1; for i in 0..n-1: if !done[i] && dist[i] < Infinity && (u===-1 || dist[i] < dist[u]) → u = i   // 동률: 먼저 온 낮은 index 유지
    if u === -1 break
    done[u] = 1
    for e of g.out[u]: if (e.allowed & bit(agent)) === 0 → continue
      nd = dist[u] + e.cost
      if nd < dist[e.to] - 1e-9 → dist[e.to] = nd; prev[e.to] = u     // 왜 1e-9: 부동소수 동률을 "먼저 온 것" 으로 고정
```
노드 수십 개라 O(n²) 로 충분하다. 힙을 쓰지 마라 — 동률 순서가 구현마다 달라져 결정론이 깨진다.

`shortestPath`: `dist[to] === Infinity → null`, 아니면 `prev` 를 따라 역추적 후 뒤집기.

### 5-3. 최근접 노드

```
nearestNode(g, pos, agent):
  best=-1; bestD=Infinity
  for node of g.nodes:
    usable = g.out[node.index].some(e => e.allowed & bit) || g.nodes.some(m => g.out[m.index].some(e => e.to===node.index && (e.allowed & bit)))
    if !usable → continue                         // agent 가 드나들 수 있는 엣지가 하나도 없는 노드는 제외
    d = hypot(node.x - pos.x, node.y - pos.y)     // pos 는 셀 중심 기준 연속 좌표 (노드 (x,y) 의 중심이 정확히 (x,y))
    if d < bestD - 1e-9 → best=node.index; bestD=d
  return best===-1 ? null : best
```
⚠️ 게임 `PathGraph.FindNearestNode` 의 필터 규칙은 확인하지 못했다. **M4 에서 대조** 하고 다르면 여기와 SDD-04 를 고친다.

## 6. 좌표 규약 (시뮬·렌더 공통) `[D-09-06]`

- 연속 좌표 `(px, py)` 의 단위는 **셀**. 셀 `(x,y)` 의 중심 = `(x, y)` (정수). 셀의 범위는 `[x-0.5, x+0.5)`.
  왜 `x+0.5` 가 아니라 `x` 인가: 노드가 정수 좌표에 놓이고 거리 계산이 정수 차로 나오게. 게임 월드 좌표로 바꾸려면 `origin + (px+0.5, py+0.5)` — 툴은 상태줄 표시 외에 월드 좌표를 쓰지 않는다.
- 화면 좌표는 §9.

## 7. 시뮬레이션 (`core/sim`) `[D-09-07]`

### 7-1. PRNG — mulberry32

```
mulberry32(seed: number): () => number    // [0,1)
  a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
```

### 7-2. 스폰 표 추첨 (게임 `PickFromSpawnTable` 과 동일)

```
pick(table, rnd): total = Σ weight; r = floor(rnd() * total); for e of table: if r < e.weight → return e.enemy; r -= e.weight
```
(`weight` 는 정수. `rnd()*total` 은 `[0,total)`.) 표 순서는 파일 순서.

### 7-3. 상태

```
escortee: { pos: XY, route: number[] /* 노드 index 열 */, seg: number /* route[seg]→route[seg+1] 진행 중 */, t: number /* 0..1 */, arrived: boolean, lastNode: number }
mother:   { pos, state: 'idle'|'chasing'|'burst', idleLeft, route, seg, t, currentNode, burstLeft, recoveryLeft, burstSpawned, firedTriggers: Set<number> }
rhythm:   { phase: 'rest'|'volley', restLeft, volleyLeft, spacingLeft }
enemies:  { name, speed, pos, route, seg, t, currentNode, targetNode }[]
graphClosed = buildGraph(path, {openShortcuts:false}); graphOpen = buildGraph(path, {openShortcuts:true})
```

### 7-4. 초기화

```
start = index of role 'start'; exit = index of first role 'exit'
escortee.pos = node[start]; escortee.route = shortestPath(graphClosed, start, exit, 'Escortee'); seg=0; t=0; lastNode=start
mother.pos = node[start]; state='idle'; idleLeft = mother.spawnDelay; currentNode=start
rhythm = { phase:'rest', restLeft: spawn.restSeconds, … }      // A2 ✅확인: Idle 이 끝나면 첫 휴지를 채우고 첫 묶음 (MotherSpawner.cs:231-240)
rnd = mulberry32(seed); time = 0; samples=[]; spawnEvents=[]; contacts=[]; bursts=[]
```

### 7-5. 스텝 — 이 순서 그대로

```
while !escortee.arrived && time < maxSeconds:
  // 1. 지름길 개방
  if shortcutOpenAt !== null && time >= shortcutOpenAt && !opened: opened=true; escortee.route = shortestPath(graphOpen, escortee.lastNode, exit, 'Escortee') (현재 seg 의 다음 노드부터 이어 붙임 — §7-6); onEscorteeNode()
  // 2. 보호대상 이동
  moveAlong(escortee, escortee.speed*dt) → 노드 도달마다 onEscorteeNode(node)
  // 3. 모체 상태
  switch mother.state:
    idle:    idleLeft -= dt; if idleLeft <= 0 → state='chasing'; recalcMother()
    chasing: speed = mother.speed * (recoveryLeft > 0 ? burst.recoverySpeedMultiplier : 1); recoveryLeft = max(0, recoveryLeft-dt)
             moveAlong(mother, speed*dt); if mother.followsPath===false → 직진: pos += normalize(escortee.pos - pos) * speed*dt
    burst:   burstLeft -= dt; if burstLeft <= 0 → exitBurst()
  // 4. 스폰 리듬 (idle 이 아닐 때만 — A1 ✅확인: Idle 은 MoveAndSpawn 을 부르지 않는다, MotherSpawner.cs:231-240)
  if mother.state !== 'idle': tickRhythm(dt)
  // 5. 적 이동·접촉
  for e of enemies: moveAlong(e, e.speed*dt); if dist(e.pos, escortee.pos) <= 0.5 → contacts.push({t:time, enemy:e.name}); remove
  // 6. 샘플 (0.5초마다, 첫 스텝 포함)
  // 7. time += dt
```

`onEscorteeNode(node)`:
```
escortee.lastNode = node
if node ∈ burst.triggerNodeIds(index) && !mother.firedTriggers.has(node) && mother.state==='chasing':
   mother.firedTriggers.add(node); enterBurst(node)
if mother.state==='chasing': recalcMother()
for e of enemies: recalcEnemy(e)
```

`enterBurst(node)`: `state='burst'; burstLeft=burst.duration; burstSpawned=0;`
**`rhythm = {phase:'volley', volleyLeft: burst.volleyCount, spacingLeft: 0}`** — 휴지 없이 **즉시 묶음**을 시작한다.
출처: `MotherSpawner.EnterBurst` (`:184-186`) — `_phase = SpawnPhase.Volley; _volleyRemaining = BurstVolleyCount; _spacingTimer = 0f;`.
버스트 리듬은 `burst.volleyCount / burst.restSeconds`, `volleySpacing` 은 평시 값 그대로 (게임에 버스트용 spacing 필드가 없다).

> 🔴 **정정 2026-09-04.** 초판은 `phase:'rest'` 로 적었다. 게임 코드를 열어 보니 틀렸다. 진행 중이던 예고·묶음을 접고 곧바로 생산에 들어가는 것이 "추적 에너지를 생산으로 전환" 이라는 설계 의도와도 맞는다.

`exitBurst()` (게임 `ExitBurst` 그대로):
```
rate = spawn.volleyCount / ((spawn.volleyCount-1)*spawn.volleySpacing + spawn.restSeconds)
expected = rate * burst.duration; debt = max(0, burstSpawned - expected)
payback = min(debt / rate, burst.duration * 2)
rhythm = { phase:'rest', restLeft: max(spawn.restSeconds, payback) }
recoveryLeft = burst.recoverySeconds; state='chasing'; recalcMother()
bursts.push({triggerId, start, end: time, spawned: burstSpawned, payback})
```

`tickRhythm(dt)`:
```
params = state==='burst' ? {n: burst.volleyCount, rest: burst.restSeconds} : {n: spawn.volleyCount, rest: spawn.restSeconds}
if phase==='rest': restLeft -= dt; if restLeft <= 0 → phase='volley'; volleyLeft=params.n; spacingLeft=0
if phase==='volley':
   spacingLeft -= dt
   while spacingLeft <= 0 && volleyLeft > 0:
      spawnOne(); volleyLeft--
      if volleyLeft > 0: spacingLeft += spawn.volleySpacing     // 왜: 마지막 한 마리 뒤에는 더하지 않는다
   if volleyLeft === 0 → phase='rest'; restLeft = params.rest    // 이월하지 않는다
```
출처: `MotherSpawner.UpdateSpawnRhythm` (`:352-364`) — `if (_volleyRemaining > 0) _spacingTimer += SpawnVolleySpacing;` 와 `_restTimer = restSeconds;`.

> 🔴 **정정 2026-09-04.** 초판은 마지막 한 마리 뒤에도 간격을 더하고 남은 시간을 휴지에 이월했다. 게임은 둘 다 하지 않는다.
> 이 차이로 평시 사이클이 `n*spacing + rest`(9.8초)가 되어 게임의 `(n-1)*spacing + rest`(9.4초)보다 길어진다.

한 스텝에 여러 마리가 나올 수 있다 (`spacing 0.4 < dt` 는 아니지만 일반화). `spawnOne`: `name = pick(table, rnd)`; `enemies.push({name, speed: catalog[name].moveSpeed, pos: mother.pos, currentNode: mother.currentNode})`; `recalcEnemy`; `spawnEvents.push`; `if state==='burst' burstSpawned++`. 카탈로그에 없는 이름이면 `speed = 1` + warnings (V-S01 은 경고이므로 시뮬은 돈다).

### 7-6. 경로 추종 `moveAlong(actor, d)`

```
while d > 0 && actor.route && actor.seg < actor.route.length-1:
  a = node[route[seg]], b = node[route[seg+1]]; L = hypot(b-a)
  remain = (1 - actor.t) * L
  if d < remain: actor.t += d/L; d = 0
  else: d -= remain; actor.seg++; actor.t = 0; actor.currentNode = route[seg]; onReach(actor, route[seg])
actor.pos = lerp(a, b, t)   // seg 가 끝이면 pos = 마지막 노드
```
보호대상: `onReach` 가 `onEscorteeNode`, 마지막 노드(exit)에 닿으면 `arrived=true`.
모체·적의 재계산(`recalcMother`/`recalcEnemy`): `target = nearestNode(graphClosed, escortee.pos, 'Enemy')`; 새 경로 = `shortestPath(graphClosed, nextNode, target, 'Enemy')` 여기서 `nextNode = seg 진행 중이면 route[seg+1] 아니면 currentNode`. 진행 중이던 구간은 그대로 마저 가고 그 다음부터 새 경로를 따른다 (`route = [route[seg], ...newPath]`, `seg=0`, `t` 유지). 경로가 `null` 이면 제자리 (V-P05 가 막지만 방어).
왜 이렇게: 게임 `PathFollower` 의 정확한 중간 재계산 규칙은 미확인. 중간에 되돌아가지 않는 가장 단순한 규칙을 택했다. **M4 에서 대조.**

### 7-7. 출력 조립

`stageSeconds = time`, `totalSpawned = spawnEvents.length`, `spawnedByEnemy`, `incomeCeiling[d] = economy.startingResource + tier(d).killReward * totalSpawned + tier(d).resourcePerSecond * stageSeconds` (반올림 없이 소수 그대로; UI 가 소수 첫째 자리로 표시), `samples` (0.5초 간격 + 마지막), `bursts`, `contacts`, `warnings`.

### 7-8. 검증

- 씨앗 + `{seed:1, dt:1/30, shortcutOpenAt:null}` → `stageSeconds ∈ [115.4, 122.6]`, `totalSpawned ∈ [54, 58]`, `incomeCeiling.Normal ∈ [392, 412]`.
- 같은 입력 두 번 → `SimResult` deepEqual (결정론).
- `shortcutOpenAt = 30` → `stageSeconds` 가 감소한다.
- 회귀가 어긋나면 **§7-6 재계산 규칙·`nearestNode` 필터** 를 게임 코드로 확정하고 이 문서를 고친다. **기대값을 슬쩍 넓히지 마라.**
  허용 범위를 바꾸는 것은 규격 변경이므로 이 문서를 고치고 근거(게임 코드 라인)를 남긴 커밋에서만 한다.

> 🔴 **미해결 (2026-09-04).** A1·A2·enterBurst·묶음 종료를 게임 코드로 전부 맞춘 뒤에도 실측은
> **판 길이 119.07(정확) · 총 스폰 52 · 수입 384** 로, 기대(56 / 402)에 4기 모자란다.
> 남은 후보: `PathFollower` 의 중간 재계산 규칙(§7-6), `PathGraph.FindNearestNode` 의 필터(§5-3),
> 버스트 트리거 발화 시각. **이 항목을 닫기 전에는 시뮬 회귀 테스트가 빨간불인 것이 정상이다.**

## 8. 커맨드와 히스토리 (`core/commands`) `[D-09-08]`

### 8-1. `paintCells`

```
paintCells(map, changes, label):
  delta = new Map<index, {before:Cell, after:Cell}>()
  for c of changes: i = indexOf(c); b = cellAt(c); if b !== c.cell → delta.set(i, {before:b, after:c.cell})   // 같은 칸이 두 번 오면 마지막 after, 첫 before
  apply(doc)  = withCells(doc.map, delta → after)
  revert(doc) = withCells(doc.map, delta → before)
  coalesce(next): next 가 paintCells 이면 merged = new Map(delta); for (i,d) of next.delta: merged.has(i) ? merged.get(i).after = d.after : merged.set(i, d); return paintCells-from-delta(merged, label)
  label 은 `${셀이름} 칠하기 ${delta.size}칸` — coalesce 후 갱신
```

### 8-2. `History`

```
push(cmd):
  next = cmd.apply(doc)
  if inStroke && undoStack.length && undoStack.top.coalesce: merged = top.coalesce(cmd); if merged → undoStack.top = merged; doc = next; redoStack=[]; return
  undoStack.push(cmd); redoStack = []; doc = next
undo(): cmd = undoStack.pop(); doc = cmd.revert(doc); redoStack.push(cmd)
redo(): cmd = redoStack.pop(); doc = cmd.apply(doc); undoStack.push(cmd)
beginStroke(): inStroke=true; strokeStart = undoStack.length
endStroke(): inStroke=false
dirty = (undoStack.length !== savedDepth) — markSaved(): savedDepth = undoStack.length   // undo 로 저장 시점에 돌아오면 dirty=false
```
스트로크 중 첫 push 는 top 과 합치지 않는다 (top 은 이전 스트로크) — `strokeStart === undoStack.length` 이면 coalesce 를 건너뛴다.

### 8-3. `deleteNode` / `renameNode`

```
deleteNode(doc, id):
  removedEdges = edges.filter(e => e.from===id || e.to===id) (원래 index 와 함께)
  removedTriggers = triggerNodeIds 에서 id 의 위치들
  apply:  nodes 에서 제거, edges 필터, triggerNodeIds 필터
  revert: nodes 원래 위치에 삽입, edges 원래 index 에 삽입(오름차순으로), triggerNodeIds 원래 위치에 삽입
renameNode(doc, id, newId):
  apply:  node.id, edges.from/to, triggerNodeIds 의 id → newId  (newId 가 이미 있으면 throw — UI 가 먼저 막는다)
  revert: 반대
```

### 8-4. `resizeMap(doc, W, H, anchor)`

```
dx = anchor 가 w/nw/sw → 0 ; n/c/s → floor((W - w)/2) ; e/ne/se → W - w
dy = anchor 가 s/sw/se → 0 ; w/c/e → floor((H - h)/2) ; n/nw/ne → H - h      // y 는 아래가 0 이므로 's' 가 0
new cells = Empty 로 채운 뒤 for (x,y) of old: nx=x+dx, ny=y+dy; if 0<=nx<W && 0<=ny<H → copy
nodes: 좌표를 (x+dx, y+dy) 로 옮긴다. 맵 밖으로 나가면 **그대로 둔다** (V-P07 이 잡는다)
origin: [ox - dx, oy - dy]    // 왜: 살아남은 칸의 월드 좌표를 유지한다
revert: 옛 map·nodes 를 통째로 기억 (크기 변경은 드물어 스냅샷이 싸다)
```

## 9. 렌더 (`ui/canvas`) `[D-09-09]`

### 9-1. 뷰 변환 (`view.ts` 외 다른 파일에 이 수식이 있으면 안 된다)

```
S = CELL_PX * zoom
cellToScreen(x, y, map): sx = panX + x * S ; sy = panY + (map.height - 1 - y) * S      // 셀 좌상단. y 뒤집기
screenToCell(sx, sy, map): fx = (sx - panX) / S ; fyTop = (sy - panY) / S
                           x = floor(fx) ; y = map.height - 1 - floor(fyTop) ; 소수 fx-floor(fx), fyTop-floor(fyTop)
zoomAt(sx, sy, factor):    z2 = clamp(zoom*factor, 0.25, 8)   // 왜 이 범위: 256칸 맵을 8px 로, 8칸 맵을 256px 로
                           panX = sx - (sx - panX) * (z2/zoom) ; panY = sy - (sy - panY) * (z2/zoom) ; zoom = z2
fitToMap(map, vw, vh):     zoom = clamp(min(vw/(map.width*CELL_PX), vh/(map.height*CELL_PX)) * 0.95, 0.25, 8)
                           panX = (vw - map.width*S)/2 ; panY = (vh - map.height*S)/2
```
휠 한 칸 = `factor 1.1` (`deltaY < 0`) 또는 `1/1.1`.

### 9-2. 레이어와 더티 영역

각 `LayerCanvas` 의 크기는 `map.width*CELL_PX × map.height*CELL_PX` (줌 무관, 맵이 바뀌면 재생성). 그리기는 셀 픽셀 단위.

| 레이어 | 다시 그리는 때 | 내용 |
|---|---|---|
| tiles | `history.doc.map.cells` 참조가 바뀌면. 변경된 셀의 경계 사각형만 (`paintCells` 의 delta 범위를 Store 가 `dirtyRect` 로 전달; 없으면 전체) | `fillRect(x*32, (h-1-y)*32, 32, 32, COLOR[cell])`. Empty 는 그리지 않는다(배경이 보인다) |
| reach/issues (overlay) | `reach`·`issues`·`selection` 이 바뀌면 전체 | 도달 가능 B 에 마을 구역 색 α0.25, 도달 불가 B 에 빗금(대각선 4px 간격), 오류 셀 빨간 테두리 2px, 경고 노란, 선택 영역 파란 점선 |
| objects (path+objects) | `path` 참조 또는 선택이 바뀌면 전체 | 엣지(선 2px, 화살촉 8px, 지름길은 `setLineDash([8,8])`), 노드(원 r=8, role 색), 트리거 노드에 ⚡ 글자, 마을 마커(1.4셀 사각), start 에 하트+모체 사각, exit 에 노란 테두리 |
| sim | `sim` 또는 재생 시각이 바뀌면 전체 | 궤적(폴리라인), 현재 위치 마커 |

합성 (`Renderer.frame`):
```
ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = BACKGROUND; ctx.fillRect(0,0,vw,vh)
ctx.imageSmoothingEnabled = false          // 왜: 축소·확대 시 셀 경계가 번지지 않게
for layer of [tiles, overlay, objects, sim] if visible: ctx.drawImage(layer.canvas, panX, panY, map.width*S, map.height*S)
if showGrid && S >= 8: 셀 경계선 (1px, UI.grid), 5칸마다 UI.gridMajor, 가장자리에 좌표 숫자 (S >= 16 일 때만)
도구 프리뷰: tool.preview() 의 cells 를 α0.5 로 팔레트 색, line/rect 는 외곽선
```
`requestFrame()` 은 `requestAnimationFrame` 을 한 번만 예약한다 (플래그).

### 9-3. HiDPI

`ResizeObserver` 로 `#canvas-wrap` 의 CSS 크기 `(vw, vh)` 를 얻고 `canvas.width = vw*dpr`, `canvas.height = vh*dpr`, `canvas.style.width = vw+'px'`. `dpr = window.devicePixelRatio`. 레이어 캔버스는 dpr 을 모른다 (합성 시 `setTransform` 이 처리).

### 9-4. 미니맵

`tiles` 레이어를 `#minimap-canvas` 에 `drawImage` 로 축소(가로 200px 고정, 비율 유지) + 뷰포트 사각형(`screenToCell` 로 화면 네 귀퉁이 → 셀 → 미니맵 좌표) + 노드 점(2px). 클릭/드래그 → `panX/panY` 를 그 셀이 화면 중심에 오도록.

## 10. 도구 상태기계 (`ui/input/tools`) `[D-09-10]`

공통: `pointerdown` 에서 `setPointerCapture`. 버튼 2(우클릭)는 `contextmenu` 를 막고 "지우개 셀" 로 동작. 입력 필드에 포커스가 있으면 캔버스 단축키 무시.

| 도구 | down | move | up | cancel |
|---|---|---|---|---|
| brush | `history.beginStroke()`; `last = cell`; shift 면 `lineCells(anchor→cell)` 를 칠함, 아니면 `brushCells`; `dispatch(paintCells)` | 버튼 눌린 상태면 `lineCells(last→cell)` 위 각 칸에 `brushCells` → `paintCells`; `last=cell` | `endStroke()`; `anchor = cell` | `endStroke()` |
| line / rect | `start = cell` | 프리뷰만 | `dispatch(paintCells(lineCells/rectCells(start→cell)))` 한 번 | 프리뷰 지움 |
| fill | `dispatch(paintCells(floodFill(cell, c => c === cellAt(cell))))` | — | — | — |
| select | `start = cell; selection = cells(start,start)` | `selection = cells(start, cell)` | — | selection none |
| eyedropper | `paletteCell = cellAt(cell)`; 이전 도구로 복귀 | — | — | — |
| node | 노드 위: `drag = id`; 빈 곳: `dispatch(addNode({id: nextId(), x, y, role:'waypoint'}))`, selection nodes | drag 중: 프리뷰 위치 | drag 였고 셀이 바뀌었으면 `dispatch(moveNode)` | drag 취소 |
| edge | 노드 위: `from = id` | 프리뷰 선 | 다른 노드 위: `dispatch(addEdge({from, to, allowed: shift?['Escortee']:['Escortee','Enemy','Ally'], bidirectional:true, shortcut: shift}))`. 같은 노드나 빈 곳: 아무것도 안 함 | — |
| object | 히트 테스트 순서: 노드(r 10px) → 엣지(선분 거리 6px) → 마을 셀 → 없음. ctrl 이면 nodes 에 추가/제거 | — | — | selection none |

`nextId()`: `used = Set(ids matching /^N(\d+)$/ 의 숫자)`; `k = 0; while used.has(k) k++`; `return 'N' + String(k).padStart(2,'0')`.

## 11. 파일 흐름 (`io` + `topbar`) `[D-09-11]`

```
열기: openFile() → decode(text) → ok ? history.replace(doc); fileName; fileHandle; clearDraft()
                                 : 다이얼로그(`${line}행: ${message}`), 문서 유지
저장: issues = validate(doc,{mode:'tool',catalog}); text = encode(doc,{toolVersion, issues})
      if issues.some(error) → 다이얼로그 "검증 실패 N건. 그래도 저장한다 (임포트는 되지 않는다)" [저장] [취소]
      handle = await saveFile(text, fileHandle, `${doc.name}.toon`); if handle → fileHandle; history.markSaved(); clearDraft()
초안: Store 가 history 변경 5초 디바운스로 saveDraft(encode(doc), fileName). 시작 시 loadDraft() 가 있고 savedAt 이 1시간 이내면 "복구할까요?" [복구] [버림]
beforeunload: history.dirty 면 브라우저 기본 확인
```

## 12. 검증·도달 영역 갱신 `[D-09-12]`

`Store.update` 에서 `history.doc` 참조가 바뀌면 100ms 디바운스로 `reach = computeReachability(map)`, `issues = validate(doc, ctx)` 를 계산해 한 번의 `update` 로 반영한다. `simStale = sim !== null`. 검증은 동기 함수이고 256×256 에서도 수 ms 다 — Web Worker 를 만들지 마라 (복잡도만 는다).
