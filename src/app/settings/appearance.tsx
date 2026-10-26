import { Check, Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, IconButton, QuranText, ReadingText, Segmented, SwitchRow, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useSettings, type Language, type ReadingFont, type ThemeMode } from '@/store/settings';
import { useTheme } from '@/theme';
import { ACCENT_OPTIONS } from '@/theme/tokens';

function Scale({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { tr } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton icon={Minus} label={tr('تصغير', 'Smaller')} size={34} onPress={() => onChange(Math.max(0.8, Math.round((value - 0.1) * 10) / 10))} />
        <Txt weight="semibold" style={{ minWidth: 44, textAlign: 'center' }}>{`${Math.round(value * 100)}%`}</Txt>
        <IconButton icon={Plus} label={tr('تكبير', 'Larger')} size={34} onPress={() => onChange(Math.min(1.6, Math.round((value + 0.1) * 10) / 10))} />
      </View>
    </View>
  );
}

export default function AppearanceSettings() {
  const t = useTheme();
  const { tr } = useI18n();
  const s = useSettings();
  return (
    <Screen title={tr('المظهر والخطوط', 'Appearance')}>
      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('الوضع', 'Mode')}</Txt>
        <Segmented<ThemeMode>
          value={s.themeMode}
          onChange={(v) => s.set({ themeMode: v })}
          options={[
            { value: 'system', label: tr('تلقائي', 'Auto') },
            { value: 'light', label: tr('نهاري', 'Light') },
            { value: 'dark', label: tr('ليلي', 'Dark') },
            { value: 'warm', label: tr('قراءة دافئة', 'Warm') },
          ]}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('لون التطبيق', 'Accent colour')}</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {ACCENT_OPTIONS.map((a) => (
            <Pressable key={a.id} onPress={() => s.set({ accent: a.id })} accessibilityLabel={a.name} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center', borderWidth: s.accent === a.id ? 3 : 0, borderColor: t.colors.text }}>
                {s.accent === a.id ? <Check size={20} color="#fff" /> : null}
              </View>
              <Txt variant="label" muted>
                {a.name}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card style={{ gap: 14 }}>
        <Txt weight="semibold">{tr('الخطوط', 'Fonts')}</Txt>
        <Scale label={tr('حجم خط الواجهة', 'Interface text')} value={s.uiScale} onChange={(v) => s.set({ uiScale: v })} />
        <Scale label={tr('حجم نص الأذكار والأحاديث', 'Reading text')} value={s.readingScale} onChange={(v) => s.set({ readingScale: v })} />
        <Scale label={tr('حجم خط المصحف (وضع الترجمة)', 'Quran text (list mode)')} value={s.quranScale} onChange={(v) => s.set({ quranScale: v })} />
        <Segmented<ReadingFont>
          value={s.readingFont}
          onChange={(v) => s.set({ readingFont: v })}
          options={[
            { value: 'amiri', label: tr('خط أميري (نسخ)', 'Amiri (Naskh)') },
            { value: 'plex', label: tr('خط آي بي إم بلكس', 'IBM Plex') },
          ]}
        />
        <ReadingText size={19}>سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ</ReadingText>
        <QuranText size={22 * s.quranScale}>{'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ ٢'}</QuranText>
      </Card>
      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('اللغة', 'Language')}</Txt>
        <Segmented<Language>
          value={s.language}
          onChange={(v) => s.set({ language: v })}
          options={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]}
        />
        <Txt variant="caption" muted>
          {tr('تتغير لغة الواجهة؛ تبقى النصوص الشرعية بالعربية.', 'The interface language changes; religious texts stay in Arabic.')}
        </Txt>
      </Card>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <Card padded={false} style={{ borderWidth: 0 }}>
          <View style={{ padding: 16, gap: 10 }}>
            <Txt weight="semibold">{tr('الأرقام', 'Digits')}</Txt>
            <Segmented
              value={s.digits}
              onChange={(v) => s.set({ digits: v as 'latin' | 'arabic' })}
              options={[
                { value: 'latin', label: '1 2 3' },
                { value: 'arabic', label: '١ ٢ ٣' },
              ]}
            />
          </View>
        </Card>
        <SwitchRow title={tr('نظام 24 ساعة', '24-hour time')} value={s.use24h} onChange={(v) => s.set({ use24h: v })} />
        <SwitchRow title={tr('الاهتزاز عند العدّ', 'Haptics')} value={s.haptics} onChange={(v) => s.set({ haptics: v })} />
        <SwitchRow title={tr('إبقاء الشاشة مضاءة أثناء القراءة', 'Keep screen on while reading')} value={s.keepAwakeInMushaf} onChange={(v) => s.set({ keepAwakeInMushaf: v })} />
        <SwitchRow title={tr('إظهار ترجمة المعاني في التفسير', 'Show translation in tafsir')} value={s.showTranslation} onChange={(v) => s.set({ showTranslation: v })} />
      </View>
    </Screen>
  );
}
