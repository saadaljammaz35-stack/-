/**
 * Voice search state machine, independent of the native module so it can be
 * tested and reused. The hook in useVoiceSearch.ts feeds it native events.
 */
export type VoiceStatus = 'idle' | 'requesting' | 'listening' | 'processing' | 'done' | 'error';

export type VoiceErrorKey =
  | 'mic_permission'
  | 'no_speech'
  | 'network'
  | 'mic_busy'
  | 'lang_unsupported'
  | 'unavailable'
  | 'busy'
  | 'interrupted'
  | 'unknown';

export interface VoiceState {
  status: VoiceStatus;
  partial: string;
  final: string;
  /** -2..10 from the recognizer, smoothed for the waveform. */
  level: number;
  error: VoiceErrorKey | null;
}

export type VoiceEvent =
  | { type: 'request' }
  | { type: 'denied' }
  | { type: 'start' }
  | { type: 'volume'; value: number }
  | { type: 'result'; transcript: string; isFinal: boolean }
  | { type: 'end' }
  | { type: 'error'; code: string }
  | { type: 'processed' }
  | { type: 'reset' };

export const initialVoiceState: VoiceState = { status: 'idle', partial: '', final: '', level: 0, error: null };

export function mapRecognizerError(code: string): VoiceErrorKey | null {
  switch (code) {
    case 'aborted':
      return null; // user cancelled: not an error
    case 'not-allowed':
      return 'mic_permission';
    case 'no-speech':
    case 'speech-timeout':
      return 'no_speech';
    case 'network':
      return 'network';
    case 'audio-capture':
      return 'mic_busy';
    case 'language-not-supported':
      return 'lang_unsupported';
    case 'service-not-allowed':
      return 'unavailable';
    case 'busy':
    case 'too-many-requests':
      return 'busy';
    case 'interrupted':
      return 'interrupted';
    default:
      return 'unknown';
  }
}

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'request':
      return { ...initialVoiceState, status: 'requesting' };
    case 'denied':
      return { ...state, status: 'error', error: 'mic_permission' };
    case 'start':
      return { ...state, status: 'listening', error: null };
    case 'volume':
      return { ...state, level: state.level * 0.6 + Math.max(0, event.value) * 0.4 };
    case 'result': {
      const t = event.transcript.trim();
      return event.isFinal ? { ...state, final: t, partial: t } : { ...state, partial: t };
    }
    case 'end': {
      if (state.status === 'error') return state;
      const text = state.final || state.partial;
      if (!text) return { ...state, status: 'error', error: 'no_speech', level: 0 };
      return { ...state, status: 'processing', final: text, level: 0 };
    }
    case 'error': {
      const key = mapRecognizerError(event.code);
      if (!key) return { ...initialVoiceState };
      // Some recognizers report "no-speech" after a usable partial result: keep it.
      if (key === 'no_speech' && (state.final || state.partial)) {
        return { ...state, status: 'processing', final: state.final || state.partial, level: 0 };
      }
      return { ...state, status: 'error', error: key, level: 0 };
    }
    case 'processed':
      return { ...state, status: 'done' };
    case 'reset':
      return { ...initialVoiceState };
  }
}
