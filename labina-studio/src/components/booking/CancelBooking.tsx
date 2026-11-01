"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBookingByToken } from "@/app/actions/public";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";

export function CancelBooking({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        إلغاء الحجز
      </Button>
    );
  }

  return (
    <div className="rounded-3xl bg-coral-soft/50 p-5">
      <p className="font-semibold text-ink">هل تريد إلغاء هذا الحجز؟</p>
      <p className="mt-1 text-sm text-ink-soft">بعد الإلغاء يصبح الموعد متاحاً لعائلات أخرى.</p>
      <div className="mt-4">
        <Label htmlFor="cancel-reason" optional>سبب الإلغاء</Label>
        <Textarea id="cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-coral-ink">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="dark"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelBookingByToken(token, reason);
              if (res.ok) router.refresh();
              else setError(res.error);
            })
          }
        >
          نعم، ألغِ الحجز
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          تراجع
        </Button>
      </div>
    </div>
  );
}
