#!/bin/sh
# Processes design/assets/*.png into assets/: longest side capped at 480 px,
# PNG kept as fallback, WebP alongside when cwebp is installed.
# Usage: sh scripts/images.sh   (run from the repo root; macOS, uses sips)
set -e
cd "$(dirname "$0")/.."
for src in design/assets/*.png; do
  name=$(basename "$src")
  out="assets/$name"
  w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  if [ "$w" -gt 480 ] || [ "$h" -gt 480 ]; then
    sips -Z 480 "$src" --out "$out" >/dev/null
  else
    cp "$src" "$out"
  fi
  if command -v cwebp >/dev/null 2>&1; then
    cwebp -quiet -q 85 -alpha_q 90 -metadata none "$out" -o "assets/${name%.png}.webp"
  else
    echo "cwebp not installed: shipping PNG only for $name" >&2
  fi
done
ls -la assets/*.png assets/*.webp 2>/dev/null
