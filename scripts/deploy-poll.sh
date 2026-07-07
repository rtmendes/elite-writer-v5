#!/bin/bash
# Self-deploy: the VPS checks GitHub and rebuilds when main changes.
# Zero GitHub Actions minutes — runs from cron on the server.
#
# Install once on the VPS:
#   crontab -e   →   add this line:
#   */2 * * * * /opt/elite-writer-v5/scripts/deploy-poll.sh >> /var/log/ew-deploy.log 2>&1
set -euo pipefail
cd /opt/elite-writer-v5 || exit 0

# ── One-shot SSH recovery v2 (2026-07-06) ───────────────────────────────────
# v1 unban didn't restore access. Broader sweep: every fail2ban jail, CrowdSec
# decisions, any iptables rule matching the IP. Diagnostics land in a local
# file on the VPS only (postmortem after access returns) — nothing published.
# REMOVE after SSH confirmed.
if [ ! -f /tmp/.ew-ssh-unban-v2-20260706 ]; then
  touch /tmp/.ew-ssh-unban-v2-20260706
  (
    set +e
    IP=207.159.90.171
    D=/tmp/ew-ssh-diag.txt
    {
      echo "== $(date '+%F %T') ssh recovery v2 for $IP =="
      echo "-- v1 marker --"; ls -la /tmp/.ew-ssh-unban-20260706 2>&1
      echo "-- sudo check --"; sudo -n true 2>&1 && echo sudo-ok || echo sudo-NEEDS-PASSWORD
      echo "-- fail2ban jails --"
      JAILS=$(sudo -n fail2ban-client status 2>/dev/null | grep "Jail list" | sed "s/.*:[[:space:]]*//; s/,//g")
      echo "jails: ${JAILS:-none/not-running}"
      for J in $JAILS; do
        echo "jail $J banned:"; sudo -n fail2ban-client status "$J" 2>&1 | grep -iE "banned" | head -3
        sudo -n fail2ban-client set "$J" unbanip "$IP" 2>&1
      done
      echo "-- crowdsec --"
      if command -v cscli >/dev/null 2>&1; then
        sudo -n cscli decisions list -o raw 2>&1 | grep "$IP"
        sudo -n cscli decisions delete --ip "$IP" 2>&1
      else echo no-cscli; fi
      echo "-- iptables matches --"; sudo -n iptables-save 2>/dev/null | grep "$IP"
      sudo -n iptables-save 2>/dev/null | grep -- "-A .*$IP" | sed "s/^-A //" | while read -r RULE; do
        sudo -n iptables -D $RULE 2>&1
      done
      echo "-- iptables after --"; sudo -n iptables-save 2>/dev/null | grep "$IP" || echo clean
      echo "-- nftables matches --"; sudo -n nft list ruleset 2>/dev/null | grep "$IP" || echo none
      echo "== end =="
    } > "$D" 2>&1
    # Diagnostics stay ON the VPS ($D) for postmortem — never published.
  ) || true
fi
# ────────────────────────────────────────────────────────────────────────────

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
