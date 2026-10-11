# How the film was made

Everything in *The King Returns* is built from the creator's own 11 photos. The
voice, score and sound effects are generated locally, and no stock footage or
licensed music is used. These scripts rebuild the film from scratch.

## Inputs (not in git)

- `src/p01.jpg` … `src/p11.jpg`: the 11 photos, numbered in the order they were shared.
  The full-body shots are `p01`, `p02`, `p04`, `p06`, `p10`, `p11`. The close-ups are
  `p05`, `p07`, `p08`, `p09`. `p03` is the blurred-hand photo.
- `models/`: Kokoro TTS weights, `kokoro-v1.0.onnx` and `voices-v1.0.bin`, from the
  `thewh1teagle/kokoro-onnx` GitHub release `model-files-v1.0`.
- `fonts/`: Cormorant Garamond, Amiri and IBM Plex Sans Arabic, all from
  `github.com/google/fonts` (OFL).
- `fonts_static/`: a static SemiBold instance of Cormorant Garamond, made with
  `fonttools varLib.instancer -o fonts_static/CormorantGaramond-SemiBold.ttf "fonts/CormorantGaramond[wght].ttf" wght=600 --update-name-table`.
  Then copy `Amiri-Bold.ttf` and `IBMPlexSansArabic-Medium.ttf` in next to it.

Tools: `ffmpeg`, `fluidsynth` with `fluid-soundfont-gm` (FluidR3 GM, MIT licence), and
`pip install numpy scipy pillow opencv-python-headless "rembg[cpu]" kokoro-onnx soundfile pyloudnorm mido faster-whisper fonttools`.

## Steps (run from this folder)

| Step | Command | Output |
|---|---|---|
| Clean window plate (removes the person from the window) | `python3 plates_window.py` | `plate_window.png` |
| Person masks | `python3 masks.py u2net_human_seg 01,02,04,05,06,07,08,09,10` | `masks/` |
| Picture, 2,160 frames, 1920×1080, 2.39:1 letterbox | `./render_all.sh` | `picture.mkv` |
| Voice-over (Kokoro `am_michael`, speed 0.80, −1.5 semitones, formants kept) | `python3 vo.py` | `audio/vo/` |
| Check every VO line with speech recognition | `python3 asr_check.py` | prints 11/11 |
| Score, sound design and mix (−14 LUFS, −1 dBTP) | `python3 music.py` | `audio/final_mix.wav`, stems |
| Subtitles and title (libass, 4K coordinates) | `python3 make_ass.py 204 104` | `subs.ass` |
| Export 1080p H.264 and 4K HEVC | `./encode.sh` | `deliver/` |

`music.py` also writes `audio/stems/vo_stem.wav` and `audio/stems/music_sfx_stem.wav`.
To use your own voice instead of the AI narrator, record the 11 lines and save them as
`audio/vo/L01.wav` … `L11.wav` (48 kHz mono). Each one must start at its subtitle time
and fit its window. Then re-run `music.py` and `encode.sh`.

Shot list, timings and camera moves are in `render.py` (`SHOTS`, one function per shot).
The score is written out note by note in `music.py`.
