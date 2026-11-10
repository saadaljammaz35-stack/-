#!/usr/bin/env bash
# Builds medad-launch.mp4: renders 720 master frames (59.94 fps), synthesises
# the sound design, encodes H.264 yuv420p and muxes the audio.
#   ./build.sh <work-dir>
# Needs: Node + Playwright (Chromium), Python 3 with numpy, ffmpeg.
set -euo pipefail
WORK="${1:-./out}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$WORK"

node "$HERE/render.js" film "$WORK/frames"
python3 "$HERE/audio.py" "$WORK/medad-sfx.wav"

ffmpeg -y -hide_banner -loglevel error \
  -framerate 60000/1001 -i "$WORK/frames/m%04d.png" \
  -i "$WORK/medad-sfx.wav" \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -profile:v high \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart \
  "$WORK/medad-launch.mp4"

echo "→ $WORK/medad-launch.mp4"
