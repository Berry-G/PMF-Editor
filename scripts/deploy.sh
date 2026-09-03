#!/usr/bin/env bash
# 목적: 빌드 산출물 한 파일을 VPS 웹루트로 올린다. (M2 첫 배포에서 경로 확정)
# 왜 이 구조인가: 로컬(Windows/Git Bash)에 rsync 가 없어 tar → scp → 원격 전개가 유일한 경로다.
#   서버는 정적 파일만 내주므로 재시작할 프로세스가 없다.
# 바꾸면 안 되는 것: 서버에 백엔드를 얹지 마라 (ADR-E01). 여기서 하는 일은 파일 복사뿐이다.
# 근거: SDD-01 §9 [D-01-09], ADR-E01, mem:global/manjac_vps
set -euo pipefail

OUT="dist/pmf-editor.html"
[ -f "$OUT" ] || { echo "[deploy] $OUT 이 없다. npm run build 를 먼저 돌려라."; exit 1; }

# 왜 아직 비어 있나: 서브도메인과 웹루트를 M2 첫 배포 때 정한다 (SDD-07 M2).
#   지금 임의로 박아 두면 실제 배포 때 두 곳을 고쳐야 한다.
echo "[deploy] M2 에서 구현한다 — 서브도메인·웹루트 미정 (SDD-07 M2)."
echo "[deploy] 정해지면 이 파일에 다음을 넣는다:"
echo "         scp $OUT root@<host>:/var/www/pmf-editor/index.html"
exit 1
