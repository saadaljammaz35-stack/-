// «حاسبة الزكاة»: zakat on money, gold, silver, trade goods and debts owed to you, with the gold or
// silver price entered by hand (nothing is fetched), and zakat al-Fitr — each with its evidence and
// the points scholars differ on.
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, Segmented, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { NISAB_GOLD_G, NISAB_SILVER_G, pureGold, zakatDue, type ZakatInput } from '@/lib/seasons-extra';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const NISAB_HADITH = 4547; // No sadaqah below five awaq … (agreed upon)
const RATE_HADITH = 65878; // Abu Bakr's letter: «وفي الرقة ربع العشر» (al-Bukhari)
const FITR_HADITH = 4520; // Ibn ʿUmar: a saʿ of dates or barley … before the people go out to pray (agreed upon)
const FITR_FOODS = 4454; // Abu Saʿid: a saʿ of food, cheese, barley, dates or raisins (agreed upon)

type Field = 'cash' | 'gold' | 'silverGrams' | 'trade' | 'receivable' | 'debts' | 'goldPrice' | 'silverPrice' | 'people';
const CARATS = [24, 22, 21, 18] as const;

export default function Zakat() {
  const t = useTheme();
  const { tr } = useI18n();
  const saved = useSettings((s) => s.zakat) ?? {};
  const set = useSettings((s) => s.set);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(saved).map(([k, x]) => [k, String(x)])));
  const [carat, setCarat] = useState<(typeof CARATS)[number]>((Number(saved.carat) as (typeof CARATS)[number]) || 21);
  const [basis, setBasis] = useState<'gold' | 'silver'>(saved.basis === 'silver' ? 'silver' : 'gold');
  const num = (k: Field) => Math.max(0, Number((v[k] ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, '')) || 0);
  const update = (k: Field, text: string) => {
    const next = { ...v, [k]: text };
    setV(next);
    set({ zakat: { ...next, carat, basis } });
  };

  const input: ZakatInput = {
    cash: num('cash'),
    goldGrams: pureGold(num('gold'), carat),
    silverGrams: num('silverGrams'),
    trade: num('trade'),
    receivable: num('receivable'),
    debts: num('debts'),
    goldPrice: num('goldPrice'),
    silverPrice: num('silverPrice'),
    basis,
  };
  const r = zakatDue(input);
  const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const priceMissing = basis === 'gold' ? !input.goldPrice : !input.silverPrice;

  const field = (k: Field, label: string, hint?: string) => (
    <View key={k} style={{ gap: 4 }}>
      <Txt variant="caption" muted>
        {label}
      </Txt>
      <TextInput value={v[k] ?? ''} onChangeText={(x) => update(k, x)} keyboardType="decimal-pad" placeholder={hint ?? '0'} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
    </View>
  );

  return (
    <Screen title={tr('حاسبة الزكاة', 'Zakat calculator')} subtitle={tr('زكاة المال وزكاة الفطر، بأدلتها', 'Zakat on wealth and zakat al-Fitr, with evidence')}>
      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('سعر الغرام اليوم (اكتبه من مصدر تثق به)', 'Today’s price per gram (from a source you trust)')}</Txt>
        {field('goldPrice', tr('الذهب عيار 24', 'Gold, 24 carat'))}
        {field('silverPrice', tr('الفضة', 'Silver'))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('ما حال عليه الحول من مالك', 'What you have held for a full lunar year')}</Txt>
        {field('cash', tr('النقود في يدك وفي الحسابات', 'Cash in hand and in accounts'))}
        {field('gold', tr('الذهب (بالغرام)', 'Gold (grams)'))}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {CARATS.map((c) => (
            <Chip key={c} label={tr(`عيار ${c}`, `${c} carat`)} active={carat === c} onPress={() => (setCarat(c), set({ zakat: { ...v, carat: c, basis } }))} />
          ))}
        </View>
        {field('silverGrams', tr('الفضة (بالغرام)', 'Silver (grams)'))}
        {field('trade', tr('عروض التجارة بسعر بيعها اليوم', 'Trade goods at today’s selling price'))}
        {field('receivable', tr('ديون لك مرجوّة السداد', 'Debts owed to you that you expect back'))}
        {field('debts', tr('ديون عليك حالّة', 'Debts you owe that are due now'))}
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt weight="semibold">{tr('النصاب بحسب', 'Nisab by')}</Txt>
        <Segmented<'gold' | 'silver'>
          value={basis}
          onChange={(b) => (setBasis(b), set({ zakat: { ...v, carat, basis: b } }))}
          options={[
            { value: 'gold', label: tr(`الذهب (${NISAB_GOLD_G} غ)`, `Gold (${NISAB_GOLD_G} g)`) },
            { value: 'silver', label: tr(`الفضة (${NISAB_SILVER_G} غ)`, `Silver (${NISAB_SILVER_G} g)`) },
          ]}
        />
      </Card>

      <Card tone="primary" style={{ gap: 6 }}>
        {priceMissing ? (
          <Txt color="#FFFFFF">{tr('اكتب سعر الغرام ليُحسب النصاب.', 'Enter the price per gram to work out the nisab.')}</Txt>
        ) : (
          <>
            <Txt color="rgba(255,255,255,0.9)">{tr(`مالك الزكوي: ${money(r.wealth)} · النصاب: ${money(r.nisab)}`, `Zakatable wealth: ${money(r.wealth)} · nisab: ${money(r.nisab)}`)}</Txt>
            <Txt variant="title" color="#FFFFFF">
              {r.due ? tr(`الزكاة: ${money(r.due)}`, `Zakat: ${money(r.due)}`) : tr('لم يبلغ النصاب', 'Below the nisab')}
            </Txt>
          </>
        )}
      </Card>
      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr(
          `النسبة ربع العشر (2.5%). ونصاب الذهب عشرون مثقالًا ونصاب الفضة مئتا درهم، وقدّرهما كثير من المعاصرين بنحو ${NISAB_GOLD_G} غرامًا من الذهب و${NISAB_SILVER_G} غرامًا من الفضة، وفي التقدير خلاف يسير. واختلف العلماء في تقدير نصاب النقود: بالذهب أم بالفضة (وهو الأحوط للفقير)، وفي زكاة الحلي المعدّ للاستعمال، وفي خصم الديون. هذه الحاسبة تقريبية، فاستشر أهل العلم في حالتك.`,
          `The rate is a quarter of a tenth (2.5%). The nisab is twenty mithqal of gold or two hundred dirhams of silver, which many contemporary scholars put at about ${NISAB_GOLD_G} g of gold and ${NISAB_SILVER_G} g of silver, with small differences. Scholars differ on measuring money by gold or by silver (silver favours the poor), on zakat on jewellery worn, and on deducting debts. This is an estimate; ask a scholar about your case.`,
        )}
      </Txt>
      <Evidence id={NISAB_HADITH} full />
      <Evidence id={RATE_HADITH} />

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('زكاة الفطر', 'Zakat al-Fitr')}</Txt>
        {field('people', tr('عدد من تخرجها عنهم (أنت ومن تعول)', 'How many you pay for (you and your dependants)'))}
        <Txt weight="semibold">{tr(`${num('people') || 1} صاع من طعام البلد`, `${num('people') || 1} saʿ of the local staple food`)}</Txt>
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr(
            'الصاع النبوي أربعة أمداد، وقدّره الشيخ ابن باز بنحو ثلاثة كيلوغرامات احتياطًا، والشيخ ابن عثيمين بنحو 2.04 كغ من البُرّ الجيد. وتُخرج قبل صلاة العيد، ويجوز قبله بيوم أو يومين. والجمهور على إخراجها طعامًا، وأجاز الحنفية إخراج قيمتها نقدًا.',
            'The Prophet’s saʿ is four mudd; Ibn Baz estimated it at about three kilograms to be safe, and Ibn ʿUthaymin at about 2.04 kg of good wheat. It is given before the Eid prayer, and may be a day or two earlier. Most scholars require food; the Hanafis allow its value in money.',
          )}
        </Txt>
        <Evidence id={FITR_HADITH} full />
        <Evidence id={FITR_FOODS} />
      </Card>
    </Screen>
  );
}
