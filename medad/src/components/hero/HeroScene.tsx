'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { InkSculpture } from './InkSculpture';

/**
 * Client shell of the hero: tracks how far the hero has scrolled away and
 * feeds it to the sculpture and the text layers (depth parallax on exit).
 */
export function HeroScene({
  backdrop,
  wordmark,
  children,
  sculptureLabel,
}: {
  backdrop: ReactNode;
  wordmark: ReactNode;
  children: ReactNode;
  sculptureLabel: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const wordY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const wordOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const stageOpacity = useTransform(scrollYProgress, [0.2, 0.95], [1, 0]);

  return (
    <section
      ref={ref}
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
    >
      {backdrop}
      <motion.div className="absolute inset-0 -z-10" style={{ y: wordY, opacity: wordOpacity }}>
        {wordmark}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[36%] -z-[5] sm:top-[7%] sm:bottom-[34%] lg:top-[8%] lg:bottom-[32%] xl:bottom-[23%] [@media(min-width:1280px)_and_(max-height:820px)]:bottom-[30%]"
        style={{ opacity: stageOpacity }}
      >
        <InkSculpture label={sculptureLabel} scroll={scrollYProgress} className="hero-fade size-full" />
      </motion.div>
      <motion.div className="relative flex flex-1 flex-col" style={{ y: contentY, opacity: contentOpacity }}>
        {children}
      </motion.div>
    </section>
  );
}
