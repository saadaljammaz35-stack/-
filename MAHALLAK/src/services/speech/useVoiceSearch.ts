import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { initialVoiceState, voiceReducer } from './voiceState';

export interface VoiceSearchOptions {
  /** BCP-47 tag. Saudi Arabic by default. */
  lang?: string;
  /** Names of the user's own items: biases the recognizer toward words it will actually need. */
  contextualStrings?: string[];
  onFinal: (transcript: string) => void | Promise<void>;
}

/**
 * Microphone search. Speech is recognized by the platform recognizer (on-device
 * where the OS supports it); MAHALLAK never uploads or stores the audio.
 */
export function useVoiceSearch({ lang = 'ar-SA', contextualStrings = [], onFinal }: VoiceSearchOptions) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useSpeechRecognitionEvent('start', () => dispatch({ type: 'start' }));
  useSpeechRecognitionEvent('end', () => dispatch({ type: 'end' }));
  useSpeechRecognitionEvent('result', (e) =>
    dispatch({ type: 'result', transcript: e.results[0]?.transcript ?? '', isFinal: e.isFinal }),
  );
  useSpeechRecognitionEvent('error', (e) => dispatch({ type: 'error', code: e.error }));
  useSpeechRecognitionEvent('volumechange', (e) => dispatch({ type: 'volume', value: e.value }));

  useEffect(() => {
    if (state.status !== 'processing') return;
    let alive = true;
    Promise.resolve(onFinalRef.current(state.final)).finally(() => {
      if (alive) dispatch({ type: 'processed' });
    });
    return () => {
      alive = false;
    };
  }, [state.status, state.final]);

  const start = useCallback(async () => {
    dispatch({ type: 'request' });
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        dispatch({ type: 'denied' });
        return;
      }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        dispatch({ type: 'error', code: 'service-not-allowed' });
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        addsPunctuation: false,
        contextualStrings: contextualStrings.slice(0, 100),
        iosTaskHint: 'search',
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 90 },
      });
    } catch {
      dispatch({ type: 'error', code: 'audio-capture' });
    }
  }, [lang, contextualStrings]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const cancel = useCallback(() => {
    ExpoSpeechRecognitionModule.abort();
    dispatch({ type: 'reset' });
  }, []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, start, stop, cancel, reset };
}
