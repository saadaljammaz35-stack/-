#!/usr/bin/env python3
"""WARD montage — local speech-to-text with faster-whisper (no API key, runs on CPU).

    python3 transcribe.py audio.wav out.json [--model large-v3-turbo] [--lang ar] [--threads 8] [--split 0.35]

Writes {"language", "duration", "cues": [{start,end,text}], "words": [{start,end,word}]}.
Cues are re-cut from word timings at every pause of --split seconds or more, because whisper's
own segments run straight across short silences and would hide the dead air the editor removes.
Prints "PROGRESS <seconds_done> <seconds_total>" lines for the runner.

Adapted from the yt-edit skill's transcribe.py.
"""
import json
import os
import sys
import wave


def arg(a, name, default):
    return a[a.index(name) + 1] if name in a else default


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__)
        sys.exit(2)
    src, out = a[0], a[1]
    model_name = arg(a, "--model", "large-v3-turbo")
    lang = arg(a, "--lang", "ar")
    threads = int(arg(a, "--threads", str(os.cpu_count() or 4)))
    split = float(arg(a, "--split", "0.35"))

    import numpy as np
    from faster_whisper import WhisperModel

    with wave.open(src, "rb") as fh:
        if fh.getframerate() != 16000 or fh.getnchannels() != 1:
            raise SystemExit("expected 16 kHz mono wav")
        audio = np.frombuffer(fh.readframes(fh.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    total = len(audio) / 16000.0

    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads)
    segs, info = model.transcribe(
        audio,
        language=None if lang == "auto" else lang,
        beam_size=1,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    words = []
    for s in segs:
        for w in s.words or []:
            text = (w.word or "").strip()
            if text:
                words.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": text})
        print(f"PROGRESS {s.end:.2f} {total:.2f}", flush=True)

    cues, cur = [], None
    for w in words:
        gap = w["start"] - cur["end"] if cur else 0
        too_long = cur is not None and (w["end"] - cur["start"] > 7.0 or len(cur["text"]) > 84)
        if cur is None or gap >= split or too_long:
            cur = {"start": w["start"], "end": w["end"], "text": w["word"]}
            cues.append(cur)
        else:
            cur["end"] = w["end"]
            cur["text"] = (cur["text"] + " " + w["word"]).strip()

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(
            {"language": info.language, "duration": round(total, 3), "model": model_name, "cues": cues, "words": words},
            fh,
            ensure_ascii=False,
        )
    print(f"PROGRESS {total:.2f} {total:.2f}", flush=True)


if __name__ == "__main__":
    main()
