# THE KING RETURNS · عودة الملك — subtitle files

| File | Use |
|---|---|
| `the-king-returns.bilingual.srt` | English line 1, Arabic line 2. For burning into the final video. |
| `the-king-returns.en.srt` | English-only caption track for YouTube Studio. |
| `the-king-returns.ar.srt` | Arabic-only caption track for YouTube Studio. |

Every Arabic line is wrapped in RLM marks (U+200F), so the full stop stays on the
left even in players that lay a line out left-to-right. Don't strip them when editing.

The cue times match the voice-over table exactly; if a recorded line runs longer,
move the cue rather than the line.

## Subtitle size at 3840×2160

- English: 64 px. Arabic: 72 px (Arabic needs ~10–15% more to look the same size).
- White, soft black drop shadow at 60% opacity, no outline.
- Bottom of the Arabic line at ~88% of frame height (inside title-safe).

## Burning in with ffmpeg

Put the font files (e.g. IBM Plex Sans Arabic, which also covers Latin) in `./fonts`.

```bash
ffmpeg -i master_prores.mov \
  -vf "subtitles=the-king-returns.bilingual.srt:fontsdir=./fonts:force_style='FontName=IBM Plex Sans Arabic,FontSize=9,PrimaryColour=&H00FFFFFF,BorderStyle=1,Outline=0,Shadow=0.6,BackColour=&H66000000,MarginV=35,Alignment=2'" \
  -c:v libx265 -preset slow -crf 16 -tag:v hvc1 -pix_fmt yuv420p10le -r 24 \
  -c:a aac -b:a 320k -ar 48000 THE_KING_RETURNS_4K.mp4
```

ffmpeg renders SRT on a 288-line canvas, so every size here is scaled by
2160 / 288 = 7.5 at 4K: `FontSize=9` ≈ 67 px, `MarginV=35` ≈ 260 px (12% of the
height), `Shadow=0.6` ≈ 4 px. This uses one size for both languages. For separate
English and Arabic sizes, burn in from DaVinci Resolve instead (Deliver → Subtitle
Settings → Burn into video), or convert the SRT to an ASS file with two styles.
