#!/usr/bin/env bash
# Build packages/gt-math with Emscripten and copy artifacts to public/gt-math/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/packages/gt-math"

if ! command -v emcmake >/dev/null 2>&1; then
  for candidate in \
    "${EMSDK:-}/emsdk_env.sh" \
    "$HOME/emsdk/emsdk_env.sh" \
    /root/emsdk/emsdk_env.sh \
    /opt/emsdk/emsdk_env.sh; do
    if [[ -f "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate"
      break
    fi
  done
fi

if ! command -v emcmake >/dev/null 2>&1; then
  echo "emcmake not found. Install Emscripten (emsdk) and retry." >&2
  exit 1
fi

BUILD_DIR="$PKG/build"
emcmake cmake -S "$PKG" -B "$BUILD_DIR" \
  -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
  -DCMAKE_BUILD_TYPE=Release

cmake --build "$BUILD_DIR"

if [[ ! -f "$BUILD_DIR/gt_math.js" || ! -f "$BUILD_DIR/gt_math.wasm" ]]; then
  echo "Emscripten build did not produce gt_math.js / gt_math.wasm" >&2
  exit 1
fi

mkdir -p "$PKG/dist" "$ROOT/public/gt-math"
cp "$BUILD_DIR/gt_math.js" "$BUILD_DIR/gt_math.wasm" "$PKG/dist/"
cp "$BUILD_DIR/gt_math.js" "$BUILD_DIR/gt_math.wasm" "$ROOT/public/gt-math/"
echo "Wrote $ROOT/public/gt-math/gt_math.{js,wasm}"
