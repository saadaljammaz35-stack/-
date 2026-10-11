import json, os, re, sys
RLM = '‏'
mv_en, mv_ar = int(sys.argv[1]), int(sys.argv[2])
lines = json.load(open('audio/vo/lines.json'))
ar = [b.split('\n')[2].strip() for b in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'the-king-returns.ar.srt'), encoding='utf-8').read().strip().split('\n\n')]
assert len(ar) == len(lines) == 11

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

head = f'''[Script Info]
ScriptType: v4.00+
PlayResX: 3840
PlayResY: 2160
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: EN,IBM Plex Sans Arabic Medium,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,0,0,0,0,100,100,0.5,0,1,0,2,2,240,240,{mv_en},1
Style: AR,IBM Plex Sans Arabic Medium,82,&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,0,0,0,0,100,100,0,0,1,0,2,2,240,240,{mv_ar},-1
Style: Title,Cormorant Garamond SemiBold,200,&H00DAE9F2,&H00DAE9F2,&H00000000,&H00000000,0,0,0,0,100,100,30,0,1,0,0,5,0,0,0,1
Style: TitleAR,Amiri,172,&H00DAE9F2,&H00DAE9F2,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
ev = []
for L, a in zip(lines, ar):
    ev.append(f"Dialogue: 2,{ts(L['start'])},{ts(L['end'])},EN,,0,0,0,,{L['text']}")
    a = a.strip(RLM)
    ev.append(f"Dialogue: 2,{ts(L['start'])},{ts(L['end'])},AR,,0,0,0,,{RLM}{a}{RLM}")
# title: soft glow layer + crisp layer, slow tracking drift, fade in 82.5, out 88.0-89.5
for layer, extra in ((0, r'\blur14\alpha&HA8&'), (1, r'\blur0.7')):
    ev.append(f"Dialogue: {layer},{ts(82.5)},{ts(89.5)},Title,,0,0,0,,{{\\pos(1920,1035)\\fad(750,1500){extra}\\t(\\fsp46)}}THE KING RETURNS")
    ev.append(f"Dialogue: {layer},{ts(82.9)},{ts(89.5)},TitleAR,,0,0,0,,{{\\pos(1920,1300)\\fad(800,1100){extra}}}{RLM}عودة الملك{RLM}")
open('subs.ass', 'w', encoding='utf-8').write(head + '\n'.join(ev) + '\n')
print('wrote subs.ass', len(ev), 'events')
