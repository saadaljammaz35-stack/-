#!/bin/bash
set -e
cd "$(dirname "$0")"
VF_IN="scale=in_color_matrix=bt601:in_range=tv:out_range=pc,format=rgb24"
VF_SUB="ass=subs.ass:fontsdir=fonts_static"
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
time ffmpeg -hide_banner -loglevel error -stats -y -i picture.mkv -i audio/final_mix.wav \
  -filter_complex "[0:v]${VF_IN},${VF_SUB},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" \
  -map "[v]" -map 1:a -c:v libx264 -preset slow -crf 18 -tune film -profile:v high -level 4.1 $COLOR \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t 90 \
  -metadata title="THE KING RETURNS" deliver/THE_KING_RETURNS_1080p.mp4
echo HD_DONE
time ffmpeg -hide_banner -loglevel error -stats -y -i picture.mkv -i audio/final_mix.wav \
  -filter_complex "[0:v]scale=3840:2160:flags=lanczos:in_color_matrix=bt601:in_range=tv:out_range=pc,format=rgb24,${VF_SUB},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le[v]" \
  -map "[v]" -map 1:a -c:v libx265 -preset fast -crf 20 -x265-params "aq-mode=3:psy-rd=2.0:psy-rdoq=1.0:no-sao=1:log-level=error" \
  -tag:v hvc1 $COLOR -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t 90 \
  -metadata title="THE KING RETURNS" deliver/THE_KING_RETURNS_4K.mp4
echo UHD_DONE
ls -la deliver/
