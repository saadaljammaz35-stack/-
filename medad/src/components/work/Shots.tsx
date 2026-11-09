import Image from 'next/image';
import type { ProjectSlug } from '@/content/types';

/** Real screenshot of a live project inside a minimal browser frame. */
export function DesktopShot({
  slug,
  alt,
  sizes,
  className = '',
  priority = false,
}: {
  slug: ProjectSlug;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#0d1220] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] ${className}`}
    >
      <div className="flex h-7 items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3" dir="ltr" aria-hidden="true">
        <span className="size-2 rounded-full bg-white/25" />
        <span className="size-2 rounded-full bg-white/25" />
        <span className="size-2 rounded-full bg-white/25" />
        <span className="mx-auto h-3.5 w-1/3 rounded-full bg-white/[0.07]" />
      </div>
      <Image
        src={`/work/${slug}-desktop.webp`}
        alt={alt}
        width={1600}
        height={1000}
        sizes={sizes}
        priority={priority}
        className="block h-auto w-full"
      />
    </figure>
  );
}

/** Real mobile screenshot inside a phone frame. */
export function MobileShot({
  slug,
  alt,
  sizes,
  className = '',
}: {
  slug: ProjectSlug;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <figure
      className={`rounded-[2rem] border border-white/20 bg-[#05070b] p-[4%] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.85),inset_0_0_0_1px_rgb(255_255_255/0.06)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[1.55rem]">
        <span aria-hidden="true" className="absolute top-[1.4%] left-1/2 z-10 h-[2.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
        <Image
          src={`/work/${slug}-mobile.webp`}
          alt={alt}
          width={540}
          height={1169}
          sizes={sizes}
          className="block h-auto w-full"
        />
      </div>
    </figure>
  );
}
