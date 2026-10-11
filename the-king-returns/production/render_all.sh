#!/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p seg
python3 render.py range 0 720 seg/a.mkv &
python3 render.py range 720 1440 seg/b.mkv &
python3 render.py range 1440 2160 seg/c.mkv &
wait
printf "file 'a.mkv'\nfile 'b.mkv'\nfile 'c.mkv'\n" > seg/list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i seg/list.txt -c copy picture.mkv
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate -of csv=p=0 picture.mkv
echo RENDER_DONE
