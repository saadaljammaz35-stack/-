"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash } from "lucide-react";
import { addBlockedDate, removeBlockedDate, saveBookingSettings, saveWorkingHours } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Hint, Input, Label, inputClass } from "@/components/ui/Field";
import { Card } from "./ui";
import { Switch } from "./Switch";
import { toast } from "./Toaster";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { BookingSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { WorkingHour } from "@/lib/types";

export function HoursForm({ hours }: { hours: WorkingHour[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(() => hours.map((h) => ({ ...h, open_time: h.open_time.slice(0, 5), close_time: h.close_time.slice(0, 5) })));
  const set = (weekday: number, patch: Partial<WorkingHour>) => setRows((r) => r.map((x) => (x.weekday === weekday ? { ...x, ...patch } : x)));

  return (
    <Card title="ساعات العمل الأسبوعية">
      <ul className="divide-y divide-line">
        {WEEK_ORDER.map((d) => {
          const r = rows.find((x) => x.weekday === d)!;
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 py-3">
              <label className="flex w-36 items-center gap-3">
                <Switch checked={r.is_open} onChange={(v) => set(d, { is_open: v })} label={`${WEEKDAYS[d]} مفتوح`} />
                <span className="font-semibold">{WEEKDAYS[d]}</span>
              </label>
              {r.is_open ? (
                <div className="flex flex-1 items-center gap-2">
                  <input type="time" aria-label={`فتح ${WEEKDAYS[d]}`} className={cn(inputClass, "h-10 py-0")} value={r.open_time} onChange={(e) => set(d, { open_time: e.target.value })} />
                  <span className="text-ink-soft">إلى</span>
                  <input type="time" aria-label={`إغلاق ${WEEKDAYS[d]}`} className={cn(inputClass, "h-10 py-0")} value={r.close_time} onChange={(e) => set(d, { close_time: e.target.value })} />
                </div>
              ) : (
                <span className="text-sm text-ink-soft">مغلق</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-4"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await saveWorkingHours(rows);
            toast.result(res);
            if (res.ok) router.refresh();
          })
        }
      >
        حفظ ساعات العمل
      </Button>
    </Card>
  );
}

export function BookingSettingsForm({ settings, emailReady }: { settings: BookingSettings; emailReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [s, setS] = useState({
    ...settings,
    slot_interval_minutes: String(settings.slot_interval_minutes),
    booking_window_days: String(settings.booking_window_days),
    min_notice_hours: String(settings.min_notice_hours),
    cancel_notice_hours: String(settings.cancel_notice_hours),
    max_children: String(settings.max_children),
  });
  const num = (k: keyof typeof s, label: string, hint: string) => (
    <div>
      <Label htmlFor={`bs-${k}`}>{label}</Label>
      <Input id={`bs-${k}`} type="number" min={0} value={s[k] as string} onChange={(e) => setS({ ...s, [k]: e.target.value })} aria-invalid={!!errors[k]} />
      {errors[k] ? <FieldError message={errors[k]} /> : <Hint>{hint}</Hint>}
    </div>
  );

  return (
    <Card title="إعدادات الحجز">
      <div className="grid gap-4 sm:grid-cols-2">
        {num("slot_interval_minutes", "الفاصل بين بدايات المواعيد (دقيقة)", "مثل 30: تظهر الأوقات 10:00، 10:30…")}
        {num("booking_window_days", "أقصى مدة للحجز المسبق (يوم)", "إلى كم يوماً مقدماً يمكن الحجز.")}
        {num("min_notice_hours", "أقل مهلة قبل الموعد (ساعة)", "يمنع الحجز في اللحظات الأخيرة.")}
        {num("cancel_notice_hours", "مهلة الإلغاء الإلكتروني (ساعة)", "يستطيع العميل الإلغاء قبل الموعد بهذه المدة.")}
        {num("max_children", "أقصى عدد أطفال في الحجز", "")}
        <div>
          <Label htmlFor="bs-currency">العملة</Label>
          <Input id="bs-currency" value={s.currency} maxLength={12} onChange={(e) => setS({ ...s, currency: e.target.value })} />
          <FieldError message={errors.currency} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bs-tz">المنطقة الزمنية</Label>
          <Input id="bs-tz" dir="ltr" className="text-right" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} />
          {errors.timezone ? <FieldError message={errors.timezone} /> : <Hint>مثل Asia/Riyadh أو Asia/Dubai.</Hint>}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-4 sm:col-span-2">
          <span>
            <span className="block font-semibold">إرسال رسائل البريد للعملاء</span>
            <span className="block text-sm text-ink-soft">
              {emailReady ? "خدمة البريد مفعّلة." : "خدمة البريد غير مفعّلة بعد (أضف RESEND_API_KEY و NOTIFY_FROM_EMAIL)."}
            </span>
          </span>
          <Switch checked={s.send_customer_emails} onChange={(v) => setS({ ...s, send_customer_emails: v })} />
        </label>
      </div>
      <Button
        className="mt-4"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await saveBookingSettings({
              ...s,
              slot_interval_minutes: Number(s.slot_interval_minutes),
              booking_window_days: Number(s.booking_window_days),
              min_notice_hours: Number(s.min_notice_hours),
              cancel_notice_hours: Number(s.cancel_notice_hours),
              max_children: Number(s.max_children),
            });
            toast.result(res);
            setErrors(!res.ok ? res.fieldErrors ?? {} : {});
            if (res.ok) router.refresh();
          })
        }
      >
        حفظ الإعدادات
      </Button>
    </Card>
  );
}

export function BlockedDates({ items }: { items: { day: string; reason: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Card title="أيام الإغلاق والإجازات" description="لن تظهر هذه الأيام في تقويم الحجز. الحجوزات الموجودة فيها لا تتأثر.">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <input type="date" aria-label="اليوم" className={cn(inputClass, "h-11 py-0")} value={day} onChange={(e) => setDay(e.target.value)} />
        <input aria-label="السبب" placeholder="السبب (داخلي، اختياري)" className={cn(inputClass, "h-11 py-0")} value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} />
        <Button
          variant="dark"
          disabled={!day || pending}
          onClick={() =>
            start(async () => {
              const res = await addBlockedDate(day, reason);
              toast.result(res);
              if (res.ok) {
                setDay("");
                setReason("");
                router.refresh();
              }
            })
          }
        >
          إضافة
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {items.map((b) => (
            <li key={b.day} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="font-semibold">{formatDate(b.day)}</span>
                {b.reason && <span className="text-sm text-ink-soft"> · {b.reason}</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeBlockedDate(b.day);
                    toast.result(res);
                    router.refresh();
                  })
                }
                className="grid size-9 place-items-center rounded-xl text-coral-ink hover:bg-coral-soft"
                aria-label="إعادة فتح اليوم"
              >
                <Trash className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
