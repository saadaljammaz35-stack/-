#!/usr/bin/env bash
# Build the sting end to end: frames -> H.264 -> mastered audio -> mux.
#
#   ./make.sh [square|vert] [outfile]
#     square (default)  1080x1080  -> build/crust-sting.mp4
#     vert              1080x1920  -> build/crust-sting-9x16.mp4
#
# Video: 720 frames at 60000/1001 (59.94), 1080x1080, yuv420p.
# Audio: synthesised here, then loudnorm'd to -14 LUFS / -1 dBTP.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fmt="${1:-square}"
if [ "$fmt" = "vert" ]; then
  flag="--vert"; sub="frames-9x16"; def="$here/build/crust-sting-9x16.mp4"
else
  flag=""; sub="frames"; def="$here/build/crust-sting.mp4"
fi
out="${2:-$def}"
work="${WORK:-$here/build}"
mkdir -p "$work/$sub" "$(dirname "$out")"

echo "── frames ──"
rm -f "$work/$sub"/*.png
node "$here/render.mjs" "$work/$sub" $flag

echo "── audio ──"
python3 -I "$here/audio.py" "$work/bed-raw.wav"
meas=$(ffmpeg -hide_banner -i "$work/bed-raw.wav" \
        -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
read -r I TP LRA TH OFF <<<"$(printf '%s' "$meas" | python3 -I -c "
import sys, json
d = json.load(sys.stdin)
print(d['input_i'], d['input_tp'], d['input_lra'], d['input_thresh'], d['target_offset'])")"
ffmpeg -y -v error -i "$work/bed-raw.wav" -af \
  "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true" \
  -ar 48000 -c:a pcm_s16le "$work/bed.wav"

echo "── encode ──"
ffmpeg -y -v error \
  -framerate 60000/1001 -i "$work/$sub/%04d.png" \
  -i "$work/bed.wav" \
  -map 0:v -map 1:a \
  -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "keyint=120:min-keyint=60:scenecut=0" \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  "$out"

echo "── done ──"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames \
        -of default=noprint_wrappers=1 "$out"
