// «الصلاة في تقويمك»: prayer times (and the virtuous days) written into the phone's calendar, and
// the appointments of the coming week that cover a prayer, so it can be planned around.
import { CalendarClock, CalendarPlus, CalendarX2, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { showMessage } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, SwitchRow, Txt } from '@/components/ui';
import { calendarSupported, exportToCalendar, removeExport, requestAccess, upcomingConflicts } from '@/features/device-calendar';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import type { Conflict } from '@/lib/calendar-conflicts';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const SPANS = [7, 30, 90];

export default function PrayerCalendar() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const fmt = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const exported = useSettings((s) => s.deviceCalendarId != null);
  const [span, setSpan] = useState(30);
  const [virtues, setVirtues] = useState(true);
  const [busy, setBusy] = useState<'export' | 'remove' | 'scan' | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  if (!calendarSupported) {
    return (
      <Screen title={tr('الصلاة في تقويمك', 'Prayer in your calendar')}>
        <EmptyState icon={CalendarClock} title={tr('متاح في تطبيق الجوال', 'Available in the mobile app')} message={tr('يكتب التطبيق المواقيت في تقويم جوالك ويقرأ مواعيدك على الجهاز نفسه.', 'The app writes the times into your phone’s calendar and reads your appointments on the device.')} />
      </Screen>
    );
  }
  if (!location) {
    return (
      <Screen title={tr('الصلاة في تقويمك', 'Prayer in your calendar')}>
        <EmptyState icon={CalendarClock} title={tr('حدّد مدينتك أولًا', 'Set your city first')} />
      </Screen>
    );
  }

  const denied = () => showMessage(tr('لا إذن بالوصول إلى التقويم', 'No calendar access'), tr('اسمح لـ«مع الله» بالوصول إلى التقويم من إعدادات الجوال.', 'Allow «Ma Allah» to use the calendar in the phone’s settings.'));
  const failed = (e: unknown) => showMessage(tr('تعذّر ذلك', 'That did not work'), (e as Error).message);

  const doExport = async () => {
    setBusy('export');
    try {
      if (!(await requestAccess())) return denied();
      const n = await exportToCalendar({ from: today, days: span, virtues, lang });
      showMessage(tr('أُضيفت إلى تقويمك', 'Added to your calendar'), tr(`${n} موعدًا في تقويم «مع الله». يمكنك إخفاؤه أو حذفه من تطبيق التقويم متى شئت.`, `${n} entries in the «Ma Allah» calendar. Hide or delete it from your calendar app at any time.`));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const doRemove = async () => {
    setBusy('remove');
    try {
      if (!(await requestAccess())) return denied();
      await removeExport();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const scan = async () => {
    setBusy('scan');
    try {
      if (!(await requestAccess())) return denied();
      setConflicts(await upcomingConflicts(today, 7));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const time = (d: Date) => fmt.time(d, location.timezone);

  return (
    <Screen title={tr('الصلاة في تقويمك', 'Prayer in your calendar')} subtitle={location.name}>
      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('أضف المواقيت إلى تقويم الجوال', 'Add the times to your phone’s calendar')}</Txt>
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr('في تقويم مستقل باسم «مع الله»، بلا تنبيهات حتى لا تتكرر مع تنبيهات التطبيق. ويُستبدل كله عند كل تحديث.', 'In a separate «Ma Allah» calendar, without alerts so they don’t repeat the app’s own. Each update replaces it.')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SPANS.map((d) => (
            <Chip key={d} label={tr(`${d} يومًا`, `${d} days`)} active={span === d} onPress={() => setSpan(d)} />
          ))}
        </View>
      </Card>
      <Card padded={false}>
        <SwitchRow title={tr('والأيام الفاضلة', 'And the virtuous days')} subtitle={tr('الأيام البيض وعرفة وتاسوعاء وعاشوراء وبدايات المواسم', 'The White Days, Arafah, Tasu‘a, Ashura and the start of the seasons')} value={virtues} onChange={setVirtues} />
      </Card>
      <Button title={exported ? tr('تحديث التقويم', 'Update the calendar') : tr('أضف إلى التقويم', 'Add to calendar')} icon={exported ? RefreshCw : CalendarPlus} loading={busy === 'export'} disabled={busy != null} onPress={doExport} />
      {exported ? <Button title={tr('احذف تقويم «مع الله»', 'Delete the «Ma Allah» calendar')} icon={CalendarX2} tone="plain" loading={busy === 'remove'} disabled={busy != null} onPress={doRemove} /> : null}

      <Card style={{ gap: 10, marginTop: 6 }}>
        <Txt weight="semibold">{tr('مواعيد تتقاطع مع الصلاة', 'Appointments that meet a prayer')}</Txt>
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr('نقرأ مواعيد الأسبوع القادم من تقاويمك على جهازك، ونريك ما يقع فيه وقت صلاة لترتّب لها قبله.', 'We read next week’s appointments from your calendars on the device and show those a prayer time falls in, so you can plan for it.')}
        </Txt>
        <Button title={conflicts ? tr('أعد الفحص', 'Check again') : tr('افحص الأسبوع القادم', 'Check the coming week')} icon={CalendarClock} tone="soft" loading={busy === 'scan'} disabled={busy != null} onPress={scan} />
      </Card>
      {conflicts ? (
        conflicts.length ? (
          conflicts.map((c) => {
            const day = civilDateIn(c.at, location.timezone);
            return (
              <Card key={`${c.item.id}-${c.at.getTime()}`} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt weight="semibold" color={t.colors.primaryDeep}>
                    {`${fmt.prayer(c.prayer, c.isFriday)} — ${time(c.at)}`}
                  </Txt>
                  <Txt variant="caption" muted>{`${fmt.weekday(day)} ${fmt.civil(day)}`}</Txt>
                </View>
                <Txt numberOfLines={2}>{c.item.title}</Txt>
                <Txt variant="caption" muted>{`${time(c.item.start)} – ${time(c.item.end)}`}</Txt>
              </Card>
            );
          })
        ) : (
          <Card tone="soft">
            <Txt center color={t.colors.primaryDeep}>
              {tr('لا مواعيد تتقاطع مع الصلاة هذا الأسبوع.', 'No appointments meet a prayer this week.')}
            </Txt>
          </Card>
        )
      ) : null}
    </Screen>
  );
}
