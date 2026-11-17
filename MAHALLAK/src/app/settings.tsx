import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { Banner, Divider, GlassCard, Row, Segmented, Txt } from '@/design/Glass';
import { space } from '@/design/tokens';
import { getLexiconVersion } from '@/features/dialect/lexiconProvider';
import { useApp } from '@/state/appStore';
import { getItemService } from '@/state/services';

export default function Settings() {
  const { t } = useTranslation();
  const s = useApp((st) => st.settings);
  const update = useApp((st) => st.updateSettings);
  const [langNote, setLangNote] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  useEffect(() => {
    void getItemService().searchLogs().then((l) => setHistoryCount(l.length));
  }, []);

  return (
    <Screen back title={t('settings.title')} testID="settings">
      <Txt variant="headline">{t('settings.appearance')}</Txt>
      <GlassCard padding={space.md}>
        <View style={{ gap: space.md }}>
          <Segmented
            value={s.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: 'system', label: t('settings.system') },
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
            ]}
          />
          <Row
            icon="sparkle"
            title={t('settings.reduceTransparency')}
            subtitle={t('settings.reduceTransparencyHint')}
            right={<Toggle value={s.reduceTransparency} onChange={(v) => void update({ reduceTransparency: v })} />}
          />
        </View>
      </GlassCard>

      <Txt variant="headline">{t('settings.language')}</Txt>
      <GlassCard padding={space.md}>
        <Segmented
          value={s.language}
          onChange={(language) => {
            setLangNote(true);
            void update({ language });
          }}
          options={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]}
        />
        {langNote ? <Txt variant="caption" tone="tertiary" style={{ marginTop: 8 }}>{t('settings.langRestart')}</Txt> : null}
      </GlassCard>

      <Txt variant="headline">{t('settings.voice')}</Txt>
      <GlassCard padding={space.md}>
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          {t('settings.speechLang')}
        </Txt>
        <Segmented
          value={s.speechLang}
          onChange={(speechLang) => void update({ speechLang })}
          options={[
            { value: 'ar-SA', label: t('settings.speechAr') },
            { value: 'en-US', label: t('settings.speechEn') },
          ]}
        />
        <Row icon="history" title={t('settings.keepHistory')} right={<Toggle value={s.keepSearchHistory} onChange={(v) => void update({ keepSearchHistory: v })} />} />
        {historyCount > 0 ? (
          <>
            <Divider />
            <Row
              icon="trash"
              title={t('settings.clearHistory')}
              subtitle={String(historyCount)}
              onPress={async () => {
                await getItemService().clearSearchLogs();
                setHistoryCount(0);
              }}
            />
          </>
        ) : null}
        <Divider />
        <Row icon="phone" title={t('settings.haptics')} right={<Toggle value={s.haptics} onChange={(v) => void update({ haptics: v })} />} />
      </GlassCard>

      <Txt variant="headline">{t('settings.about')}</Txt>
      <GlassCard padding={space.md}>
        <Row icon="globe" title={t('settings.dialect')} subtitle={t('settings.dialectVersion', { v: getLexiconVersion() })} />
      </GlassCard>
      <Banner icon="shield" text={t('privacy.intro')} />
    </Screen>
  );
}
