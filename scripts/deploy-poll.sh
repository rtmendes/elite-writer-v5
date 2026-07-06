#!/bin/bash
# Self-deploy: the VPS checks GitHub and rebuilds when main changes.
# Zero GitHub Actions minutes — runs from cron on the server.
#
# Install once on the VPS:
#   crontab -e   →   add this line:
#   */2 * * * * /opt/elite-writer-v5/scripts/deploy-poll.sh >> /var/log/ew-deploy.log 2>&1
set -euo pipefail
cd /opt/elite-writer-v5 || exit 0

git config --global --add safe.directory /opt/elite-writer-v5 2>/dev/null || true
git fetch origin main --quiet || exit 0
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0   # already up to date — do nothing

echo "$(date '+%F %T') new commit $REMOTE — deploying"
git reset --hard origin/main
if docker compose build --no-cache elite-writer && docker compose up -d elite-writer; then
  sleep 12
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://elitewriter.insightprofit.live || echo 000)
  NEWS=$(curl -s --max-time 10 https://elitewriter.insightprofit.live/api/trpc/news.status || echo '(unreachable)')
  echo "$(date '+%F %T') deployed $REMOTE — HTTP $STATUS — news.status: $NEWS"
  if [ "$STATUS" != "200" ]; then
    echo "$(date '+%F %T') HEALTH CHECK FAILED — HTTP $STATUS for $REMOTE"
  fi
else
  echo "$(date '+%F %T') BUILD FAILED for $REMOTE — keeping previous container running"
fi
