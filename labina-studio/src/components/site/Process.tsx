import { SectionHeading } from "./SectionHeading";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import { cn } from "@/lib/cn";

const STEPS = [
  { title: "اختاروا الجلسة والموعد", text: "من صفحة الحجز تختارون نوع الجلسة واليوم والوقت المتاح مباشرة.", color: "bg-coral", h: "h-10" },
  { title: "نتواصل معكم للتأكيد", text: "نراجع طلبكم ونتصل بكم لتأكيد الموعد والإجابة عن أسئلتكم قبل الجلسة.", color: "bg-sun", h: "h-14" },
  { title: "يوم الجلسة", text: "نستقبلكم في مساحة مهيّأة للصغار، ونمنح الطفل وقته ليرتاح قبل أن نبدأ.", color: "bg-lavender", h: "h-[4.5rem]" },
  { title: "صوركم بين أيديكم", text: "نختار أجمل اللقطات ونعدّلها بعناية ثم نسلّمها لكم، ويمكنكم طلب ألبوم مطبوع.", color: "bg-teal", h: "h-[5.5rem]" },
];

export function Process() {
  return (
    <section className="py-16 md:py-28" aria-labelledby="process-title">
      <div className="container-x">
        <SectionHeading eyebrow="كيف تتم الجلسة" title={<span id="process-title">أربع خطوات، ونحن نتولى الباقي</span>} />
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title} className="relative flex flex-col rounded-[1.75rem] bg-paper p-6 shadow-soft">
              <div className="mb-8 flex h-[5.5rem] items-end gap-1.5" aria-hidden>
                {STEPS.slice(0, i + 1).map((b) => (
                  <span key={b.title} className={cn("w-5 rounded-md", b.color, b.h)} />
                ))}
              </div>
              <span className="font-display text-sm font-semibold text-coral-ink">الخطوة {i + 1}</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-plum">{s.title}</h3>
              <p className="mt-3 leading-7 text-ink-soft">{s.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
