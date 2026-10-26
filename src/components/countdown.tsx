// A self-ticking «01:23:45» countdown. Only this text re-renders every second, so the screen
// around it can update far less often.
import type { ComponentProps } from 'react';

import { useNow } from '@/hooks/time';
import { formatCountdown, type DigitStyle } from '@/lib/time';

import { Txt } from './ui';

export function Countdown({ target, digits, ...rest }: { target: number; digits: DigitStyle } & Omit<ComponentProps<typeof Txt>, 'children'>) {
  const now = useNow(1000);
  return <Txt {...rest}>{formatCountdown(target - now.getTime(), digits)}</Txt>;
}
