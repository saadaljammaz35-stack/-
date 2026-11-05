#!/usr/bin/env python3
"""transcribe.py - a timestamped transcript from a video or audio file, for every yt-* tool.

    python3 transcribe.py video.mp4                       # Arabic by default -> video.srt + video.json
    python3 transcribe.py video.mp4 --lang en --model small
    python3 transcribe.py video.mp4 --out transcript      # transcript.srt + transcript.json

Needs ffmpeg and faster-whisper (pip install faster-whisper). This is the one tool in the pack that
is not standard-library only, because speech recognition is not something to hand-roll. The model
downloads from Hugging Face on first use.

Output:
  .srt   one cue per spoken phrase, split at pauses, so deadair.py sees the gaps you actually left
  .json  {"segments": [{"start", "end", "text"}], "words": [...]} - the whisper shape that
         deadair.py, chapters.py and retention.py --transcript already read

Cues are re-cut from word timings at any pause of --split seconds or more (default 0.35), because
whisper's own segments run straight across short silences and would hide exactly the dead air
/yt-edit is looking for.
"""
import json, os, subprocess, sys, tempfile, time


def ts(t, sep=","):
    h, rem = divmod(max(0.0, t), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", sep)


def arg(a, name, default):
    return a[a.index(name) + 1] if name in a else default


def main():
    a = sys.argv[1:]
    files = [x for i, x in enumerate(a) if not x.startswith("--") and (i == 0 or not a[i - 1].startswith("--"))]
    if not files or not os.path.exists(files[0]):
        print(__doc__); sys.exit(1)
    src = files[0]
    lang = arg(a, "--lang", "ar")
    model_name = arg(a, "--model", "large-v3-turbo")
    split = float(arg(a, "--split", "0.35"))
    out = arg(a, "--out", os.path.splitext(src)[0])
    threads = int(arg(a, "--threads", str(os.cpu_count() or 4)))

    from faster_whisper import WhisperModel  # imported late so --help works without it

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "audio.wav")
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", src, "-vn", "-ac", "1",
                        "-ar", "16000", wav], check=True)
        # Decoded here and handed over as an array: faster-whisper's own file loader goes through
        # PyAV, whose newer releases dropped an argument it still passes (metadata_errors).
        import wave
        import numpy as np
        with wave.open(wav, "rb") as fh:
            audio = np.frombuffer(fh.readframes(fh.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads)
        segs, info = model.transcribe(audio, language=lang, beam_size=1, word_timestamps=True,
                                      vad_filter=True, condition_on_previous_text=False)
        words, t0 = [], time.time()
        for s in segs:
            for w in s.words or []:
                words.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word})
            print(f"  {ts(s.end, '.')}/{ts(info.duration, '.')}  ({time.time() - t0:.0f}s)", flush=True)

    cues, cur = [], None
    for w in words:
        gap = w["start"] - cur["end"] if cur else 0
        too_long = cur and (w["end"] - cur["start"] > 7.0 or len(cur["text"]) > 84)
        if cur is None or gap >= split or too_long:
            cur = {"start": w["start"], "end": w["end"], "text": w["word"].strip()}
            cues.append(cur)
        else:
            cur["end"] = w["end"]
            cur["text"] = (cur["text"] + " " + w["word"].strip()).strip()

    with open(out + ".srt", "w", encoding="utf-8") as fh:
        for i, c in enumerate(cues, 1):
            fh.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
    with open(out + ".json", "w", encoding="utf-8") as fh:
        json.dump({"language": lang, "model": model_name, "duration": round(info.duration, 3),
                   "segments": cues, "words": words}, fh, ensure_ascii=False, indent=1)
    print(f"\n  {len(cues)} cues, {len(words)} words -> {out}.srt, {out}.json\n")


if __name__ == "__main__":
    main()
