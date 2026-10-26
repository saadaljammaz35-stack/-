import type { ReactNode, Ref } from 'react';

export type BookPagerHandle = {
  /** Shows page `index` (0 = the first page, which sits on the right). */
  goTo: (index: number, animated?: boolean) => void;
};

export type BookPagerProps<T> = {
  data: readonly T[];
  initialIndex: number;
  keyOf: (item: T, index: number) => string;
  renderPage: (item: T, index: number) => ReactNode;
  onIndexChange: (index: number) => void;
  width: number;
  /** Pages kept rendered on each side of the one in view. */
  window?: number;
  ref?: Ref<BookPagerHandle>;
};
