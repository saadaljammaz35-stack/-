#!/usr/bin/env python3
"""Uploads Lunar Sweep's synthesized audio to Roblox with Open Cloud, then writes the
resulting asset ids into src/ReplicatedStorage/Shared/Config/AudioIds.luau and rebuilds
the place file (if rojo is installed).

Usage:
    export ROBLOX_API_KEY=...          # Open Cloud key with "Assets: write" (+ read) permission
    python3 tools/upload_assets.py --user-id 123456789
    python3 tools/upload_assets.py --group-id 987654 --only music_hub,click

Notes:
  * Create the key at https://create.roblox.com/dashboard/credentials (API Extensions ->
    Assets API, permissions asset:read + asset:write, add your IP or 0.0.0.0/0).
  * Roblox applies monthly audio upload quotas and moderation. Already-uploaded keys are
    skipped (non-zero ids in AudioIds.luau) unless --force is given.
  * Uses only the Python standard library.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AUDIO_DIR = os.path.join(ROOT, "assets", "audio")
IDS_FILE = os.path.join(ROOT, "src", "ReplicatedStorage", "Shared", "Config", "AudioIds.luau")
API = "https://apis.roblox.com/assets/v1"


def read_ids():
    ids = {}
    with open(IDS_FILE, encoding="utf-8") as f:
        for key, value in re.findall(r"^\s*([a-z0-9_]+)\s*=\s*(\d+)\s*,", f.read(), re.M):
            ids[key] = int(value)
    return ids


def write_ids(ids):
    lines = [
        "--!strict",
        "-- Asset ids of uploaded audio. 0 = not uploaded (fallback sound is used).",
        "-- This file is rewritten automatically by tools/upload_assets.py after uploading",
        "-- the files in assets/audio to Roblox with your Open Cloud API key.",
        "return {",
    ]
    for key in ids:
        lines.append(f"\t{key} = {ids[key]},")
    lines.append("}")
    with open(IDS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def multipart(fields, file_field, filename, content, content_type):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode()
        + content
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def request(method, url, key, body=None, content_type=None):
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("x-api-key", key)
    if content_type:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')}") from None


def upload(path, key, creator):
    name = os.path.splitext(os.path.basename(path))[0]
    meta = {
        "assetType": "Audio",
        "displayName": f"LunarSweep_{name}"[:50],
        "description": "Lunar Sweep game audio (procedurally synthesized).",
        "creationContext": {"creator": creator},
    }
    with open(path, "rb") as f:
        body, ctype = multipart({"request": json.dumps(meta)}, "fileContent", os.path.basename(path), f.read(), "audio/ogg")
    op = request("POST", f"{API}/assets", key, body, ctype)
    op_path = op.get("path") or ""
    for _ in range(60):
        if op.get("done"):
            break
        time.sleep(2)
        op = request("GET", f"{API}/{op_path}", key)
    if not op.get("done"):
        raise RuntimeError("timed out waiting for the upload to finish")
    asset_id = (op.get("response") or {}).get("assetId")
    if not asset_id:
        raise RuntimeError(f"no asset id returned: {op}")
    return int(asset_id)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    who = ap.add_mutually_exclusive_group(required=True)
    who.add_argument("--user-id", help="your Roblox user id (assets owned by you)")
    who.add_argument("--group-id", help="group id (assets owned by a group)")
    ap.add_argument("--only", help="comma separated keys to upload")
    ap.add_argument("--force", action="store_true", help="re-upload keys that already have ids")
    ap.add_argument("--dry-run", action="store_true", help="list what would be uploaded")
    args = ap.parse_args()

    key = os.environ.get("ROBLOX_API_KEY")
    if not key and not args.dry_run:
        sys.exit("Set ROBLOX_API_KEY to an Open Cloud API key with Assets write permission.")
    creator = {"userId": str(args.user_id)} if args.user_id else {"groupId": str(args.group_id)}
    ids = read_ids()
    only = set(args.only.split(",")) if args.only else None
    todo = [k for k in ids if (only is None or k in only) and (args.force or ids[k] == 0)]
    print(f"{len(todo)} file(s) to upload")
    for k in todo:
        path = os.path.join(AUDIO_DIR, k + ".ogg")
        if not os.path.exists(path):
            print(f"  skip {k}: {path} missing (run tools/synth_audio.py)")
            continue
        if args.dry_run:
            print(f"  would upload {k}")
            continue
        try:
            ids[k] = upload(path, key, creator)
            print(f"  {k} -> {ids[k]}")
            write_ids(ids)  # save progress after every upload
        except Exception as e:  # keep going, report at the end
            print(f"  FAILED {k}: {e}")
    if not args.dry_run and shutil.which("rojo"):
        subprocess.run(["rojo", "build", "default.project.json", "-o", "build/LunarSweep.rbxlx"], cwd=ROOT, check=False)
        subprocess.run(["rojo", "build", "default.project.json", "-o", "build/LunarSweep.rbxl"], cwd=ROOT, check=False)
        print("Rebuilt build/LunarSweep.rbxlx and .rbxl with the new audio ids.")
    elif not args.dry_run:
        print("rojo not found: run `rojo build default.project.json -o build/LunarSweep.rbxlx` to bake the ids in.")


if __name__ == "__main__":
    main()
