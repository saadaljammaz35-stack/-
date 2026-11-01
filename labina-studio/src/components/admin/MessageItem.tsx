"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Mail, MessageCircle, Phone, Trash } from "lucide-react";
import { deleteMessage, setMessageRead } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "./ConfirmButton";
import { toast } from "./Toaster";
import { formatDateTime, phoneHref, whatsappHref } from "@/lib/format";
import { cn } from "@/lib/cn";

type Message = { id: string; full_name: string; phone: string | null; email: string | null; subject: string | null; message: string; is_read: boolean; created_at: string };

export function MessageItem({ message: m, timeZone }: { message: Message; timeZone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <li className={cn("rounded-3xl p-5 shadow-soft md:p-6", m.is_read ? "bg-paper" : "bg-paper ring-2 ring-sun")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-plum">
            {!m.is_read && <span className="me-2 inline-block size-2 rounded-full bg-coral align-middle" />}
            {m.full_name}
            {m.subject && <span className="font-normal text-ink-soft"> · {m.subject}</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">{formatDateTime(m.created_at, timeZone)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {m.phone && (
            <>
              <a href={`tel:${phoneHref(m.phone)}`} className="grid size-9 place-items-center rounded-xl bg-cream text-plum" aria-label="اتصال"><Phone className="size-4" /></a>
              <a href={whatsappHref(m.phone)} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-xl bg-cream text-teal-ink" aria-label="واتساب"><MessageCircle className="size-4" /></a>
            </>
          )}
          {m.email && <a href={`mailto:${m.email}?subject=${encodeURIComponent("رد من لَبِنة")}`} className="grid size-9 place-items-center rounded-xl bg-cream text-coral-ink" aria-label="رد بالبريد"><Mail className="size-4" /></a>}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-line leading-8">{m.message}</p>
      <p className="mt-2 text-xs text-ink-soft" dir="ltr" style={{ textAlign: "right" }}>{[m.phone, m.email].filter(Boolean).join(" · ")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setMessageRead(m.id, !m.is_read);
              if (!res.ok) toast.result(res);
              router.refresh();
            })
          }
        >
          {m.is_read ? "تعيين كغير مقروءة" : "تعيين كمقروءة"}
        </Button>
        <ConfirmButton
          icon={<Trash className="size-4" />}
          onConfirm={async () => {
            const res = await deleteMessage(m.id);
            toast.result(res);
            router.refresh();
          }}
        >
          حذف
        </ConfirmButton>
      </div>
    </li>
  );
}
