"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleAlert,
  Clock,
  Copy,
  Minus,
  Plus,
  UserRound,
} from "lucide-react";
import { createBooking, type BookingSuccess } from "@/app/actions/public";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldError, Hint, Input, Label, Textarea } from "@/components/ui/Field";
import { EASE } from "@/components/ui/Motion";
import { Calendar } from "./Calendar";
import { cn } from "@/lib/cn";
import { COLOR_CLASSES } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { addDays, formatDate, formatDuration, formatPrice, formatTime, todayInTimeZone, weekdayOf, whatsappHref } from "@/lib/format";
import type { BookingSettings, ContactSettings } from "@/lib/settings";
import type { Service, WorkingHour } from "@/lib/types";

type Props = {
  services: Service[];
  settings: BookingSettings;
  hours: WorkingHour[];
  blockedDates: string[];
  connected: boolean;
  contact: ContactSettings;
  initialServiceSlug?: string;
};

type Slots = { status: "idle" | "loading" | "ready" | "error"; slots: string[]; reason: string | null };

const STEPS = [
  { key: 1, label: "الجلسة", icon: CalendarDays },
  { key: 2, label: "الموعد", icon: Clock },
  { key: 3, label: "بياناتك", icon: UserRound },
] as const;

function buildIcs(b: BookingSuccess, timezone: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dt = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Labina Studio//Booking//AR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.reference}@labina-studio`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${timezone}:${dt(b.date, b.start)}`,
    `DTEND;TZID=${timezone}:${dt(b.date, b.end)}`,
    `SUMMARY:${b.serviceName} — لَبِنة`,
    `DESCRIPTION:رقم الحجز ${b.reference}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function BookingForm({ services, settings, hours, blockedDates, connected, contact, initialServiceSlug }: Props) {
  const bookable = useMemo(() => services.filter((s) => s.is_bookable), [services]);
  const initial = bookable.find((s) => s.slug === initialServiceSlug) ?? null;

  const [step, setStep] = useState<1 | 2 | 3>(initial ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(initial?.id ?? null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slots>({ status: "idle", slots: [], reason: null });
  const [form, setForm] = useState({ name: "", phone: "", email: "", children: 1, notes: "", consent: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingSuccess | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const service = bookable.find((s) => s.id === serviceId) ?? null;
  const today = todayInTimeZone(settings.timezone);
  const maxDate = addDays(today, settings.booking_window_days);
  const hoursByDay = useMemo(() => new Map(hours.map((h) => [h.weekday, h])), [hours]);
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);

  const isDayDisabled = useCallback(
    (d: string) => blocked.has(d) || !hoursByDay.get(weekdayOf(d))?.is_open,
    [blocked, hoursByDay],
  );

  const loadSlots = useCallback(async (svc: string, day: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSlots({ status: "loading", slots: [], reason: null });
    try {
      const res = await fetch(`/api/availability?serviceId=${svc}&date=${day}`, { signal: ctrl.signal, cache: "no-store" });
      const json = (await res.json()) as { slots?: string[]; reason?: string | null };
      setSlots({ status: res.ok ? "ready" : "error", slots: json.slots ?? [], reason: json.reason ?? null });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSlots({ status: "error", slots: [], reason: "ERROR" });
    }
  }, []);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goTo = (s: 1 | 2 | 3) => {
    setStep(s);
    setFormError(null);
    requestAnimationFrame(scrollTop);
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !date || !time) return;
    setFormError(null);
    startTransition(async () => {
      const res = await createBooking({
        serviceId: service.id,
        date,
        time,
        name: form.name,
        phone: form.phone,
        email: form.email,
        children: form.children,
        notes: form.notes,
        consent: form.consent as true,
        website: form.website,
      });
      if (res.ok && res.data) {
        setResult(res.data);
        requestAnimationFrame(scrollTop);
        return;
      }
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        if (res.code && ["SLOT_TAKEN", "TOO_SOON", "OUTSIDE_HOURS", "DAY_CLOSED", "INVALID_SLOT", "DATE_OUT_OF_RANGE"].includes(res.code)) {
          setTime(null);
          setStep(2);
          loadSlots(service.id, date);
        }
      }
    });
  };

  const downloadIcs = () => {
    if (!result) return;
    const blob = new Blob([buildIcs(result, settings.timezone)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `labina-${result.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const manageLink = result ? `${typeof window !== "undefined" ? window.location.origin : ""}/booking/manage/${result.manageToken}` : "";

  if (!connected) {
    return (
      <div className="rounded-[2rem] bg-paper p-6 shadow-soft md:p-10">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun"><CircleAlert className="size-6 text-ink" aria-hidden /></span>
          <div>
            <h3 className="font-display text-xl font-semibold text-plum">الحجز الإلكتروني قيد الإعداد</h3>
            <p className="mt-2 leading-8 text-ink-soft">
              لم يتم ربط نظام الحجز بقاعدة البيانات بعد، لذلك لا يمكن استقبال الحجوزات من هنا الآن. يسعدنا ترتيب موعدك عبر صفحة التواصل.
            </p>
            <ButtonLink href="/contact" variant="dark" className="mt-5">تواصل معنا</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  if (bookable.length === 0) {
    return (
      <div className="rounded-[2rem] bg-paper p-6 text-center shadow-soft md:p-10">
        <p className="leading-8 text-ink-soft">لا توجد جلسات متاحة للحجز الإلكتروني حالياً. تواصل معنا لترتيب موعدك.</p>
        <ButtonLink href="/contact" variant="dark" className="mt-5">تواصل معنا</ButtonLink>
      </div>
    );
  }

  /* ───────────── success ───────────── */
  if (result) {
    return (
      <div ref={topRef} className="scroll-mt-28 overflow-hidden rounded-[2rem] bg-paper shadow-soft">
        <div className="relative bg-plum px-6 pb-10 pt-12 text-center text-cream md:px-10">
          <div className="mx-auto mb-6 flex h-20 items-end justify-center gap-2" aria-hidden>
            {["bg-coral h-10", "bg-sun h-16", "bg-lavender h-20", "bg-teal h-14", "bg-coral h-8"].map((c, i) => (
              <motion.span
                key={i}
                className={cn("w-7 rounded-lg", c)}
                initial={{ scaleY: 0, originY: 1 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.08 }}
              />
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: EASE }}>
            <h3 className="font-display text-3xl font-bold md:text-4xl">استلمنا طلب حجزك</h3>
            <p className="mx-auto mt-3 max-w-md leading-8 text-cream/80">
              حجزك الآن بانتظار التأكيد، وسنتواصل معك قريباً على رقم جوالك.
              {result.emailSent && " أرسلنا التفاصيل إلى بريدك أيضاً."}
            </p>
          </motion.div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10">
          <dl className="space-y-4 rounded-3xl bg-cream p-6">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">رقم الحجز</dt>
              <dd className="font-display text-xl font-bold tracking-wider text-plum" dir="ltr">{result.reference}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">الجلسة</dt>
              <dd className="font-semibold">{result.serviceName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">التاريخ</dt>
              <dd className="font-semibold">{formatDate(result.date)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">الوقت</dt>
              <dd className="font-semibold">{formatTime(result.start)} – {formatTime(result.end)}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-7 text-ink-soft">
              احفظ رابط إدارة الحجز. من خلاله تتابع حالة حجزك ويمكنك إلغاؤه عند الحاجة.
            </p>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-line bg-cream p-2 ps-4">
              <span className="truncate text-sm text-ink-soft" dir="ltr">{manageLink}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(manageLink).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="ms-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-plum px-3 text-sm font-semibold text-cream"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "نُسخ" : "نسخ"}
              </button>
            </div>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/booking/manage/${result.manageToken}`} variant="dark">إدارة الحجز</ButtonLink>
              <Button type="button" variant="outline" onClick={downloadIcs} icon={<CalendarPlus className="size-4" />}>
                أضف إلى التقويم
              </Button>
            </div>
            {contact.whatsapp && (
              <a
                href={whatsappHref(contact.whatsapp, `مرحباً، هذا رقم حجزي ${result.reference}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm font-semibold text-teal-ink underline underline-offset-4"
              >
                راسلنا على واتساب برقم الحجز
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ───────────── steps ───────────── */
  return (
    <div ref={topRef} className="scroll-mt-28 overflow-hidden rounded-[2rem] bg-paper shadow-soft">
      {/* Stepper */}
      <ol className="grid grid-cols-3 border-b border-line" aria-label="خطوات الحجز">
        {STEPS.map((s) => {
          const done = step > s.key;
          const active = step === s.key;
          return (
            <li key={s.key} className="relative">
              <button
                type="button"
                disabled={s.key > step || pending}
                onClick={() => goTo(s.key)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 px-2 py-4 text-sm font-semibold transition-colors sm:flex-row sm:justify-center sm:gap-3 sm:py-5",
                  active ? "text-plum" : done ? "text-teal-ink" : "text-ink-soft/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-[0.6rem] transition-colors",
                    active ? "bg-coral text-ink" : done ? "bg-teal text-ink" : "bg-cream text-ink-soft",
                  )}
                >
                  {done ? <Check className="size-4" /> : <s.icon className="size-4" />}
                </span>
                {s.label}
              </button>
              {active && <motion.span layoutId="booking-step" className="absolute inset-x-6 -bottom-px h-1 rounded-full bg-coral" />}
            </li>
          );
        })}
      </ol>

      <div className="p-5 sm:p-8 md:p-10">
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.35, ease: EASE }}>
              <h3 className="mb-1 font-display text-2xl font-semibold text-plum">اختر نوع الجلسة</h3>
              <p className="mb-6 text-ink-soft">يمكنك قراءة تفاصيل كل جلسة من صفحة الخدمات.</p>
              <div role="radiogroup" aria-label="نوع الجلسة" className="grid gap-3 sm:grid-cols-2">
                {bookable.map((s) => {
                  const selected = s.id === serviceId;
                  const price = formatPrice(s.price, settings.currency);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setServiceId(s.id);
                        setTime(null);
                        if (date) loadSlots(s.id, date);
                        goTo(2);
                      }}
                      className={cn(
                        "group flex items-center gap-4 rounded-3xl border-2 p-3 text-start transition-all duration-300",
                        selected ? "border-plum bg-cream" : "border-line bg-paper hover:-translate-y-0.5 hover:border-plum/30",
                      )}
                    >
                      <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", COLOR_CLASSES[s.color].bg, COLOR_CLASSES[s.color].onBg)}>
                        <ServiceIcon name={s.icon} className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{s.name}</span>
                        <span className="mt-0.5 block text-sm text-ink-soft">
                          {formatDuration(s.duration_minutes)}
                          {price && <> · {s.price_note ? `${s.price_note} ` : ""}{price}</>}
                        </span>
                      </span>
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-colors", selected ? "bg-plum text-cream" : "bg-cream text-transparent group-hover:text-ink-soft")}>
                        <Check className="size-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && service && (
            <motion.div key="s2" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.35, ease: EASE }}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-plum">اختر اليوم والوقت</h3>
                  <p className="mt-1 text-ink-soft">
                    {service.name} · {formatDuration(service.duration_minutes)}
                  </p>
                </div>
                <button type="button" onClick={() => goTo(1)} className="text-sm font-semibold text-coral-ink underline underline-offset-4">
                  تغيير الجلسة
                </button>
              </div>

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <Calendar
                  value={date}
                  minDate={today}
                  maxDate={maxDate}
                  isDisabled={isDayDisabled}
                  onChange={(d) => {
                    setDate(d);
                    setTime(null);
                    loadSlots(service.id, d);
                  }}
                />
                <div>
                  <p className="mb-3 font-semibold text-ink">{date ? formatDate(date) : "الأوقات المتاحة"}</p>
                  {!date && (
                    <div className="grid h-[calc(100%-2rem)] min-h-40 place-items-center rounded-3xl border-2 border-dashed border-line p-6 text-center text-ink-soft">
                      اختر يوماً من التقويم لعرض الأوقات المتاحة.
                    </div>
                  )}
                  {date && slots.status === "loading" && (
                    <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="جارٍ تحميل الأوقات">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="skeleton h-12 rounded-xl" />
                      ))}
                    </div>
                  )}
                  {date && slots.status !== "loading" && slots.slots.length === 0 && (
                    <div className="rounded-3xl bg-cream p-6 text-center">
                      <p className="text-ink-soft">{slots.status === "error" ? "تعذر تحميل الأوقات. حاول مرة أخرى." : errorMessage(slots.reason ?? "FULLY_BOOKED")}</p>
                      <p className="mt-2 text-sm text-ink-soft">جرّب يوماً آخر من التقويم.</p>
                    </div>
                  )}
                  {date && slots.status === "ready" && slots.slots.length > 0 && (
                    <div role="radiogroup" aria-label="الوقت" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                      {slots.slots.map((t, i) => (
                        <motion.button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={time === t}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3) }}
                          onClick={() => setTime(t)}
                          className={cn(
                            "h-12 rounded-xl border-2 text-sm font-semibold transition-colors",
                            time === t ? "border-plum bg-plum text-cream" : "border-line bg-paper text-ink hover:border-plum/40",
                          )}
                        >
                          {formatTime(t)}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <p role="alert" className="mt-6 rounded-2xl bg-coral-soft px-4 py-3 font-medium text-coral-ink">{formError}</p>
              )}

              <div className="mt-8 flex justify-between gap-3">
                <Button type="button" variant="ghost" onClick={() => goTo(1)} icon={<ArrowRight className="size-4" />}>
                  رجوع
                </Button>
                <Button type="button" disabled={!date || !time} onClick={() => goTo(3)}>
                  التالي
                  <ArrowLeft className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && service && date && time && (
            <motion.form
              key="s3"
              noValidate
              onSubmit={submit}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <h3 className="mb-1 font-display text-2xl font-semibold text-plum">بياناتك</h3>
              <p className="mb-6 text-ink-soft">نستخدمها فقط للتواصل معك بخصوص هذا الحجز.</p>

              <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-3xl bg-cream px-5 py-4 text-sm">
                <span className="font-semibold text-plum">{service.name}</span>
                <span className="text-ink-soft">{formatDate(date)}</span>
                <span className="text-ink-soft">{formatTime(time)}</span>
                <button type="button" onClick={() => goTo(2)} className="ms-auto font-semibold text-coral-ink underline underline-offset-4">
                  تعديل
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="b-name">الاسم</Label>
                  <Input id="b-name" autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby="b-name-err" required />
                  <FieldError id="b-name-err" message={errors.name} />
                </div>
                <div>
                  <Label htmlFor="b-phone">رقم الجوال</Label>
                  <Input id="b-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className="text-right" placeholder="05xxxxxxxx" value={form.phone} onChange={(e) => update("phone", e.target.value)} aria-invalid={!!errors.phone} aria-describedby="b-phone-err" required />
                  <FieldError id="b-phone-err" message={errors.phone} />
                </div>
                <div>
                  <Label htmlFor="b-email" optional>البريد الإلكتروني</Label>
                  <Input id="b-email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-right" value={form.email} onChange={(e) => update("email", e.target.value)} aria-invalid={!!errors.email} aria-describedby="b-email-err" />
                  <FieldError id="b-email-err" message={errors.email} />
                  {!errors.email && <Hint>لاستلام تأكيد الحجز بالبريد.</Hint>}
                </div>
                <div>
                  <Label htmlFor="b-children">عدد الأطفال</Label>
                  <div className="flex h-12 items-center justify-between rounded-2xl border-2 border-line bg-paper px-2">
                    <button type="button" className="grid size-9 place-items-center rounded-xl bg-cream text-plum disabled:opacity-30" onClick={() => update("children", Math.max(1, form.children - 1))} disabled={form.children <= 1} aria-label="إنقاص">
                      <Minus className="size-4" />
                    </button>
                    <output id="b-children" aria-live="polite" className="font-display text-lg font-semibold">{form.children}</output>
                    <button type="button" className="grid size-9 place-items-center rounded-xl bg-cream text-plum disabled:opacity-30" onClick={() => update("children", Math.min(settings.max_children, form.children + 1))} disabled={form.children >= settings.max_children} aria-label="زيادة">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <FieldError message={errors.children} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="b-notes" optional>ملاحظات إضافية</Label>
                  <Textarea id="b-notes" rows={3} maxLength={1000} placeholder="عمر الطفل، فكرة تحبون تنفيذها، أي شيء يهمنا معرفته…" value={form.notes} onChange={(e) => update("notes", e.target.value)} aria-invalid={!!errors.notes} />
                  <FieldError message={errors.notes} />
                </div>
                {/* Honeypot: hidden from people, tempting for bots */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="b-website">Website</label>
                  <input id="b-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(e) => update("consent", e.target.checked)}
                      className="mt-1 size-5 shrink-0 accent-plum"
                      aria-invalid={!!errors.consent}
                    />
                    <span className="text-sm leading-7 text-ink">أوافق على استخدام بياناتي للتواصل معي بخصوص هذا الحجز فقط.</span>
                  </label>
                  <FieldError message={errors.consent} />
                </div>
              </div>

              {formError && (
                <p role="alert" className="mt-6 rounded-2xl bg-coral-soft px-4 py-3 font-medium text-coral-ink">{formError}</p>
              )}

              <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                <Button type="button" variant="ghost" onClick={() => goTo(2)} icon={<ArrowRight className="size-4" />}>
                  رجوع
                </Button>
                <Button type="submit" size="lg" loading={pending}>
                  {pending ? "جارٍ إرسال الحجز…" : "تأكيد الحجز"}
                </Button>
              </div>
              <p className="mt-4 text-center text-xs text-ink-soft sm:text-start">
                بإرسال الطلب يُحجز الموعد لك مبدئياً حتى يؤكده فريقنا. <Link href="/faq" className="underline">الأسئلة الشائعة</Link>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
