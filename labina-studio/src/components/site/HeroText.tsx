"use client";

import { motion } from "framer-motion";
import { ArrowDown, CalendarDays } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EASE } from "@/components/ui/Motion";

function splitTitle(title: string): [string, string | null] {
  const i = title.indexOf("..");
  if (i === -1) return [title, null];
  return [title.slice(0, i + 2).trim(), title.slice(i + 2).trim() || null];
}

export function HeroText({ eyebrow, title, subtitle, facts }: { eyebrow: string; title: string; subtitle: string; facts: string[] }) {
  const [line1, line2] = splitTitle(title);
  let wordIndex = 0;
  const words = (line: string) =>
    line.split(" ").map((w) => {
      const i = wordIndex++;
      return (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: "0.5em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.09 }}
        >
          {w}&nbsp;
        </motion.span>
      );
    });

  return (
    <div>
      {eyebrow && (
        <motion.p className="eyebrow mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          {eyebrow}
        </motion.p>
      )}
      <h1 className="text-[clamp(2.5rem,7.4vw,5rem)] font-extrabold leading-[1.12] text-plum">
        <span className="block">{words(line1)}</span>
        {line2 && (
          <span className="relative mt-1 block w-fit">
            <motion.span
              aria-hidden
              className="absolute inset-x-0 bottom-[0.1em] -z-10 h-[0.32em] origin-right rounded-md bg-sun/80"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
            />
            {words(line2)}
          </span>
        )}
      </h1>
      <motion.p
        className="mt-6 max-w-xl text-lg leading-9 text-ink-soft md:text-xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
      >
        {subtitle}
      </motion.p>
      <motion.div
        className="mt-9 flex flex-col gap-3 sm:flex-row"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}
      >
        <ButtonLink href="/booking" size="lg" icon={<CalendarDays className="size-5" aria-hidden />}>
          احجز جلستك الآن
        </ButtonLink>
        <ButtonLink href="/#services" size="lg" variant="outline" icon={<ArrowDown className="size-5" aria-hidden />}>
          اكتشف خدماتنا
        </ButtonLink>
      </motion.div>
      {facts.length > 0 && (
        <motion.ul
          className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          {facts.map((f, i) => (
            <li key={f} className="flex items-center gap-2">
              <span className={["size-2.5 rounded-[0.2rem] bg-coral", "size-2.5 rounded-[0.2rem] bg-teal", "size-2.5 rounded-[0.2rem] bg-lavender"][i % 3]} aria-hidden />
              {f}
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
