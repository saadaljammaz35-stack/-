import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CameraCapture, type Captured } from '@/components/CameraCapture';
import { ResultCard } from '@/components/ItemCard';
import { Screen } from '@/components/Screen';
import { Banner, Button, Chip, Field, GlassCard, IconButton, Txt } from '@/design/Glass';
import { MicOrb, VoiceWave } from '@/design/MicOrb';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { getCompiledLexicon } from '@/features/dialect/lexiconProvider';
import { AiError, recognizeItem } from '@/services/ai/aiClient';
import { photoForAi } from '@/services/media/imageService';
import { runSearch, type SearchOutcome } from '@/services/searchService';
import { useVoiceSearch } from '@/services/speech/useVoiceSearch';
import { useApp } from '@/state/appStore';
import { getItemService } from '@/state/services';
import { useDraft } from '@/state/draft';

export default function VoiceSearch() {
  const params = useLocalSearchParams<{ listen?: string; q?: string; mode?: string }>();
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const items = useApp((s) => s.items);
  const settings = useApp((s) => s.settings);
  const [text, setText] = useState(params.q ?? '');
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [imageState, setImageState] = useState<'camera' | 'working' | 'done' | 'error'>(params.mode === 'image' ? 'camera' : 'done');
  const [imageError, setImageError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const contextual = useMemo(
    () => [...new Set(items.flatMap((i) => [i.name, ...i.keywords]))].slice(0, 100),
    [items],
  );

  const search = useCallback(
    async (query: string, source: 'voice' | 'text' | 'image') => {
      const q = query.trim();
      if (!q) return;
      const state = useApp.getState();
      const res = await runSearch(q, {
        index: state.index,
        lex: getCompiledLexicon(),
        ai: state.settings.aiConsent && state.session ? state.aiGate() : null,
      });
      setLastQuery(q);
      setOutcome(res);
      void getItemService().logSearch(
        {
          transcript: q,
          intent: res.query.intent,
          confidence: res.query.confidence,
          dialectHints: res.query.dialectHints,
          resultCount: res.hits.length,
          source,
        },
        state.settings.keepSearchHistory,
      );
    },
    [],
  );

  const voice = useVoiceSearch({ lang: settings.speechLang, contextualStrings: contextual, onFinal: (tx) => search(tx, 'voice') });
  const listening = voice.state.status === 'listening' || voice.state.status === 'requesting';

  useEffect(() => {
    // Runs once when the screen opens: either the query passed from Home, or the microphone.
    // search() only updates state after its asynchronous lookup resolves.
    if (params.q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void search(params.q, 'text');
    } else if (params.listen && !autoStarted.current) {
      autoStarted.current = true;
      void voice.start();
    }
    // run once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onImage = async (img: Captured) => {
    const state = useApp.getState();
    if (!state.session || !state.settings.aiConsent) {
      setImageState('error');
      setImageError(t('voice.imageNeedsAi'));
      return;
    }
    setImageState('working');
    try {
      const b64 = await photoForAi(img.uri, img);
      const r = await recognizeItem(state.aiGate(), b64, i18n.language);
      setImageState('done');
      await search([r.nameAr, r.nameEn, ...r.keywords].filter(Boolean).join(' '), 'image');
    } catch (e) {
      setImageState('error');
      setImageError(e instanceof AiError && e.code === 'consent_required' ? t('voice.imageNeedsAi') : t('add.aiFailed'));
    }
  };

  const status = voice.state.status;
  const statusText =
    status === 'listening'
      ? t('voice.listening')
      : status === 'processing'
        ? t('voice.processing')
        : status === 'requesting'
          ? '…'
          : t('voice.tapToSpeak');

  const strong = outcome?.hits.filter((h) => h.strength === 'strong') ?? [];
  const weakOnly = outcome && outcome.hits.length > 0 && strong.length === 0;

  return (
    <Screen
      testID="voice"
      right={<IconButton name="close" label={t('common.close')} onPress={() => (voice.cancel(), router.back())} testID="voice-close" />}
      contentStyle={{ gap: space.md }}
    >
      {params.mode === 'image' && imageState !== 'done' ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="title">{t('home.imageSearch')}</Txt>
          {imageState === 'camera' ? <CameraCapture onCaptured={(img) => void onImage(img)} testID="image-search" /> : null}
          {imageState === 'working' ? <Banner text={t('voice.imageSearching')} /> : null}
          {imageState === 'error' && imageError ? (
            <>
              <Banner tone="warning" text={imageError} />
              <Button kind="glass" title={t('common.retry')} onPress={() => setImageState('camera')} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.hero}>
          <MicOrb
            size={170}
            listening={listening}
            level={voice.state.level}
            label={listening ? t('voice.tapToStop') : t('voice.tapToSpeak')}
            onPress={() => (listening ? voice.stop() : void voice.start())}
            testID="voice-mic"
          />
          <VoiceWave level={voice.state.level} active={status === 'listening'} />
          <Txt variant="callout" tone="secondary" align="center" testID="voice-status">
            {statusText}
          </Txt>
          {voice.state.partial ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <Txt variant="title" align="center" testID="voice-transcript">
                «{voice.state.partial}»
              </Txt>
            </Animated.View>
          ) : null}
        </View>
      )}

      {voice.state.error ? (
        <Banner
          tone="warning"
          icon="mic"
          text={t(`voice.errors.${voice.state.error}`)}
          action={voice.state.error === 'mic_permission' ? t('voice.openSettings') : t('common.retry')}
          onAction={() => (voice.state.error === 'mic_permission' ? void Linking.openSettings() : void voice.start())}
        />
      ) : null}

      <Field
        icon="search"
        placeholder={t('voice.typeInstead')}
        value={text}
        onChangeText={setText}
        returnKeyType="search"
        onSubmitEditing={() => void search(text, 'text')}
        testID="voice-text"
      />

      {!outcome ? (
        <View style={{ gap: space.xs }}>
          <Txt variant="caption" tone="secondary">
            {t('voice.examplesTitle')}
          </Txt>
          <View style={styles.examples}>
            {(['ex1', 'ex2', 'ex3'] as const).map((k) => (
              <Chip key={k} label={t(`voice.${k}`)} onPress={() => (setText(t(`voice.${k}`)), void search(t(`voice.${k}`), 'text'))} />
            ))}
          </View>
        </View>
      ) : null}

      {outcome ? (
        <View style={{ gap: space.sm }} testID="voice-results">
          {outcome.usedAi && outcome.hits.length > 0 ? <Banner icon="sparkle" text={t('voice.aiUsed')} /> : null}

          {outcome.status === 'smalltalk' ? <Banner icon="sparkle" text={t('voice.smalltalk')} /> : null}

          {outcome.status === 'needs_rephrase' ? (
            <GlassCard padding={space.lg} testID="voice-rephrase">
              <Txt variant="headline">{t('voice.rephraseTitle')}</Txt>
              <Txt tone="secondary">{t('voice.rephraseBody')}</Txt>
            </GlassCard>
          ) : null}

          {outcome.status === 'no_match' ? (
            <GlassCard padding={space.lg} testID="voice-not-found">
              <View style={{ gap: space.xs }}>
                <Txt variant="headline">{t('voice.notFoundTitle')}</Txt>
                <Txt tone="secondary">{t('voice.notFoundBody', { query: lastQuery })}</Txt>
                <Button
                  title={t('voice.addIt')}
                  icon="plus"
                  onPress={() => {
                    useDraft.getState().start('create');
                    router.replace('/add/item');
                  }}
                  style={{ marginTop: space.xs }}
                />
              </View>
            </GlassCard>
          ) : null}

          {outcome.status === 'ok' ? (
            <>
              <Txt variant="headline">
                {outcome.query.intent === 'list_location' && outcome.places[0]
                  ? t('voice.inPlace', { place: outcome.places[0].spot })
                  : outcome.query.intent === 'recent'
                    ? t('voice.recentTitle')
                    : weakOnly
                      ? t('voice.weakTitle')
                      : t('voice.resultsTitle')}
              </Txt>
              {outcome.hits.slice(0, 12).map((h, k) => (
                <ResultCard key={h.item.id} item={h.item} place={h.place} testID={`result-${k}`} />
              ))}
              {outcome.query.intent === 'item_history' && outcome.hits[0] ? (
                <Button kind="glass" icon="history" title={t('item.history')} onPress={() => router.push(`/item/${outcome.hits[0].item.id}/history`)} />
              ) : null}
              <Txt variant="caption" tone="tertiary" align="center">
                {t('item.disclaimer')}
              </Txt>
            </>
          ) : null}
        </View>
      ) : null}
      <View style={{ height: 1, backgroundColor: c.hairline, opacity: 0 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
