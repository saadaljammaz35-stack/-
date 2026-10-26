// Pieces shared by the group khatma screens.
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

import { GroupError } from './group-khatma';

export function groupErrorText(e: unknown, tr: (ar: string, en: string) => string): string {
  const kind = e instanceof GroupError ? e.kind : 'unknown';
  if (kind === 'offline') return tr('تعذّر الاتصال، تحقق من الإنترنت.', 'Could not connect — check your internet.');
  if (kind === 'not-found') return tr('لم نجد ختمة بهذا الرمز.', 'No khatma with this code.');
  if (kind === 'taken') return tr('سبقك أحدهم إلى هذا الجزء.', 'Someone has just taken this juz.');
  if (kind === 'too-many') return tr('وصلت إلى الحد الأعلى من الختمات التي تنشئها.', 'You have reached the limit of khatmas you can create.');
  if (kind === 'not-finished') return tr('لم تكتمل الأجزاء الثلاثون بعد.', 'Not all thirty juz are read yet.');
  if (kind === 'not-yours') return tr('هذا الإجراء لصاحب الجزء أو منشئ الختمة.', 'Only the reader or the creator can do this.');
  return tr('حدث خطأ غير متوقع، حاول مرة أخرى.', 'Something went wrong — try again.');
}

export function NameField() {
  const t = useTheme();
  const { tr } = useI18n();
  const name = useGroupStore((s) => s.name);
  const setName = useGroupStore((s) => s.setName);
  const [draft, setDraft] = useState(name);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" muted>
        {tr('اسمك كما يراه المشاركون', 'Your name as others will see it')}
      </Txt>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => setName(draft)}
        onSubmitEditing={() => setName(draft)}
        maxLength={40}
        placeholder={tr('مثال: أبو عبدالله', 'e.g. Abu Abdullah')}
        placeholderTextColor={t.colors.textFaint}
        style={inputStyle(t)}
      />
    </View>
  );
}

export function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: t.fonts.regular,
    fontSize: 15,
    color: t.colors.text,
    textAlign: (t.isRTL ? 'right' : 'left') as 'right' | 'left',
  };
}
