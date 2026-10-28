// FlatList settings for long lists of text-heavy cards: render less ahead of the viewport so
// each scroll frame has less to mount, and let Android detach rows that are off screen.
import { Platform } from 'react-native';

export const listPerf = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  updateCellsBatchingPeriod: 40,
  windowSize: 9,
  removeClippedSubviews: Platform.OS === 'android',
} as const;
