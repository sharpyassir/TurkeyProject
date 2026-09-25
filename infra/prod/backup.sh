#!/bin/sh
# Runs inside the backup container: pg_dump every night at 02:15, keep BACKUP_KEEP_DAYS days locally,
# copy to S3 compatible storage when BACKUP_S3_URL is set (needs the aws cli image or rclone; see docs/hosting.md).
set -eu
mkdir -p /backups
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "tomorrow 02:15" +%s 2>/dev/null || echo $((now + 86400)))
  sleep $((next - now))
  f=/backups/pgcloud-$(date -u +%Y%m%d-%H%M).sql.gz
  if pg_dump -h postgres -U pgcloud pgcloud | gzip -6 > "$f.tmp"; then
    mv "$f.tmp" "$f"
    echo "backup written: $f ($(du -h "$f" | cut -f1))"
    find /backups -name 'pgcloud-*.sql.gz' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
    if [ -n "${BACKUP_S3_URL:-}" ] && command -v aws >/dev/null; then aws s3 cp "$f" "$BACKUP_S3_URL/" || echo "s3 upload failed"; fi
  else
    rm -f "$f.tmp"; echo "backup FAILED"
  fi
done
