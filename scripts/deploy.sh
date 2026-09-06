#!/usr/bin/env bash
# 목적: 빌드 산출물 한 파일을 VPS 웹루트로 올린다.
# 왜 이 구조인가: 산출물이 `index.html` 하나뿐이라 scp 한 번이면 끝난다. 로컬(Windows/Git Bash)에
#   rsync 가 없어 디렉터리 동기화는 tar→scp→전개가 유일한 경로인데, 파일 하나에는 그 포장이
#   아무것도 보태지 않는다. 서버는 정적 파일만 내주므로 재시작할 프로세스도 없다.
# 바꾸면 안 되는 것: 서버에 백엔드를 얹지 마라 (ADR-E01). 여기서 하는 일은 파일 복사뿐이다.
#   올리기 전 `npm run build` 로 산출물을 최신화하는 책임은 호출자에게 있다 — 이 스크립트는
#   빌드하지 않는다. 낡은 dist 를 조용히 올리는 것보다 없으면 멈추는 편이 낫다.
# 근거: SDD-01 §9 [D-01-09], ADR-E01, mem:global/manjac_vps
set -euo pipefail

OUT="dist/pmf-editor.html"
# 왜 환경변수로 여는가: 호스트·웹루트는 인프라 사정이고 코드가 아니다. 서버를 옮길 때
#   이 파일을 고치는 대신 환경변수로 덮을 수 있어야 한다.
HOST="${PMF_DEPLOY_HOST:-root@manjac.co.kr}"
WEBROOT="${PMF_DEPLOY_ROOT:-/var/www/pmf-editor}"
URL="${PMF_DEPLOY_URL:-https://pmf.manjac.co.kr/}"

[ -f "$OUT" ] || { echo "[deploy] $OUT 이 없다. npm run build 를 먼저 돌려라."; exit 1; }

SIZE=$(wc -c < "$OUT")
echo "[deploy] $OUT ($((SIZE / 1024)) KB) → $HOST:$WEBROOT/index.html"

# 왜 원격에서 이름을 바꾸는가: 웹루트 파일명은 index.html 이어야 하고(SDD-01 §9),
#   로컬 파일명은 기획자에게 그대로 주는 이름이라 둘을 다르게 유지한다.
scp -q "$OUT" "$HOST:/tmp/pmf-editor.html"

# 소유자·권한은 매번 다시 맞춘다. 한 번 틀어지면 Caddy 가 403 을 내는데
# 원인이 매처처럼 보여서 찾는 데 오래 걸린다 (mem:global/manjac_vps).
ssh "$HOST" "set -e
  mkdir -p '$WEBROOT'
  mv /tmp/pmf-editor.html '$WEBROOT/index.html'
  chown -R www-data:www-data '$WEBROOT'
  chmod 755 '$WEBROOT'
  chmod 644 '$WEBROOT/index.html'"

echo "[deploy] 올렸다. 확인:"
# 왜 확인까지 하는가: "배포했다" 와 "브라우저에서 열린다" 는 다르다. 인증서·권한·헤더 중
#   하나만 어긋나도 기획자에게는 안 되는 URL 이 간다.
if curl -fsSI --max-time 20 "$URL" > /tmp/pmf-deploy-headers.txt 2>&1; then
  grep -iE '^(HTTP/|cache-control|content-length|content-type)' /tmp/pmf-deploy-headers.txt || true
  grep -qi 'cache-control:.*no-cache' /tmp/pmf-deploy-headers.txt \
    || echo "[deploy] ⚠️ Cache-Control: no-cache 가 없다. Caddyfile 을 확인하라 (SDD-01 §9)."
  echo "[deploy] ✅ $URL"
else
  echo "[deploy] ⚠️ $URL 을 열지 못했다. DNS·인증서·Caddy 사이트 블록을 확인하라."
  exit 1
fi
