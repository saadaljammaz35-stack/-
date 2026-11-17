import type { CategoryId, ColorId, RoomId } from './categories';

export type ImageKind = 'item_original' | 'item_cutout' | 'location';

export interface ImageRef {
  id: string;
  kind: ImageKind;
  /** File in the app's private document directory. Never a public URL. */
  localUri: string | null;
  /** Object path inside the private Supabase bucket, set after an opted-in upload. */
  remotePath: string | null;
  width: number;
  height: number;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  nameEn: string | null;
  category: CategoryId;
  color: ColorId | null;
  /** Alternative names: user aliases and AI-suggested keywords. */
  keywords: string[];
  /** Group tags such as "travel" or "camping". */
  tags: string[];
  notes: string | null;
  favorite: boolean;
  originalImageId: string | null;
  cutoutImageId: string | null;
  currentLocationId: string | null;
  /** How the item was created, kept for transparency about AI involvement. */
  source: 'manual' | 'ai_single' | 'ai_room';
  createdAt: string;
  updatedAt: string;
  lastMovedAt: string | null;
  deletedAt: string | null;
}

export interface Place {
  id: string;
  room: RoomId;
  /** Custom room name ("غرفة سارة"). */
  roomLabel: string | null;
  /** Drawer, shelf or box description ("الدرج الثاني في المكتب"). */
  spot: string;
  note: string | null;
  imageId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Immutable snapshot of where an item was put. Survives later edits to the place. */
export interface PlacementEvent {
  id: string;
  itemId: string;
  placeId: string;
  room: RoomId;
  roomLabel: string | null;
  spot: string;
  note: string | null;
  imageId: string | null;
  placedAt: string;
  createdAt: string;
}

export interface VoiceSearchLog {
  id: string;
  transcript: string;
  intent: string;
  confidence: number;
  dialectHints: string[];
  resultCount: number;
  source: 'voice' | 'text' | 'image';
  createdAt: string;
}

export interface ItemWithPlace {
  item: Item;
  place: Place | null;
  image: ImageRef | null;
  placeImage: ImageRef | null;
}
