'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}

/** A paragraph whose words light up, like ink soaking in, as it scrolls through view. */
export function ScrubText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 88%', 'end 52%'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => {
        const start = i / words.length;
        const end = Math.min(1, start + 2.5 / words.length);
        return (
          <span key={i}>
            <Word progress={scrollYProgress} range={[start, end]}>
              {w}
            </Word>
            {i < words.length - 1 ? ' ' : null}
          </span>
        );
      })}
    </p>
  );
}
