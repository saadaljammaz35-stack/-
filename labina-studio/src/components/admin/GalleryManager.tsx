"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Eye, EyeOff, ImagePlus, LoaderCircle, Star, Trash } from "lucide-react";
import { addGalleryItems, deleteGalleryItem, updateGalleryItem } from "@/app/admin/actions";
import { uploadImage } from "@/lib/image-client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Card, EmptyState } from "./ui";
import { ConfirmButton } from "./ConfirmButton";
import { toast } from "./Toaster";
import { CATEGORY_LABEL, GALLERY_CATEGORIES, GALLERY_SHAPES, SHAPE_RATIO } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { GalleryCategory, GalleryItem, GalleryShape } from "@/lib/types";

function shapeFor(w: number, h: number): GalleryShape {
  const r = w / h;
  if (r > 1.15) return "landscape";
  if (r > 0.9) return "square";
  if (r > 0.68) return "portrait";
  return "tall";
}

export function GalleryManager({ items }: { items: GalleryItem[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<GalleryCategory>("newborn");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [filter, setFilter] = useState<GalleryCategory | "all">("all");
  const [pending, start] = useTransition();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 30);
    setProgress({ done: 0, total: list.length });
    const uploaded = [];
    for (const file of list) {
      try {
        const res = await uploadImage(file, "gallery");
        uploaded.push({ image_url: res.url, storage_path: res.path, width: res.width, height: res.height, shape: shapeFor(res.width, res.height), category, title: "" });
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (uploaded.length) {
      const res = await addGalleryItems(uploaded);
      toast.result(res);
      router.refresh();
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  };

  const patch = (id: string, data: Parameters<typeof updateGalleryItem>[1]) =>
    start(async () => {
      const res = await updateGalleryItem(id, data);
      if (!res.ok) toast.result(res);
      router.refresh();
    });

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="space-y-6">
      <Card title="رفع صور جديدة" description="JPG أو PNG أو WebP. تُصغَّر الصور تلقائياً قبل الرفع لتبقى الصفحات سريعة.">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr] md:items-end">
          <div>
            <Label htmlFor="g-cat">التصنيف</Label>
            <Select id="g-cat" value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)}>
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            disabled={!!progress}
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files);
            }}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-plum/25 bg-cream text-plum transition-colors hover:border-plum/60 disabled:opacity-70"
          >
            {progress ? <LoaderCircle className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            <span className="font-semibold">{progress ? `جارٍ الرفع ${progress.done} / ${progress.total}` : "اختر الصور أو اسحبها هنا"}</span>
          </button>
        </div>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => upload(e.target.files)} />
        <p className="mt-3 text-xs text-ink-soft">احرص على أن تكون لديك موافقة الأهل على نشر صور أطفالهم.</p>
      </Card>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-2">
          {[{ value: "all" as const, label: "الكل" }, ...GALLERY_CATEGORIES].map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilter(c.value)}
              className={cn("rounded-2xl px-4 py-2 text-sm font-semibold", filter === c.value ? "bg-plum text-cream" : "bg-paper text-ink-soft")}
            >
              {c.label} <span className="opacity-60">{c.value === "all" ? items.length : items.filter((i) => i.category === c.value).length}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="لا توجد صور" text="ارفع أول صور من أعمالك لتظهر في معرض الموقع." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id} className={cn("overflow-hidden rounded-3xl bg-paper shadow-soft", !item.is_published && "opacity-70")}>
              <div className="relative bg-cream" style={{ aspectRatio: SHAPE_RATIO[item.shape] }}>
                <Image src={item.image_url} alt={item.alt || item.title || ""} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-cover" />
                <div className="absolute left-2 top-2 flex gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patch(item.id, { is_featured: !item.is_featured })}
                    className={cn("grid size-9 place-items-center rounded-xl shadow", item.is_featured ? "bg-sun text-ink" : "bg-paper/90 text-ink-soft")}
                    aria-label={item.is_featured ? "إلغاء التمييز" : "تمييز في الرئيسية"}
                    aria-pressed={item.is_featured}
                  >
                    <Star className={cn("size-4", item.is_featured && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patch(item.id, { is_published: !item.is_published })}
                    className="grid size-9 place-items-center rounded-xl bg-paper/90 text-ink-soft shadow"
                    aria-label={item.is_published ? "إخفاء من الموقع" : "إظهار في الموقع"}
                  >
                    {item.is_published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                </div>
                <span className="absolute bottom-2 right-2 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-semibold text-plum">{CATEGORY_LABEL[item.category]}</span>
              </div>
              <GalleryItemForm item={item} onSave={(d) => patch(item.id, d)} disabled={pending} onDelete={async () => {
                const res = await deleteGalleryItem(item.id);
                toast.result(res);
                router.refresh();
              }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GalleryItemForm({ item, onSave, onDelete, disabled }: { item: GalleryItem; onSave: (d: Parameters<typeof updateGalleryItem>[1]) => void; onDelete: () => Promise<void>; disabled: boolean }) {
  const [title, setTitle] = useState(item.title ?? "");
  const [alt, setAlt] = useState(item.alt ?? "");
  const [cat, setCat] = useState(item.category);
  const [shape, setShape] = useState(item.shape);
  const [sort, setSort] = useState(String(item.sort_order));
  const dirty = title !== (item.title ?? "") || alt !== (item.alt ?? "") || cat !== item.category || shape !== item.shape || sort !== String(item.sort_order);

  return (
    <div className="space-y-3 p-4">
      <Input aria-label="عنوان الصورة" placeholder="عنوان (اختياري)" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="h-10" />
      <Input aria-label="وصف للقارئات الصوتية" placeholder="وصف الصورة (لسهولة الوصول)" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} className="h-10" />
      <div className="grid grid-cols-3 gap-2">
        <Select aria-label="التصنيف" value={cat} onChange={(e) => setCat(e.target.value as GalleryCategory)} className="h-10 py-0 text-sm">
          {GALLERY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Select aria-label="شكل الإطار" value={shape} onChange={(e) => setShape(e.target.value as GalleryShape)} className="h-10 py-0 text-sm">
          {GALLERY_SHAPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Input aria-label="الترتيب" type="number" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="dark" disabled={!dirty || disabled} onClick={() => onSave({ title, alt, category: cat, shape, sort_order: Number(sort) || 0 })}>
          حفظ
        </Button>
        <ConfirmButton icon={<Trash className="size-4" />} onConfirm={onDelete}>حذف</ConfirmButton>
      </div>
    </div>
  );
}
