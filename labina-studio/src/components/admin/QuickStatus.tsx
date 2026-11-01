"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Ban, Check, CheckCheck } from "lucide-react";
import { setBookingStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { toast } from "./Toaster";
import type { BookingStatus } from "@/lib/types";

/** Inline confirm / complete / cancel buttons for a booking row */
export function QuickStatus({ id, status }: { id: string; status: BookingStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (next: BookingStatus) =>
    start(async () => {
      const res = await setBookingStatus(id, next);
      toast.result(res);
      if (res.ok) router.refresh();
    });

  if (status === "pending") {
    return (
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="dark" disabled={pending} onClick={() => run("confirmed")} icon={<Check className="size-4" />}>تأكيد</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run("cancelled")} icon={<Ban className="size-4" />}>إلغاء</Button>
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("completed")} icon={<CheckCheck className="size-4" />}>مكتمل</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run("cancelled")} icon={<Ban className="size-4" />}>إلغاء</Button>
      </div>
    );
  }
  return null;
}
