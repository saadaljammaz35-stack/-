#!/bin/bash
# The live server at crust1.com holds the seven files flat inside public_html,
# with no assets/ folder, because uploading a folder from a phone was the one
# step that would not work. This rebuilds that flat copy from site/.
#
#   bash tools/make-flat.sh            -> writes build/flat/
#
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/build/flat"
rm -rf "$out"; mkdir -p "$out"
python3 - "$here" "$out" <<'PY'
import sys, os, shutil
src, out = sys.argv[1] + '/site', sys.argv[2]
html = open(src + '/index.html', encoding='utf-8').read()
open(out + '/index.html', 'w', encoding='utf-8').write(html.replace('assets/', ''))
for f in os.listdir(src + '/assets'):
    shutil.copy(src + '/assets/' + f, out + '/' + f)
print('flat copy ready in', out)
for f in sorted(os.listdir(out)):
    print('  %-26s %6.0f KB' % (f, os.path.getsize(out + '/' + f) / 1024))
PY
