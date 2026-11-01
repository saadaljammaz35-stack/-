"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { MARK_BLOCKS } from "./Logo";
import { BalloonArt, CameraArt, FamilyArt, HeartArt, NightArt, ShutterArt, SmileArt, SparkleArt } from "./Illustrations";
import { EASE } from "@/components/ui/Motion";
import { cn } from "@/lib/cn";

type Extra = { art: ReactNode; label?: string; imageIndex?: number; delay: number; float?: string };

/* Each block of the brand mark becomes a frame. Tall blocks hold the studio's
   hero photos when set from the dashboard, otherwise a drawn illustration. */
const EXTRAS: Record<string, Extra> = {
  h: { art: <NightArt />, label: "المواليد", imageIndex: 0, delay: 0.15 },
  f: { art: <BalloonArt />, label: "أعياد الميلاد", imageIndex: 1, delay: 0.3 },
  e: { art: <CameraArt />, label: "الأطفال", imageIndex: 2, delay: 0.22 },
  c: { art: <FamilyArt />, label: "العائلات", imageIndex: 3, delay: 0.08 },
  a: { art: <SparkleArt />, delay: 0.62, float: "[animation-delay:-1s]" },
  b: { art: <HeartArt />, delay: 0.5, float: "[animation-delay:-3s]" },
  d: { art: <SmileArt />, delay: 0.56, float: "[animation-delay:-5s]" },
  g: { art: <ShutterArt />, delay: 0.42, float: "[animation-delay:-2s]" },
};

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export function BrickMosaic({ images = [], className }: { images?: string[]; className?: string }) {
  return (
    <div className={cn("relative aspect-[600/539] w-full", className)} dir="ltr">
      {MARK_BLOCKS.map((b) => {
        const extra = EXTRAS[b.key];
        const image = extra.imageIndex !== undefined ? images[extra.imageIndex] : undefined;
        const isSmall = b.h < 120;
        return (
          <motion.div
            key={b.key}
            className="absolute"
            style={{ left: pct(b.x, 600), top: pct(b.y, 539), width: pct(b.w, 600), height: pct(b.h, 539) }}
            initial={{ opacity: 0, y: 70, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: EASE, delay: extra.delay }}
          >
            <motion.div
              whileHover={{ y: -8, rotate: isSmall ? -4 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={cn(
                "group relative h-full w-full overflow-hidden rounded-[clamp(10px,2.3vw,22px)] shadow-soft",
                isSmall && "animate-float",
                extra.float,
              )}
              style={{ background: b.fill }}
            >
              {image ? (
                <>
                  <Image
                    src={image}
                    alt={extra.label ? `صورة من جلسات ${extra.label}` : ""}
                    fill
                    sizes="(min-width: 1024px) 14vw, 28vw"
                    className="object-cover transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-105"
                    preload={b.key === "h"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-plum/45 via-transparent to-transparent" />
                </>
              ) : (
                <div className={cn("absolute inset-0 flex items-center justify-center", isSmall ? "p-[14%]" : "px-[10%] pb-[18%] pt-[8%]")}>
                  {extra.art}
                </div>
              )}
              {extra.label && (
                <span className="absolute bottom-[5%] right-1/2 hidden translate-x-1/2 whitespace-nowrap rounded-full bg-paper/92 px-2.5 py-1 text-[clamp(0.6rem,0.9vw,0.78rem)] font-semibold text-plum shadow-sm sm:block" dir="rtl">
                  {extra.label}
                </span>
              )}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
