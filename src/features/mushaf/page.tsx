// One page of the Madani mushaf: 15 justified lines in the King Fahd Complex Hafs script,
// with surah headers and basmala exactly where the printed page has them.
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { getPageLines, getSurahs, getVerse, type PageLine, type Surah } from '@/data/content';
import { toArabicDigits } from '@/lib/arabic';
import { recitedWord } from '@/lib/recitation';
import { useTheme } from '@/theme';

let basmalaCache: string | null = null;
async function basmala(): Promise<string> {
  if (!basmalaCache) basmalaCache = (await getVerse(0))?.textQpc ?? 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
  return basmalaCache;
}

export function SurahFrame({ name, width, height, color, ink, paper }: { name: string; width: number; height: number; color: string; ink: string; paper: string }) {
  const t = useTheme();
  const w = width;
  const h = height;
  const r = h / 2;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Rect x={1} y={2} width={w - 2} height={h - 4} rx={r * 0.5} fill={t.colors.primarySoft} stroke={color} strokeWidth={1.4} />
        <Rect x={6} y={6} width={w - 12} height={h - 12} rx={r * 0.38} fill="none" stroke={color} strokeWidth={0.8} />
        <Path d={`M ${h * 0.55} ${h / 2} l ${h * 0.22} -${h * 0.22} l ${h * 0.22} ${h * 0.22} l -${h * 0.22} ${h * 0.22} z`} fill={color} />
        <Path d={`M ${w - h * 0.55} ${h / 2} l -${h * 0.22} -${h * 0.22} l -${h * 0.22} ${h * 0.22} l ${h * 0.22} ${h * 0.22} z`} fill={color} />
        <Rect x={w * 0.3} y={h * 0.18} width={w * 0.4} height={h * 0.64} rx={h * 0.3} fill={paper} stroke={color} strokeWidth={0.8} />
      </Svg>
      <Text style={{ fontFamily: t.fonts.readingBold, fontSize: h * 0.42, color: ink, includeFontPadding: false }}>{`سورة ${name}`}</Text>
    </View>
  );
}

type Props = {
  page: number;
  width: number;
  height: number;
  activeVerse: number | null;
  /** Position of the word being recited inside `activeVerse`. */
  activeWord?: number | null;
  selectedVerse: number | null;
  onVersePress: (verseId: number) => void;
  onVerseLongPress: (verseId: number) => void;
  onBackgroundPress: () => void;
};

