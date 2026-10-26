// Web version of the book pager: a left-to-right list with the pages reversed, so the first
// page sits at the right edge and swiping towards the right reveals the next one.
import { useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { BookPagerProps } from './book-pager.types';

export type { BookPagerHandle } from './book-pager.types';

export function BookPager<T>({ data, initialIndex, keyOf, renderPage, onIndexChange, width, window = 1, ref }: BookPagerProps<T>) {
  const list = useRef<FlatList<number>>(null);
  const last = data.length - 1;
  // Positions in the list, right to left: position 0 is the last page.
  const order = useMemo(() => Array.from({ length: data.length }, (_, i) => last - i), [data.length, last]);

  useImperativeHandle(ref, () => ({
    goTo: (index, animated = true) => {
      const i = Math.max(0, Math.min(last, index));
      list.current?.scrollToIndex({ index: last - i, animated });
    },
  }));

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => onIndexChange(last - Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <FlatList
      ref={list}
      data={order}
      keyExtractor={(i) => keyOf(data[i], i)}
      horizontal
      pagingEnabled
      style={{ direction: 'ltr' }}
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={last - initialIndex}
      getItemLayout={(_, pos) => ({ length: width, offset: width * pos, index: pos })}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      windowSize={1 + window * 2}
      onMomentumScrollEnd={onEnd}
      renderItem={({ item: i }) => <View style={{ width, direction: 'rtl' }}>{renderPage(data[i], i)}</View>}
    />
  );
}
