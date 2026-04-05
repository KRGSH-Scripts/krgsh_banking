#!/usr/bin/env bash
# Baut die NUI (Vite) nach web/public — Ausgabe wird von fxmanifest.lua als ui_page/files geladen.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="${ROOT}/web"

if ! command -v npm >/dev/null 2>&1; then
  echo "Fehler: npm nicht gefunden. Node.js (LTS) installieren und erneut ausführen." >&2
  exit 1
fi

cd "$WEB"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npm run build

echo "Build abgeschlossen. NUI liegt unter: ${WEB}/public/"