export const MushafPage = memo(function MushafPage({ page, width, height, activeVerse, activeWord = null, selectedVerse, onVersePress, onVerseLongPress, onBackgroundPress }: Props) {
  const t = useTheme();
  const [lines, setLines] = useState<PageLine[] | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [bsm, setBsm] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([getPageLines(page), getSurahs(), basmala()]).then(([l, s, b]) => {
      if (!alive) return;
      setLines(l);
      setSurahs(s);
      setBsm(b);
    });
    return () => {
      alive = false;
    };
  }, [page]);

  const padX = Math.round(width * 0.035);
  const innerW = width - padX * 2;
  const headerH = 34;
  const footerH = 34;
  const lineH = (height - headerH - footerH) / 15;
  const fontSize = Math.min(innerW / 18.6, lineH / 1.72);
  const centered = page <= 2;

  if (!lines) return <View style={{ width, height, backgroundColor: t.colors.mushafPaper }} />;

  const firstVerseLine = lines.find((l) => l.type === 'ayah');
  const firstVerseId = firstVerseLine && firstVerseLine.type === 'ayah' ? firstVerseLine.words[0][0] : null;
  const recited = activeVerse != null && activeWord != null ? recitedWord(lines, activeVerse, activeWord) : null;
  const dark = t.colors.scheme === 'dark';

  return (
    <View style={{ width, height, backgroundColor: t.colors.mushafPaper }} onTouchEnd={undefined}>
      <PageHeader page={page} surahs={surahs} lines={lines} height={headerH} padX={padX} firstVerseId={firstVerseId} />
      <View style={{ flex: 1, paddingHorizontal: padX, justifyContent: centered ? 'center' : 'flex-start' }}>
        {lines.map((line, i) => {
          if (line.type === 'surah') {
            const s = surahs[line.surah - 1];
            return (
              <View key={i} style={{ height: lineH, alignItems: 'center', justifyContent: 'center' }}>
                <SurahFrame name={s?.name ?? ''} width={innerW} height={lineH * 0.92} color={t.colors.mushafFrame} ink={t.colors.mushafInk} paper={t.colors.mushafPaper} />
              </View>
            );
          }
          if (line.type === 'basmala') {
            return (
              <View key={i} style={{ height: lineH, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: t.fonts.quran, fontSize, color: t.colors.mushafInk, includeFontPadding: false }}>{bsm}</Text>
              </View>
            );
          }
          return (
            <View
              key={i}
              style={{
                height: lineH,
                flexDirection: 'row',
                direction: 'rtl',
                alignItems: 'center',
                justifyContent: centered ? 'center' : 'space-between',
                gap: centered ? fontSize * 0.28 : 0,
              }}>
              {line.words.map(([verseId, text, isEnd, position], wi) => {
                const selected = verseId === selectedVerse;
                const active = verseId === activeVerse;
                const speaking = active && !isEnd && position === recited;
                return (
                  <Text
                    key={wi}
                    suppressHighlighting
                    onPress={() => onVersePress(verseId)}
                    onLongPress={() => onVerseLongPress(verseId)}
                    style={{
                      fontFamily: t.fonts.quran,
                      fontSize,
                      lineHeight: lineH,
                      color: speaking ? (dark ? '#F3E6B8' : '#5A3D00') : isEnd ? t.colors.mushafFrame : t.colors.mushafInk,
                      includeFontPadding: false,
                      backgroundColor: selected ? t.colors.primarySoft : speaking ? (dark ? '#5A4A1C' : '#F6DE9A') : active ? (dark ? '#2C3A24' : '#EAF2DC') : 'transparent',
                      borderRadius: 4,
                    }}>
                    {text}
                  </Text>
                );
              })}
            </View>
          );
        })}
      </View>
      <View style={{ height: footerH, alignItems: 'center', justifyContent: 'center' }} onTouchEnd={onBackgroundPress}>
        <View style={{ borderWidth: 1, borderColor: t.colors.mushafFrame, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 1 }}>
          <Text style={{ fontFamily: t.fonts.medium, fontSize: 14, color: t.colors.mushafInk }}>{toArabicDigits(page)}</Text>
        </View>
      </View>
    </View>
  );
});

function PageHeader({ page, surahs, lines, height, padX, firstVerseId }: { page: number; surahs: Surah[]; lines: PageLine[]; height: number; padX: number; firstVerseId: number | null }) {
  const t = useTheme();
  const [info, setInfo] = useState<{ juz: number; hizb: number } | null>(null);
  useEffect(() => {
    if (firstVerseId == null) return;
    getVerse(firstVerseId).then((v) => v && setInfo({ juz: v.juz, hizb: v.hizb }));
  }, [firstVerseId]);
  const surahOnPage = surahs.filter((s) => s.pageStart <= page && s.pageEnd >= page);
  const firstSurah = lines.find((l) => l.type === 'surah');
  const name = surahOnPage.length ? surahOnPage[0].name : firstSurah && firstSurah.type === 'surah' ? surahs[firstSurah.surah - 1]?.name : '';
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: padX + 4 }}>
      <Text style={{ fontFamily: t.fonts.medium, fontSize: 13, color: t.colors.mushafFrame }}>{info ? `الجزء ${toArabicDigits(info.juz)}` : ''}</Text>
      <Text style={{ fontFamily: t.fonts.medium, fontSize: 13, color: t.colors.mushafFrame }}>{info ? `الحزب ${toArabicDigits(info.hizb)}` : ''}</Text>
      <Text style={{ fontFamily: t.fonts.readingBold, fontSize: 15, color: t.colors.mushafFrame }}>{name}</Text>
    </View>
  );
}
