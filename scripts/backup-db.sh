#!/bin/bash
# Nightly MySQL backup for elite-writer-v5. Keeps 14 days.
# Install on the VPS once:  crontab -e  →  add:
#   15 3 * * * /opt/elite-writer-v5/scripts/backup-db.sh >> /var/log/ew-backup.log 2>&1
set -euo pipefail
BACKUP_DIR="$HOME/backups/elite-writer"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M)
# DATABASE_URL format: mysql://user:pass@host:port/dbname
# Server env vars live in .env.production on the VPS (not .env)
URL=$(grep -E '^DATABASE_URL=' /opt/elite-writer-v5/.env.production | cut -d= -f2-)
DB_USER=$(echo "$URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$URL" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')
DB_NAME=$(echo "$URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')
# MySQL host alias only resolves on the coolify docker network
docker run --rm --network coolify mysql:8 mysqldump \
  -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --single-transaction --quick --no-tablespaces "$DB_NAME" \
  | gzip > "$BACKUP_DIR/ew-$STAMP.sql.gz"
ls -t "$BACKUP_DIR"/ew-*.sql.gz | tail -n +15 | xargs -r rm
echo "$(date) backup ok: ew-$STAMP.sql.gz ($(du -h "$BACKUP_DIR/ew-$STAMP.sql.gz" | cut -f1))"
