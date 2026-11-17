import { create } from 'zustand';

import type { CategoryId, ColorId, RoomId } from '@/domain/categories';
import type { RecognizedItem } from '@/services/ai/aiClient';
import type { StoredPhoto } from '@/services/media/imageService';

export type AiStatus = 'idle' | 'working' | 'done' | 'off' | 'failed' | 'quota';
export type BgStatus = 'idle' | 'working' | 'done' | 'kept';

export interface ItemFields {
  name: string;
  nameEn: string;
  category: CategoryId;
  color: ColorId | null;
  keywords: string;
  tags: string[];
  notes: string;
}

export interface PlaceFields {
  placeId: string | null;
  room: RoomId;
  roomLabel: string;
  spot: string;
  note: string;
}

interface DraftState {
  mode: 'create' | 'move' | 'edit';
  itemId: string | null;
  original: StoredPhoto | null;
  cutout: StoredPhoto | null;
  ai: RecognizedItem | null;
  aiStatus: AiStatus;
  bgStatus: BgStatus;
  fields: ItemFields;
  place: PlaceFields;
  placePhoto: StoredPhoto | null;
  start: (mode: 'create' | 'move' | 'edit', itemId?: string) => void;
  patch: (p: Partial<Omit<DraftState, 'fields' | 'place'>>) => void;
  setFields: (p: Partial<ItemFields>) => void;
  setPlace: (p: Partial<PlaceFields>) => void;
}

const emptyFields: ItemFields = { name: '', nameEn: '', category: 'other', color: null, keywords: '', tags: [], notes: '' };
const emptyPlace: PlaceFields = { placeId: null, room: 'bedroom', roomLabel: '', spot: '', note: '' };

export const useDraft = create<DraftState>((set) => ({
  mode: 'create',
  itemId: null,
  original: null,
  cutout: null,
  ai: null,
  aiStatus: 'idle',
  bgStatus: 'idle',
  fields: emptyFields,
  place: emptyPlace,
  placePhoto: null,
  start: (mode, itemId) =>
    set({ mode, itemId: itemId ?? null, original: null, cutout: null, ai: null, aiStatus: 'idle', bgStatus: 'idle', fields: emptyFields, place: emptyPlace, placePhoto: null }),
  patch: (p) => set(p),
  setFields: (p) => set((s) => ({ fields: { ...s.fields, ...p } })),
  setPlace: (p) => set((s) => ({ place: { ...s.place, ...p } })),
}));
