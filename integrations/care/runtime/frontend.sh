#!/usr/bin/env bash
set -euo pipefail
STACK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$STACK_DIR/../care-scaffold.env"
source "$STACK_DIR/frontend.env"
set +a
cd "$STACK_DIR/../care_fe"
exec npm run dev -- --host 127.0.0.1 --port 47417 --strictPort
