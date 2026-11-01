import { CalendarDays } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

/** Shown until the studio uploads its own work from the dashboard */
export function GalleryEmpty() {
  return (
    <div className="grid items-center gap-10 rounded-[2rem] bg-paper p-6 shadow-soft md:grid-cols-2 md:p-12">
      <div className="grid grid-cols-4 grid-rows-3 gap-2.5" aria-hidden>
        <span className="col-span-1 row-span-1 aspect-square rounded-2xl bg-coral" />
        <span className="col-span-1 row-span-3 rounded-2xl bg-lavender" />
        <span className="col-span-1 row-span-2 rounded-2xl bg-sun" />
        <span className="col-span-1 row-span-3 rounded-2xl bg-plum" />
        <span className="col-span-1 row-span-2 rounded-2xl bg-teal" />
        <span className="col-span-1 row-span-1 aspect-square rounded-2xl bg-coral" />
      </div>
      <div>
        <p className="eyebrow mb-4">المعرض</p>
        <h3 className="font-display text-3xl font-bold leading-tight text-plum md:text-4xl">نجهّز معرضنا بصور من جلساتنا</h3>
        <p className="mt-4 leading-8 text-ink-soft">
          نشارككم هنا قريباً مختارات من جلسات المواليد والأطفال والعائلات. وإلى ذلك الحين، يسعدنا استقبالكم وترتيب جلستكم في الموعد الذي يناسبكم.
        </p>
        <ButtonLink href="/booking" className="mt-6" icon={<CalendarDays className="size-4" aria-hidden />}>
          احجز جلستك
        </ButtonLink>
      </div>
    </div>
  );
}
