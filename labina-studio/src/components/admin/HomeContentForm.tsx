"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash } from "lucide-react";
import { saveHomeContent } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Hint, Input, Label, Textarea } from "@/components/ui/Field";
import { Card } from "./ui";
import { ImageUpload } from "./ImageUpload";
import { toast } from "./Toaster";
import type { HomeSettings } from "@/lib/settings";

const HERO_SLOTS = ["الإطار البنفسجي (المواليد)", "الإطار الأصفر (أعياد الميلاد)", "الإطار اللافندر (الأطفال)", "الإطار التركوازي (العائلات)"];

export function HomeContentForm({ initial }: { initial: HomeSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [heroImages, setHeroImages] = useState<(string | null)[]>(() => [0, 1, 2, 3].map((i) => initial.hero_images[i] ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof HomeSettings>(k: K, v: HomeSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof HomeSettings, label: string, rows = 0, max = 300, hint?: string) => (
    <div>
      <Label htmlFor={`hc-${k}`}>{label}</Label>
      {rows ? (
        <Textarea id={`hc-${k}`} rows={rows} maxLength={max} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} />
      ) : (
        <Input id={`hc-${k}`} maxLength={max} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k]} />
      )}
      {errors[k] ? <FieldError message={errors[k]} /> : hint && <Hint>{hint}</Hint>}
    </div>
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Hero images keep their slot: empty slots are skipped, so fill slots in order
    const compact = heroImages.filter((x): x is string => Boolean(x));
    start(async () => {
      const res = await saveHomeContent({ ...form, hero_images: compact });
      toast.result(res);
      setErrors(!res.ok ? res.fieldErrors ?? {} : {});
      if (res.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card title="الواجهة (Hero)">
        <div className="grid gap-4 md:grid-cols-2">
          {text("hero_eyebrow", "النص الصغير أعلى العنوان", 0, 60)}
          {text("hero_title", "العنوان الرئيسي", 0, 120, "استخدم «..» لكسر السطر، مثل: لحظات صغيرة.. ذكريات تكبر معنا")}
          <div className="md:col-span-2">{text("hero_subtitle", "الوصف", 2, 300)}</div>
        </div>
        <div className="mt-6">
          <Label>صور إطارات الواجهة</Label>
          <Hint>تملأ الصور الإطارات الطويلة في تصميم الواجهة بالترتيب. بدون صور تظهر الرسومات بألوان الهوية.</Hint>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {heroImages.map((img, i) => (
              <div key={i}>
                <ImageUpload folder="home" aspect="aspect-[3/5]" value={img} onChange={(v) => setHeroImages((arr) => arr.map((x, j) => (j === i ? v : x)))} />
                <p className="mt-1.5 text-xs text-ink-soft">{HERO_SLOTS[i]}</p>
              </div>
            ))}
          </div>
          <FieldError message={errors.hero_images} />
        </div>
      </Card>

      <Card title="من نحن">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            {text("about_title", "العنوان", 0, 120)}
            {text("about_story", "القصة", 6, 2000, "يمكن تقسيمها إلى فقرات بسطر فارغ.")}
            {text("about_mission", "الرسالة", 2, 500)}
            {text("about_vision", "الرؤية", 2, 500)}
          </div>
          <div>
            <Label>صورة القسم</Label>
            <ImageUpload folder="home" aspect="aspect-[4/5]" value={form.about_image || null} onChange={(v) => set("about_image", v ?? "")} />
            <FieldError message={errors.about_image} />
          </div>
        </div>
        <div className="mt-6">
          <Label>القيم</Label>
          <ul className="space-y-3">
            {form.values.map((v, i) => (
              <li key={i} className="grid gap-2 rounded-2xl bg-cream p-3 md:grid-cols-[1fr_2fr_auto]">
                <Input aria-label="عنوان القيمة" value={v.title} maxLength={60} onChange={(e) => set("values", form.values.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input aria-label="وصف القيمة" value={v.text} maxLength={240} onChange={(e) => set("values", form.values.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <button type="button" onClick={() => set("values", form.values.filter((_, j) => j !== i))} className="grid size-12 place-items-center rounded-xl text-coral-ink hover:bg-coral-soft" aria-label="حذف القيمة">
                  <Trash className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {form.values.length < 6 && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => set("values", [...form.values, { title: "", text: "" }])}>
              إضافة قيمة
            </Button>
          )}
          <FieldError message={errors.values} />
        </div>
      </Card>

      <Card title="قسم الحجز ومحركات البحث">
        <div className="grid gap-4 md:grid-cols-2">
          {text("cta_title", "عنوان قسم الحجز", 0, 120)}
          {text("cta_text", "وصف قسم الحجز", 0, 300)}
          <div className="md:col-span-2">{text("seo_description", "وصف الموقع في نتائج البحث", 2, 300)}</div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" loading={pending} className="shadow-lift">حفظ المحتوى</Button>
      </div>
    </form>
  );
}
