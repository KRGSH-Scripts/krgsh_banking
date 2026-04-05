#!/bin/sh
# Baut die NUI (Vite) nach web/public — Ausgabe wird von fxmanifest.lua als ui_page/files geladen.
# POSIX-sh: laeuft auch unter dash (z. B. wenn txAdmin `sh build.sh` aufruft).
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
WEB="${ROOT}/web"

if ! command -v npm >/dev/null 2>&1; then
  echo "Fehler: npm nicht gefunden. Node.js (LTS) installieren und erneut ausführen." >&2
  exit 1
fi

cd "$WEB"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

echo "Build abgeschlossen. NUI liegt unter: ${WEB}/public/"
