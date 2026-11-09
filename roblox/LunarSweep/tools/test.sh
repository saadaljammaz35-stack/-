#!/usr/bin/env bash
# Full verification: build, static analysis (luau-lsp + Roblox types), unit, server and
# client suites (Lune). Writes build/test-report.txt.
#   tools/test.sh [path/to/globalTypes.d.luau]
set -uo pipefail
cd "$(dirname "$0")/.."
REPORT=build/test-report.txt
mkdir -p build
: > "$REPORT"
status=0
log() { echo "$@" | tee -a "$REPORT"; }

tools/build.sh >/dev/null || { log "BUILD FAILED"; exit 1; }
log "== Build: OK ($(du -h build/LunarSweep.rbxlx | cut -f1) rbxlx, $(du -h build/LunarSweep.rbxl | cut -f1) rbxl)"
log "== Source: $(find src -name '*.luau' | wc -l) Luau files, $(cat $(find src -name '*.luau') | wc -l) lines"

DEFS="${1:-build/globalTypes.d.luau}"
if command -v luau-lsp >/dev/null; then
  if [ ! -f "$DEFS" ]; then
    curl -fsSL -o "$DEFS" https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/1.38.0/scripts/globalTypes.None.d.luau || true
  fi
  rojo sourcemap default.project.json -o sourcemap.json >/dev/null
  out=$(luau-lsp analyze --definitions="$DEFS" --sourcemap=sourcemap.json --no-strict-dm-types src 2>&1 | grep -v '^home\|^/' )
  if [ -z "$out" ]; then log "== Static analysis (luau-lsp, Roblox types): 0 errors"; else log "== Static analysis issues:"; log "$out"; status=1; fi
else
  log "== Static analysis skipped (luau-lsp not installed)"
fi

for suite in unit server_smoke client_smoke; do
  out=$(lune run "tests/$suite.luau" 2>&1); rc=$?
  echo "$out" | grep -E '^\[(PASS|FAIL)\]' >> "$REPORT"
  log "== Suite $suite: $(echo "$out" | grep -E '^====' | tail -1)"
  [ $rc -ne 0 ] && status=1
done
log "== Overall: $([ $status -eq 0 ] && echo PASS || echo FAIL)"
exit $status
