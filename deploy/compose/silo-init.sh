#!/bin/sh
set -eu

bucket=$UPLOAD_S3_BUCKET
case "$bucket" in ''|*[!a-z0-9.-]*) echo 'Invalid upload bucket name' >&2; exit 1;; esac
if [ "$UPLOAD_S3_ACCESS_KEY_ID" = "$MINIO_ROOT_USER" ]; then
  echo 'Application S3 identity must differ from the root identity' >&2
  exit 1
fi
# End option parsing before credentials, including values beginning with a hyphen.
mcli alias set -- local http://silo:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
if ! timeout --signal=KILL 60 sh -c '
  until mcli admin info local >/dev/null 2>&1; do
    sleep 1
  done
'; then
  echo 'Silo admin API did not become ready within 60 seconds; provisioning aborted' >&2
  exit 1
fi
mcli mb --ignore-existing "local/$bucket"
mcli stat "local/$bucket" >/dev/null
policy="jiffoo-upload-$bucket"
cat > /tmp/upload-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::$bucket"]},
  {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::$bucket/*"]}
]}
EOF
mcli admin policy create local "$policy" /tmp/upload-policy.json >/dev/null
mcli admin user add -- local "$UPLOAD_S3_ACCESS_KEY_ID" "$UPLOAD_S3_SECRET_ACCESS_KEY" >/dev/null
mcli admin policy attach --user="$UPLOAD_S3_ACCESS_KEY_ID" -- local "$policy" >/dev/null

# Seed an existing out-of-scope object only in the isolated acceptance stack.
case "${1:-}" in
  '') ;;
  acceptance)
    mcli mb --ignore-existing "local/$bucket-outside" >/dev/null
    printf '%s' 'outside-scope-probe' | mcli pipe "local/$bucket-outside/probe.txt" >/dev/null
    ;;
  *) echo 'Unknown Silo initialization mode' >&2; exit 1;;
esac
