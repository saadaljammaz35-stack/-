import { Image as ImageIcon, Lock } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { StarMark, Wordmark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Button, Segmented, Txt } from '@/components/ui';
import { getEncHadith } from '@/data/content';
import { useAdhkarList } from '@/features/adhkar/lists';
import { CARD_STYLES, shareViewAsImage, type CardStyle } from '@/features/share-image';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { completeListDays, harvest, harvestPeriod, periodKeys, type HarvestKind } from '@/lib/harvest';
import { toHijri } from '@/lib/hijri';
import { useSettings } from '@/store/settings';
import { useAdhkarStore, useFastingStore, useHifzStore, useKhatmaStore, usePrayerLogStore, useQuranStore, useTasbihStore } from '@/store/user';
import { useTheme } from '@/theme';

/** HadeethEnc #5845 (agreed upon, sahih): on keeping up deeds, however small. */
const CONSISTENCY_HADITH = 5845;
const CONSISTENCY_CLAUSE = 'وكان أحب الدين إليه ما داوم صاحبه عليه';

export default function HarvestScreen() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const f = useFormat();
  const today = useToday();
  const hijriOffset = useSettings((s) => s.prayer.hijriOffset);
  const [kind, setKind] = useState<HarvestKind>('week');
  const [styleId, setStyleId] = useState<CardStyle['id']>('green');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [clause, setClause] = useState<string | null>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const s = CARD_STYLES.find((x) => x.id === styleId)!;

  const pagesRead = useQuranStore((x) => x.pagesRead);
  const prayers = usePrayerLogStore((x) => x.days);
  const progress = useAdhkarStore((x) => x.progress);
  const tasbih = useTasbihStore((x) => x.history);
  const fasting = useFastingStore((x) => x.days);
  const hifz = useHifzStore((x) => x.cards);
  const khatmas = useKhatmaStore((x) => x.khatmas);
  const morningItems = useAdhkarList('morning');
  const eveningItems = useAdhkarList('evening');

  useEffect(() => {
    // Quote only the words as they stand in the verified collection.
    getEncHadith(CONSISTENCY_HADITH).then((h) => setClause(h && h.text.includes(CONSISTENCY_CLAUSE) ? CONSISTENCY_CLAUSE : null));
  }, []);

  const period = useMemo(() => harvestPeriod(kind, today, hijriOffset), [kind, today, hijriOffset]);
  const h = useMemo(() => {
    const keys = periodKeys(period);
    return harvest({
      period,
      pagesRead,
      prayers,
      morningDays: completeListDays(progress, 'morning', morningItems ?? [], keys),
      eveningDays: completeListDays(progress, 'evening', eveningItems ?? [], keys),
      tasbih,
      fasting,
      hifz,
      khatmas,
    });
  }, [period, pagesRead, prayers, progress, morningItems, eveningItems, tasbih, fasting, hifz, khatmas]);

  const hijriName = f.hijriMonth(toHijri(today, hijriOffset).month);
  const heading =
    kind === 'week' ? tr('حصاد الأسبوع', 'My week') : kind === 'month' ? tr('حصاد الشهر', 'My month') : tr(`حصاد ${hijriName}`, `My ${hijriName}`);
  const range =
    period.from.month === period.to.month
      ? `${period.from.day}–${period.to.day} ${f.gregorianMonth(period.to.month)}`
      : `${period.from.day} ${f.gregorianMonth(period.from.month)} – ${period.to.day} ${f.gregorianMonth(period.to.month)}`;

  const tiles = [
    { value: h.pages, label: tr('صفحة من القرآن', 'Quran pages') },
    { value: h.completeDays, label: tr('يوم بالصلوات الخمس', 'days with all five') },
    { value: h.morning, label: tr('أذكار الصباح', 'morning adhkar') },
    { value: h.evening, label: tr('أذكار المساء', 'evening adhkar') },
    { value: h.versesLearned, label: tr('آية حفظتها', 'verses memorised') },
    { value: h.tasbih, label: tr('تسبيحة', 'tasbih') },
    { value: h.fasted, label: tr('يوم صيام', 'days fasted') },
    { value: h.khatmasCompleted, label: tr('ختمة أتممتها', 'khatmas completed') },
  ].filter((x) => x.value > 0);
  const empty = h.prayed === 0 && tiles.length === 0;

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      await shareViewAsImage(cardRef, heading, 'ma-allah-harvest.png');
    } catch (e) {
      setNote(tr(`تعذّر إنشاء الصورة: ${(e as Error).message}`, `Could not create the image: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  const cellSize = kind === 'week' ? 30 : 16;

  return (
    <Screen title={tr('حصادي', 'My harvest')} subtitle={tr('ما أنجزته، في بطاقة تشاركها', 'What you did, as a card to share')}>
      <Segmented<HarvestKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'week', label: tr('الأسبوع', 'Week') },
          { value: 'month', label: tr('30 يومًا', '30 days') },
          { value: 'hijri', label: hijriName },
        ]}
      />

      <View ref={cardRef} collapsable={false} style={{ backgroundColor: s.bg, borderRadius: 24, padding: 22, gap: 18, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: -70, right: -70, opacity: 0.08 }}>
          <StarMark size={240} color={s.accent} fill="none" strokeWidth={4} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StarMark size={22} color={s.accent} />
          <Text style={{ flex: 1, fontFamily: t.fonts.bold, fontSize: 18, color: s.ink, writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }}>{heading}</Text>
          <Text style={{ fontFamily: t.fonts.medium, fontSize: 12, color: s.accent }}>{range}</Text>
        </View>

        {empty ? (
          <Text style={{ fontFamily: t.fonts.medium, fontSize: 15, color: s.ink, textAlign: 'center', paddingVertical: 24, lineHeight: 26 }}>
            {tr('سجّل صلواتك واقرأ وردك، وسيظهر حصادك هنا.', 'Log your prayers and read your portion — your harvest will appear here.')}
          </Text>
        ) : (
          <>
            {h.prayed > 0 ? (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: t.fonts.bold, fontSize: 64, lineHeight: 76, color: s.ink, fontVariant: ['tabular-nums'] }}>{h.prayed}</Text>
                <Text style={{ fontFamily: t.fonts.semibold, fontSize: 15, color: s.ink }}>{tr('صلاة أدّيتها', 'prayers offered')}</Text>
                {h.jamaah ? (
                  <Text style={{ fontFamily: t.fonts.regular, fontSize: 13, color: s.accent }}>{tr(`منها ${h.jamaah} في جماعة`, `${h.jamaah} of them in jamaah`)}</Text>
                ) : null}
              </View>
            ) : null}

            {tiles.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tiles.map((x) => (
                  <View key={x.label} style={{ flexGrow: 1, flexBasis: '30%', backgroundColor: s.soft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontFamily: t.fonts.bold, fontSize: 22, color: s.ink, fontVariant: ['tabular-nums'] }}>{x.value.toLocaleString('en-US')}</Text>
                    <Text style={{ fontFamily: t.fonts.regular, fontSize: 12, color: s.ink, opacity: 0.85, textAlign: 'center' }}>{x.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: t.fonts.medium, fontSize: 12, color: s.accent }}>{tr('المواظبة', 'Consistency')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, direction: 'ltr' }}>
                {h.levels.map((lv, i) => (
                  <View key={i} style={{ width: cellSize, height: cellSize, borderRadius: cellSize / 4, backgroundColor: lv ? s.accent : s.soft, opacity: lv ? 0.35 + lv * 0.22 : 1 }} />
                ))}
              </View>
            </View>
          </>
        )}

        {clause ? (
          <View style={{ backgroundColor: s.soft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 2 }}>
            <Text style={{ fontFamily: t.fonts.reading, fontSize: 16, lineHeight: 28, color: s.ink, textAlign: 'center', writingDirection: 'rtl' }}>«{clause}»</Text>
            <Text style={{ fontFamily: t.fonts.regular, fontSize: 11, color: s.accent, textAlign: 'center' }}>عن عائشة رضي الله عنها — متفق عليه</Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center' }}>
          <Wordmark height={28} light={s.light} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
        {CARD_STYLES.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => setStyleId(x.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: x.id === styleId }}
            accessibilityLabel={x.id}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: x.bg, borderWidth: x.id === styleId ? 3 : 1, borderColor: x.id === styleId ? t.colors.primaryDeep : t.colors.border }}
          />
        ))}
      </View>

      <Button title={Platform.OS === 'web' ? tr('تنزيل الصورة', 'Download image') : tr('مشاركة الصورة', 'Share image')} icon={ImageIcon} loading={busy} disabled={empty} onPress={share} />
      {note ? (
        <Txt muted center>
          {note}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Lock size={14} color={t.colors.textMuted} />
        <Txt variant="caption" muted center>
          {tr('تُحسب من سجلاتك على جهازك، ولا يُرسل شيء إلا الصورة التي تختار مشاركتها.', 'Counted from the logs on your device; nothing leaves it unless you share the image.')}
        </Txt>
      </View>
    </Screen>
  );
}
