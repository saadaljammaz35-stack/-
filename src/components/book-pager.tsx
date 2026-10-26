// Pages that turn like an Arabic book: the first page on the right, the next one revealed by
// swiping towards the right. On iOS and Android this is the platform's native pager with an
// explicit right-to-left direction, which stays correct under the app's forced RTL layout
// (a horizontal list there opens at the wrong end and shows blank pages).
import { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';

import type { BookPagerProps } from './book-pager.types';

export type { BookPagerHandle } from './book-pager.types';

export function BookPager<T>({ data, initialIndex, keyOf, renderPage, onIndexChange, window = 1, ref }: BookPagerProps<T>) {
  const pager = useRef<PagerView>(null);
  const [current, setCurrent] = useState(initialIndex);

  useImperativeHandle(ref, () => ({
    goTo: (index, animated = true) => {
      const i = Math.max(0, Math.min(data.length - 1, index));
      setCurrent(i);
      if (animated) pager.current?.setPage(i);
      else pager.current?.setPageWithoutAnimation(i);
    },
  }));

  const onSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const i = Math.round(e.nativeEvent.position);
      setCurrent(i);
      onIndexChange(i);
    },
    [onIndexChange],
  );

  return (
    <PagerView ref={pager} style={{ flex: 1 }} initialPage={initialIndex} layoutDirection="rtl" offscreenPageLimit={1} onPageSelected={onSelected}>
      {data.map((item, i) => (
        // Far pages stay empty shells so a 604-page mushaf costs no more than three pages.
        <View key={keyOf(item, i)} collapsable={false} style={{ flex: 1 }}>
          {Math.abs(i - current) <= window ? renderPage(item, i) : null}
        </View>
      ))}
    </PagerView>
  );
}
