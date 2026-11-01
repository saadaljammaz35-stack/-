"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { uploadImage } from "@/lib/image-client";
import { cn } from "@/lib/cn";
import { toast } from "./Toaster";

export function ImageUpload({
  value,
  onChange,
  folder,
  label = "رفع صورة",
  className,
  aspect = "aspect-[4/3]",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "services" | "home" | "gallery";
  label?: string;
  className?: string;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadImage(file, folder);
      onChange(res.url);
      toast.success("تم رفع الصورة. لا تنسَ الحفظ.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border-2 border-dashed border-line bg-cream", aspect, className)}>
      {value ? (
        <>
          <Image src={value} alt="" fill sizes="320px" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute left-2 top-2 grid size-8 place-items-center rounded-xl bg-paper/90 text-coral-ink shadow"
            aria-label="إزالة الصورة"
          >
            <X className="size-4" />
          </button>
          <button type="button" onClick={() => input.current?.click()} className="absolute bottom-2 right-2 rounded-xl bg-paper/90 px-3 py-1.5 text-xs font-semibold text-plum shadow">
            تغيير
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-soft transition-colors hover:text-plum"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          {busy ? <LoaderCircle className="size-7 animate-spin" /> : <ImagePlus className="size-7" />}
          <span className="text-sm font-semibold">{busy ? "جارٍ الرفع…" : label}</span>
        </button>
      )}
      {busy && value && (
        <div className="absolute inset-0 grid place-items-center bg-paper/70">
          <LoaderCircle className="size-7 animate-spin text-plum" />
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
