"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveContactSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Hint, Input, Label } from "@/components/ui/Field";
import { Card } from "./ui";
import { toast } from "./Toaster";
import type { ContactSettings } from "@/lib/settings";

const SOCIAL: { key: keyof ContactSettings; label: string; placeholder: string }[] = [
  { key: "instagram", label: "إنستغرام", placeholder: "https://instagram.com/…" },
  { key: "tiktok", label: "تيك توك", placeholder: "https://tiktok.com/@…" },
  { key: "snapchat", label: "سناب شات", placeholder: "https://snapchat.com/add/…" },
  { key: "x", label: "إكس", placeholder: "https://x.com/…" },
  { key: "youtube", label: "يوتيوب", placeholder: "https://youtube.com/@…" },
  { key: "facebook", label: "فيسبوك", placeholder: "https://facebook.com/…" },
];

export function ContactSettingsForm({ initial, emailReady, alertsTo }: { initial: ContactSettings; emailReady: boolean; alertsTo: string }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const field = (k: keyof ContactSettings, label: string, opts: { ltr?: boolean; placeholder?: string; hint?: string } = {}) => (
    <div>
      <Label htmlFor={`cs-${k}`}>{label}</Label>
      <Input id={`cs-${k}`} dir={opts.ltr ? "ltr" : undefined} className={opts.ltr ? "text-right" : undefined} placeholder={opts.placeholder} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!errors[k]} />
      {errors[k] ? <FieldError message={errors[k]} /> : opts.hint && <Hint>{opts.hint}</Hint>}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveContactSettings(form);
          toast.result(res);
          setErrors(!res.ok ? res.fieldErrors ?? {} : {});
          if (res.ok) router.refresh();
        });
      }}
      className="grid gap-6 lg:grid-cols-2"
    >
      <Card title="التواصل المباشر">
        <div className="grid gap-4">
          {field("phone", "رقم الهاتف", { ltr: true, placeholder: "+9665xxxxxxxx" })}
          {field("whatsapp", "رقم الواتساب", { ltr: true, placeholder: "9665xxxxxxxx", hint: "مع رمز الدولة بدون أصفار في البداية." })}
          {field("email", "البريد الإلكتروني", { ltr: true, hint: "تصل إليه تنبيهات الحجوزات والرسائل الجديدة." })}
          {field("city", "المدينة")}
          {field("address", "العنوان")}
          {field("map_url", "رابط الموقع على الخريطة", { ltr: true, placeholder: "https://maps.google.com/…" })}
        </div>
      </Card>
      <div className="space-y-6">
        <Card title="حسابات التواصل الاجتماعي">
          <div className="grid gap-4">{SOCIAL.map((s) => <div key={s.key}>{field(s.key, s.label, { ltr: true, placeholder: s.placeholder })}</div>)}</div>
        </Card>
        <Card title="الإشعارات">
          <p className="text-sm leading-7 text-ink-soft">
            {emailReady
              ? `خدمة البريد مفعّلة. تصل تنبيهات الحجوزات إلى ${alertsTo || form.email || "البريد أعلاه بعد تعبئته"}.`
              : "خدمة البريد غير مفعّلة. لتفعيلها أضف مفتاح Resend في متغيرات البيئة (التفاصيل في README). يعمل نظام الحجز كاملاً بدونها."}
          </p>
        </Card>
        <Button type="submit" size="lg" className="w-full" loading={pending}>حفظ بيانات التواصل</Button>
      </div>
    </form>
  );
}
