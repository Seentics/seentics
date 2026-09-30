#!/bin/sh
# One-shot setup for objex: create the buckets and give them a CORS rule so
# browsers can fetch presigned replay/heatmap URLs. Idempotent — safe to rerun
# on every `docker compose up`. Runs in the amazon/aws-cli image.
#
# Env:
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   the key objex was started with
#   BUCKETS        space-separated bucket names
#   S3_ENDPOINT    objex URL (default http://objex:9000)
#   CORS_ORIGIN    allowed browser origin (default *)
set -eu

endpoint="${S3_ENDPOINT:-http://objex:9000}"
origin="${CORS_ORIGIN:-*}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

s3api() { aws --endpoint-url "$endpoint" s3api "$@"; }

cors="{\"CORSRules\":[{\"AllowedOrigins\":[\"$origin\"],\"AllowedMethods\":[\"GET\",\"HEAD\"],\"AllowedHeaders\":[\"*\"],\"ExposeHeaders\":[\"ETag\"],\"MaxAgeSeconds\":3600}]}"

for bucket in $BUCKETS; do
  s3api head-bucket --bucket "$bucket" >/dev/null 2>&1 || s3api create-bucket --bucket "$bucket" >/dev/null
  s3api put-bucket-cors --bucket "$bucket" --cors-configuration "$cors"
  echo "bucket ready: $bucket"
done
