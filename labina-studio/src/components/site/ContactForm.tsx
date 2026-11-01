"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Send } from "lucide-react";
import { submitContactMessage } from "@/app/actions/public";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";

const EMPTY = { name: "", phone: "", email: "", subject: "", message: "", website: "" };

export function ContactForm({ connected }: { connected: boolean }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const res = await submitContactMessage(form);
      if (res.ok) {
        setForm(EMPTY);
        setErrors({});
        setStatus({ ok: true, text: res.message ?? "تم الإرسال." });
      } else {
        setErrors(res.fieldErrors ?? {});
        setStatus({ ok: false, text: res.error });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="rounded-[2rem] bg-paper p-6 shadow-soft md:p-10">
      <h2 className="font-display text-2xl font-semibold text-plum">أرسل لنا رسالة</h2>
      <p className="mt-2 text-ink-soft">نرد على الرسائل في أوقات العمل.</p>
      {!connected && (
        <p className="mt-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm text-ink">
          نموذج التواصل غير متصل بقاعدة البيانات بعد، لذا لن تصل الرسائل من هنا حالياً.
        </p>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="c-name">الاسم</Label>
          <Input id="c-name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <Label htmlFor="c-phone">رقم الجوال</Label>
          <Input id="c-phone" type="tel" inputMode="tel" dir="ltr" className="text-right" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <Label htmlFor="c-email">البريد الإلكتروني</Label>
          <Input id="c-email" type="email" inputMode="email" dir="ltr" className="text-right" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
          <FieldError message={errors.email} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="c-subject" optional>الموضوع</Label>
          <Input id="c-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} aria-invalid={!!errors.subject} />
          <FieldError message={errors.subject} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="c-message">رسالتك</Label>
          <Textarea id="c-message" rows={5} maxLength={2000} value={form.message} onChange={(e) => set("message", e.target.value)} aria-invalid={!!errors.message} />
          <FieldError message={errors.message} />
        </div>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
      </div>
      <AnimatePresence>
        {status && (
          <motion.p
            role={status.ok ? "status" : "alert"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-6 flex items-center gap-2 rounded-2xl px-4 py-3 font-medium ${status.ok ? "bg-teal-soft text-teal-ink" : "bg-coral-soft text-coral-ink"}`}
          >
            {status.ok && <CircleCheck className="size-5 shrink-0" aria-hidden />}
            {status.text}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" loading={pending} icon={!pending && <Send className="size-4 -scale-x-100" aria-hidden />}>
        {pending ? "جارٍ الإرسال…" : "إرسال"}
      </Button>
    </form>
  );
}
