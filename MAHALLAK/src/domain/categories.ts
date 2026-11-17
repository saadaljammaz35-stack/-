export const CATEGORY_IDS = [
  'clothing',
  'shoes',
  'electronics',
  'tools',
  'bags',
  'keys',
  'toys',
  'books',
  'accessories',
  'documents',
  'household',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Icon names map to the app's own SVG icon set (src/design/icons). */
export const CATEGORY_ICON: Record<CategoryId, string> = {
  clothing: 'shirt',
  shoes: 'shoe',
  electronics: 'device',
  tools: 'wrench',
  bags: 'bag',
  keys: 'key',
  toys: 'toy',
  books: 'book',
  accessories: 'watch',
  documents: 'doc',
  household: 'home',
  other: 'box',
};

export const COLOR_IDS = [
  'white',
  'black',
  'gray',
  'silver',
  'gold',
  'beige',
  'brown',
  'red',
  'pink',
  'orange',
  'yellow',
  'green',
  'blue',
  'navy',
  'purple',
] as const;
export type ColorId = (typeof COLOR_IDS)[number];

export const COLOR_SWATCH: Record<ColorId, string> = {
  white: '#FFFFFF',
  black: '#1B1B1B',
  gray: '#8E9390',
  silver: '#C9CDD2',
  gold: '#C5A66A',
  beige: '#E9DCC2',
  brown: '#7A5537',
  red: '#C8423B',
  pink: '#E79BB0',
  orange: '#E58A3A',
  yellow: '#E8C547',
  green: '#3F8A5E',
  blue: '#3C7DD9',
  navy: '#1F2F56',
  purple: '#7B5AA6',
};

export function isColorId(value: unknown): value is ColorId {
  return typeof value === 'string' && (COLOR_IDS as readonly string[]).includes(value);
}

export const ROOM_IDS = [
  'bedroom',
  'kids_room',
  'majlis',
  'living',
  'kitchen',
  'bathroom',
  'office',
  'storage',
  'garage',
  'roof',
  'car',
  'other',
] as const;
export type RoomId = (typeof ROOM_IDS)[number];

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === 'string' && (ROOM_IDS as readonly string[]).includes(value);
}
