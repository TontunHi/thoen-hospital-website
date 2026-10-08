#!/usr/bin/env bash
# Smoke test of the real binary: config validation, the health contract with
# no database reachable, and graceful shutdown. Needs no database.
set -euo pipefail

bin="${1:?usage: smoke.sh <path-to-binary>}"
addr="127.0.0.1:${SMOKE_PORT:-6199}"

echo "1. missing configuration stops startup and names the variables"
if out=$(env -i "$bin" 2>&1); then echo "expected a non-zero exit"; exit 1; fi
echo "$out" | grep -q "BACKEND_ADDR is required"
echo "$out" | grep -q "DATABASE_URL is required"

echo "2. no database reachable: 503 unhealthy with the contract's shape"
env -i NODE_ENV=production BACKEND_ADDR="$addr" BACKEND_DB_PROBE_TIMEOUT=2s \
  DATABASE_URL="mysql://smoke:smoke@127.0.0.1:1/smoke" \
  HOSXP_DB_HOST=127.0.0.1 HOSXP_DB_PORT=1 HOSXP_DB_USER=smoke HOSXP_DB_NAME=smoke \
  SALARY_DB_HOST=127.0.0.1 SALARY_DB_PORT=1 SALARY_DB_USER=smoke SALARY_DB_NAME=smoke \
  "$bin" >/tmp/smoke.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "http://$addr/api/health" && break; sleep 0.1; done

code=$(curl -s -D /tmp/smoke.headers -o /tmp/smoke.body -w '%{http_code}' "http://$addr/api/health")
cat /tmp/smoke.body; echo
test "$code" = "503"
grep -qi '^cache-control: no-store, no-cache, must-revalidate' /tmp/smoke.headers
grep -qi '^content-type: application/json' /tmp/smoke.headers
grep -qi '^x-frame-options: DENY' /tmp/smoke.headers
python3 - <<'PY'
import json, re
b = json.load(open('/tmp/smoke.body'))
assert list(b) == ['status', 'timestamp', 'uptimeSeconds', 'environment', 'services'], list(b)
assert b['status'] == 'unhealthy' and b['environment'] == 'production'
assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', b['timestamp']), b['timestamp']
assert list(b['services']) == ['primaryDatabase', 'hosxpReplicaDatabase', 'salaryDatabase']
for s in b['services'].values():
    assert list(s) == ['status', 'latencyMs', 'error'] and s['status'] == 'DOWN', s
PY

echo "3. the 61st call in a minute is rate limited"
for _ in $(seq 1 57); do curl -s -o /dev/null "http://$addr/api/health"; done
test "$(curl -s -o /dev/null -w '%{http_code}' "http://$addr/api/health")" = "503"
test "$(curl -s -o /tmp/smoke.429 -w '%{http_code}' "http://$addr/api/health")" = "429"
grep -q '"retryAfterSeconds"' /tmp/smoke.429

echo "4. SIGTERM shuts down cleanly"
kill -TERM "$pid"
wait "$pid"
trap - EXIT
grep -q "backend stopped" /tmp/smoke.log
echo "smoke test passed"
