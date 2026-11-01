"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Pencil, Trash } from "lucide-react";
import { deleteService, setServiceFlag } from "@/app/admin/actions";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { buttonClass } from "@/components/ui/Button";
import { ConfirmButton } from "./ConfirmButton";
import { Switch } from "./Switch";
import { toast } from "./Toaster";
import { COLOR_CLASSES } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

export function ServiceRow({ service: s }: { service: Service }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const flag = (f: "is_active" | "is_bookable", v: boolean) =>
    start(async () => {
      const res = await setServiceFlag(s.id, f, v);
      toast.result(res);
      router.refresh();
    });

  return (
    <li className={cn("flex flex-col gap-4 rounded-3xl bg-paper p-4 shadow-soft md:flex-row md:items-center", !s.is_active && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", COLOR_CLASSES[s.color].bg, COLOR_CLASSES[s.color].onBg)}>
          <ServiceIcon name={s.icon} className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-plum">{s.name}</p>
          <p className="text-sm text-ink-soft">
            {formatDuration(s.duration_minutes)} · {formatPrice(s.price) ?? "بدون سعر"} · <span dir="ltr">/{s.slug}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={s.is_active} onChange={(v) => flag("is_active", v)} disabled={pending} label="ظاهرة في الموقع" />
          ظاهرة
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={s.is_bookable} onChange={(v) => flag("is_bookable", v)} disabled={pending} label="متاحة للحجز" />
          متاحة للحجز
        </label>
        <div className="flex gap-1.5">
          <Link href={`/services/${s.slug}`} target="_blank" className={buttonClass("ghost", "sm")} aria-label="عرض في الموقع"><ExternalLink className="size-4" /></Link>
          <Link href={`/admin/services/${s.id}`} className={buttonClass("outline", "sm")}><Pencil className="size-4" /> تعديل</Link>
          <ConfirmButton
            icon={<Trash className="size-4" />}
            onConfirm={async () => {
              const res = await deleteService(s.id);
              toast.result(res);
              router.refresh();
            }}
          >
            حذف
          </ConfirmButton>
        </div>
      </div>
    </li>
  );
}
