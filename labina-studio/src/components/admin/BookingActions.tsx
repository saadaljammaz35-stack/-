"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBookingStatus, rescheduleBooking, updateBookingNotes } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Card } from "./ui";
import { toast } from "./Toaster";
import { STATUS_META } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "pending"],
  completed: ["confirmed"],
  cancelled: ["pending", "confirmed"],
};

const ACTION_LABEL: Record<BookingStatus, string> = {
  confirmed: "تأكيد الحجز",
  completed: "تحديد كمكتمل",
  cancelled: "إلغاء الحجز",
  pending: "إعادة إلى «جديد»",
};

export function BookingActions({ id, status, date, time, adminNotes }: { id: string; status: BookingStatus; date: string; time: string; adminNotes: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [notes, setNotes] = useState(adminNotes);
  const active = status === "pending" || status === "confirmed";

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      toast.result(res);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <Card title="تغيير الحالة" description={`الحالة الحالية: ${STATUS_META[status].label}. يُرسل بريد للعميل عند التأكيد أو الإلغاء إذا كان بريده مسجلاً والإشعارات مفعّلة.`}>
        <div>
          <Label htmlFor="status-note" optional>ملاحظة (تُحفظ في السجل، وتكون سبب الإلغاء عند الإلغاء)</Label>
          <Input id="status-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TRANSITIONS[status].map((s) => (
            <Button
              key={s}
              variant={s === "cancelled" ? "danger" : s === "confirmed" ? "dark" : "outline"}
              disabled={pending}
              onClick={() => run(() => setBookingStatus(id, s, note), () => setNote(""))}
            >
              {ACTION_LABEL[s]}
            </Button>
          ))}
        </div>
      </Card>

      {active && (
        <Card title="تعديل الموعد" description="يتحقق النظام تلقائياً من عدم التعارض مع حجز آخر.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-date">التاريخ</Label>
              <Input id="new-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-time">الوقت</Label>
              <Input id="new-time" type="time" step={300} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" variant="dark" disabled={pending || (newDate === date && newTime === time)} onClick={() => run(() => rescheduleBooking(id, newDate, newTime))}>
            حفظ الموعد الجديد
          </Button>
        </Card>
      )}

      <Card title="ملاحظات داخلية" description="لا تظهر للعميل.">
        <Textarea value={notes} rows={3} maxLength={2000} onChange={(e) => setNotes(e.target.value)} aria-label="ملاحظات داخلية" />
        <Button className="mt-3" variant="outline" disabled={pending || notes === adminNotes} onClick={() => run(() => updateBookingNotes(id, notes))}>
          حفظ الملاحظات
        </Button>
      </Card>
    </>
  );
}
