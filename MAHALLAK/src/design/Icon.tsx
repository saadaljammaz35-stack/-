import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { isRTL } from './rtl';

/** MAHALLAK icon set: 24px grid, 1.8 stroke, rounded joins. Drawn for this app. */
type Prim = ['p', string] | ['c', number, number, number] | ['r', number, number, number, number, number];

const ICONS = {
  home: [['p', 'M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z']],
  grid: [['r', 3.5, 3.5, 7, 7, 2], ['r', 13.5, 3.5, 7, 7, 2], ['r', 3.5, 13.5, 7, 7, 2], ['r', 13.5, 13.5, 7, 7, 2]],
  heart: [['p', 'M12 20s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z']],
  user: [['c', 12, 8, 4], ['p', 'M4.5 20.5c.6-3.9 3.7-6 7.5-6s6.9 2.1 7.5 6']],
  mic: [['r', 9, 3, 6, 11.5, 3], ['p', 'M5.5 11.5a6.5 6.5 0 0 0 13 0'], ['p', 'M12 18v3']],
  search: [['c', 11, 11, 6.5], ['p', 'm16 16 4.5 4.5']],
  plus: [['p', 'M12 5v14M5 12h14']],
  camera: [['p', 'M4.5 7.5h3l1.8-2.5h5.4l1.8 2.5h3a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9a1.5 1.5 0 0 1 1.5-1.5z'], ['c', 12, 13.2, 3.5]],
  image: [['r', 3, 4, 18, 16, 2.5], ['c', 8.5, 9.5, 1.6], ['p', 'm21 15.5-5-5-9.5 9.5']],
  pin: [['p', 'M12 21s-6.5-5.6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z'], ['c', 12, 9.8, 2.3]],
  clock: [['c', 12, 12, 8.5], ['p', 'M12 7.5V12l3 2']],
  sliders: [['p', 'M4 7h9M17 7h3M4 17h3M11 17h9'], ['c', 15, 7, 2], ['c', 9, 17, 2]],
  shield: [['p', 'M12 3.2 19.5 6v5.6c0 4.4-3.1 8-7.5 9.2-4.4-1.2-7.5-4.8-7.5-9.2V6z'], ['p', 'm9 12 2.2 2.2L15.2 10']],
  sparkle: [['p', 'M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9z'], ['p', 'M18.5 3.5v3M17 5h3']],
  chevron: [['p', 'm9.5 5.5 6.5 6.5-6.5 6.5']],
  back: [['p', 'm9.5 5.5 6.5 6.5-6.5 6.5']],
  close: [['p', 'M6.5 6.5l11 11M17.5 6.5l-11 11']],
  check: [['p', 'm5 12.5 4.5 4.5L19 7.5']],
  trash: [['p', 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13']],
  edit: [['p', 'M4.5 19.5h4l10-10-4-4-10 10z'], ['p', 'm13 7 4 4']],
  move: [['p', 'M6 8h12l-3-3M18 16H6l3 3']],
  cloud: [['p', 'M7.5 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18.4 9.2 4.7 4.7 0 0 1 17.5 18.5z']],
  share: [['p', 'M12 3.5v11M8 7.5l4-4 4 4'], ['p', 'M5 13v6.5h14V13']],
  globe: [['c', 12, 12, 8.5], ['p', 'M3.5 12h17M12 3.5c2.6 3 2.6 14 0 17M12 3.5c-2.6 3-2.6 14 0 17']],
  moon: [['p', 'M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z']],
  logout: [['p', 'M14.5 4.5h4v15h-4M10 8l-4 4 4 4M6 12h10']],
  phone: [['r', 7, 2.5, 10, 19, 2.5], ['p', 'M10.8 18.5h2.4']],
  lock: [['r', 5, 10.5, 14, 10, 2.5], ['p', 'M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3']],
  bolt: [['p', 'M13 3 5.5 13.5h6L10.5 21l8-10.5h-6z']],
  refresh: [['p', 'M19.5 11A7.5 7.5 0 0 0 6.4 6.6L4.5 8.5M4.5 13a7.5 7.5 0 0 0 13.1 4.4l1.9-1.9'], ['p', 'M4.5 4.5v4h4M19.5 19.5v-4h-4']],
  scan: [['p', 'M4 8.5v-3A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3'], ['r', 8, 8, 8, 8, 2]],
  history: [['p', 'M4 12a8 8 0 1 0 2.3-5.6'], ['p', 'M4 4.5V8h3.5'], ['p', 'M12 8v4.2l2.8 1.8']],
  shirt: [['p', 'M8.5 4 4 6.8l1.8 3.4 2.2-1v10.3h8V9.2l2.2 1L20 6.8 15.5 4a3.5 3.5 0 0 1-7 0z']],
  shoe: [['p', 'M3.5 17.5V9.5c1.6 0 3.3 1.6 4 3h3l2.5 2.2 5.2 1c1 .2 2.3 1.1 2.3 2.3v.5h-17z'], ['p', 'M3.5 17.5h17']],
  device: [['r', 6.5, 2.5, 11, 19, 2.5], ['p', 'M11 18h2']],
  wrench: [['p', 'M14.6 4a4.4 4.4 0 0 0-4.2 5.8L4.2 16a1.9 1.9 0 0 0 2.7 2.7l6.2-6.2A4.4 4.4 0 0 0 20 8.4l-2.6 2.6-2.6-.6-.6-2.6L16.8 5a4.4 4.4 0 0 0-2.2-1z']],
  bag: [['p', 'M5 8h14l-1.2 12.5H6.2z'], ['p', 'M9 10V7a3 3 0 0 1 6 0v3']],
  key: [['c', 8, 15.5, 4], ['p', 'M11 12.5 19.5 4M16 7.5l2.2 2.2M13.7 9.8l1.8 1.8']],
  toy: [['p', 'M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7z'], ['p', 'M4.5 7.7 12 12l7.5-4.3M12 12v8.5']],
  book: [['p', 'M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z'], ['p', 'M5 20a2 2 0 0 0 2 1h12v-3']],
  watch: [['c', 12, 12, 5], ['p', 'M9 7.5 10 3h4l1 4.5M9 16.5l1 4.5h4l1-4.5M12 10v2.2l1.4 1']],
  doc: [['p', 'M6 3h8.5L18 6.5V21H6z'], ['p', 'M14 3v4h4M9 12h6M9 16h6']],
  box: [['p', 'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z'], ['p', 'M3.5 7.5 12 11.5l8.5-4M12 11.5v9']],
  apple: [['p', 'M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.9-.8-3.1-.8C6.8 7.4 5 8.9 5 11.8c0 1.8.7 3.7 1.5 4.9.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2a8.9 8.9 0 0 0 1.2-2.4c-.1 0-2.2-.8-2.2-3.4zM14.3 5.9c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z']],
} satisfies Record<string, Prim[]>;

export type IconName = keyof typeof ICONS;

/** "chevron" points forward (toward the end), "back" points toward the start, in both directions. */
const flipFor = (name: IconName) => (name === 'chevron' ? isRTL() : name === 'back' ? !isRTL() : false);

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.8,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const prims = ICONS[name] as Prim[];
  const flip = flipFor(name);
  const solid = name === 'apple';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...(flip ? { transform: [{ scaleX: -1 }] } : null) }}>
      {prims.map((p, i) => {
        const common = {
          stroke: solid ? 'none' : color,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: solid ? color : fill,
        };
        if (p[0] === 'p') return <Path key={i} {...common} d={p[1]} />;
        if (p[0] === 'c') return <Circle key={i} {...common} cx={p[1]} cy={p[2]} r={p[3]} />;
        return <Rect key={i} {...common} x={p[1]} y={p[2]} width={p[3]} height={p[4]} rx={p[5]} />;
      })}
    </Svg>
  );
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}
