'use client';

import { motion, useInView } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * Motion respects the visitor's reduced-motion setting through <MotionConfig reducedMotion="user"> in the
 * layout: movement is dropped and only opacity fades remain. The rendered element tree is identical on server
 * and client, which keeps hydration stable.
 */

/**
 * Fades content up once as it scrolls into view. Content is visible in the server HTML (no JavaScript, crawlers,
 * screenshots); only blocks that start below the fold are hidden after mount and then revealed.
 */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  useEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight) queueMicrotask(() => setArmed(true));
  }, []);
  const Component = motion[as];
  return (
    <Component
      ref={ref as never}
      className={className}
      initial={false}
      animate={!armed ? undefined : inView ? 'shown' : 'hidden'}
      variants={{
        hidden: { opacity: 0, y: 24, transition: { duration: 0 } },
        shown: { opacity: 1, y: 0, transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </Component>
  );
}

/** Reveals a headline word by word, like the Wared teaser. */
export function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, y: '0.35em', filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: delay + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
