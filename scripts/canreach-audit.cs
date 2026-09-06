// M4 DoD: 도달 영역 4-연결 가정을 AllyUnit.CanReach 와 씨앗 맵 전수 대조.
// 근거: SDD-07 M4 [D-07-05], SDD-04 §130-131, SDD-06 §2
// 읽기 전용 — 씬·에셋을 저장하지 않는다. 끝에 GridSystem.Instance 를 원래대로 null 로 되돌린다.
// 왜 Awake 를 억지로 부르나: 에디트 모드에선 Awake 가 안 돌아 Instance 가 null 이고,
//   그러면 CanWalk 이 "grid == null -> return true" 로 전부 도달 가능이라 답한다 (가짜 초록불).

var bf = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
var gs = UnityEngine.Object.FindAnyObjectByType<PMF.Grid.GridSystem>(UnityEngine.FindObjectsInactive.Include);
if (gs == null) { UnityEngine.Debug.LogError("[audit] 씬에 GridSystem 이 없다"); return null; }
typeof(PMF.Grid.GridSystem).GetMethod("Awake", bf).Invoke(gs, null);

var grid = PMF.Grid.GridSystem.Instance;
if (grid == null) { UnityEngine.Debug.LogError("[audit] Instance 를 잡지 못했다 - 중단 (null 이면 CanWalk 이 전부 true 를 낸다)"); return null; }

// AllyWalkGraph 의 static 캐시를 비워 이 격자로 다시 짓게 한다.
var wg = typeof(PMF.Pathing.AllyWalkGraph);
wg.GetMethod("ResetStatics", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static).Invoke(null, null);

try {
  int W = grid.Width, H = grid.Height;
  System.Func<int,int,PMF.Grid.CellType> C = (x,y) => grid.GetCell(new PMF.Grid.GridCoord(x,y));
  System.Func<PMF.Grid.CellType,bool> walk = t => t==PMF.Grid.CellType.Ground || t==PMF.Grid.CellType.Buildable || t==PMF.Grid.CellType.VillageSlot;

  var villages = new System.Collections.Generic.List<PMF.Grid.GridCoord>();
  int bTotal=0, rTotal=0;
  for (int y=0;y<H;y++) for (int x=0;x<W;x++) {
    var t = C(x,y);
    if (t==PMF.Grid.CellType.VillageSlot) villages.Add(new PMF.Grid.GridCoord(x,y));
    if (t==PMF.Grid.CellType.Buildable) bTotal++;
    if (t==PMF.Grid.CellType.Road) rTotal++;
  }
  UnityEngine.Debug.Log($"[audit] 격자 {W}x{H}, 마을 {villages.Count}칸, B {bTotal}칸, R {rTotal}칸 (씨앗 기대: 32x18, V 2, B 381, R 51)");
  if (villages.Count == 0) { UnityEngine.Debug.LogError("[audit] 마을이 없다 - 타일맵 스캔이 비었을 수 있다. 중단"); return null; }

  int[] dx={1,-1,0,0}, dy={0,0,1,-1};
  int grandMismatch = 0;
  foreach (var v in villages) {
    // (A) 툴의 가정: 이 마을에서 {Ground,Buildable,VillageSlot} 4-연결 플러드필, Road 는 벽
    var seen = new bool[W*H];
    var q = new System.Collections.Generic.Queue<PMF.Grid.GridCoord>();
    seen[v.Y*W+v.X]=true; q.Enqueue(v);
    while(q.Count>0){ var c=q.Dequeue();
      for(int i=0;i<4;i++){ int nx=c.X+dx[i], ny=c.Y+dy[i];
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        if(seen[ny*W+nx]) continue;
        if(!walk(C(nx,ny))) continue;
        seen[ny*W+nx]=true; q.Enqueue(new PMF.Grid.GridCoord(nx,ny)); } }

    // (B) 게임의 진실: AllyUnit.CanReach (가시선 + 모서리 가시성 그래프 우회)
    var from = grid.CellToWorld(v);
    int agree=0, onlyTool=0, onlyGame=0, toolReach=0;
    var mm = new System.Text.StringBuilder();
    for (int y=0;y<H;y++) for (int x=0;x<W;x++) {
      if (C(x,y) != PMF.Grid.CellType.Buildable) continue;   // V-M06/V-M07 이 세는 대상
      bool a = seen[y*W+x];
      bool b = PMF.Actors.AllyUnit.CanReach(from, grid.CellToWorld(new PMF.Grid.GridCoord(x,y)));
      if (a) toolReach++;
      if (a==b) agree++;
      else { if(a) onlyTool++; else onlyGame++;
        if (mm.Length < 1200) mm.Append($"({x},{y}) tool={a} game={b}\n"); }
    }
    grandMismatch += onlyTool + onlyGame;
    UnityEngine.Debug.Log($"[audit] 마을({v.X},{v.Y}): 툴 도달 B {toolReach}/{bTotal} | 일치 {agree} | 툴만 {onlyTool} | 게임만 {onlyGame}");
    if (mm.Length>0) UnityEngine.Debug.Log($"[audit] 마을({v.X},{v.Y}) 불일치 좌표:\n"+mm.ToString());
  }
  UnityEngine.Debug.Log(grandMismatch==0
    ? "[audit] 결론: 불일치 0 - 4-연결 가정이 CanReach 와 전 칸에서 일치한다"
    : $"[audit] 결론: 불일치 {grandMismatch}칸 - SDD-04 §130-131 을 고쳐야 한다");
}
finally {
  // 에디터 상태 원복
  typeof(PMF.Grid.GridSystem).GetMethod("OnDestroy", bf).Invoke(gs, null);
  wg.GetMethod("ResetStatics", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static).Invoke(null, null);
  UnityEngine.Debug.Log("[audit] 정리 완료 - GridSystem.Instance 를 null 로 되돌렸다");
}
return null;
