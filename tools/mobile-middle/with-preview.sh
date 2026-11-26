#!/usr/bin/env bash
# Builds the app, serves the production preview on a free port and runs one command against it, then stops that
# preview by its process id (goal file goals/mobile-middle-ground.md, ADR-295). The command gets the URL as $URL.
#   bash tools/mobile-middle/with-preview.sh 'node tools/mobile-middle/find-it.mjs "$URL" out'
set -u
# From the repository root, wherever it is called from.
cd "$(dirname "$0")/../.." || exit 1
PORT=${PORT:-4190}
# Its own output folder, so a build running elsewhere (dist/) never swaps files under the preview.
OUT=$(mktemp -d)
pnpm exec vite build --outDir "$OUT" --emptyOutDir >/dev/null 2>&1 || { echo "build failed"; exit 1; }
# vite itself (not through pnpm), so $! is the server and the trap stops it.
./node_modules/.bin/vite preview --outDir "$OUT" --port "$PORT" --strictPort >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; wait $PID 2>/dev/null; rm -rf "$OUT"' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/furniture-builder/" && break; sleep 0.25; done
export URL="http://localhost:$PORT/furniture-builder/"
bash -c "$1"
