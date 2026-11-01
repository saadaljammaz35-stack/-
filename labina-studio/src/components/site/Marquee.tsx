const WORDS = ["المواليد", "الأطفال", "أعياد الميلاد", "العائلات", "المناسبات", "ألبومات الصور", "تجارب إبداعية", "منتجات الأطفال"];
const DOTS = ["bg-coral", "bg-sun", "bg-lavender", "bg-teal"];

/** Slow band of session names between the hero and the services */
export function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pe-8" aria-hidden={hidden || undefined}>
      {WORDS.map((w, i) => (
        <li key={w} className="flex items-center gap-8 whitespace-nowrap font-display text-xl font-semibold text-cream md:text-2xl">
          {w}
          <span className={`size-3 rounded-[0.25rem] ${DOTS[i % DOTS.length]}`} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative -rotate-1 overflow-hidden bg-plum py-5 shadow-soft">
      <div className="flex w-max animate-[marquee_38s_linear_infinite] hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
