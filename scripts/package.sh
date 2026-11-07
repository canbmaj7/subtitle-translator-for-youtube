#!/usr/bin/env bash
# Mağaza paketi üretir: scripts/package.sh  ->  dist/subtitle-translator-<sürüm>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/check-store.cjs
V=$(node -p "require('./extension/manifest.json').version")
mkdir -p dist
OUT="dist/subtitle-translator-$V.zip"
rm -f "$OUT"
python3 - "$OUT" <<'PY'
import sys, os, zipfile
out = sys.argv[1]
skip = {"icons/icon.svg"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, fs in os.walk("extension"):
        for f in sorted(fs):
            full = os.path.join(root, f)
            rel = os.path.relpath(full, "extension")
            if rel in skip or f == ".DS_Store":
                continue
            z.write(full, rel)
            print("  " + rel)
PY
echo "Paket: $OUT ($(du -h "$OUT" | cut -f1))"
