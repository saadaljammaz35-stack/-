#!/usr/bin/env bash
# Builds the Roblox place files from source with Rojo.
#   tools/build.sh            -> build/LunarSweep.rbxlx (XML) and build/LunarSweep.rbxl (binary)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v rojo >/dev/null || { echo "rojo not found - install with 'rokit install' (see README)"; exit 1; }
mkdir -p build
rojo build default.project.json -o build/LunarSweep.rbxlx
rojo build default.project.json -o build/LunarSweep.rbxl
echo "Built build/LunarSweep.rbxlx and build/LunarSweep.rbxl"
