"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Star, Trash } from "lucide-react";
import { deleteTestimonial, saveTestimonial, type TestimonialInput } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Card, EmptyState } from "./ui";
import { ConfirmButton } from "./ConfirmButton";
import { Switch } from "./Switch";
import { toast } from "./Toaster";
import { cn } from "@/lib/cn";
import type { Testimonial } from "@/lib/types";

const EMPTY: TestimonialInput = { author_name: "", author_label: "", content: "", rating: 5, service_id: "", is_published: true, sort_order: 0 };

export function TestimonialsManager({ items, services }: { items: Testimonial[]; services: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(items.length ? null : "new");
  const [form, setForm] = useState<TestimonialInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const open = (t?: Testimonial) => {
    setErrors({});
    setEditing(t?.id ?? "new");
    setForm(t ? { author_name: t.author_name, author_label: t.author_label ?? "", content: t.content, rating: t.rating, service_id: t.service_id ?? "", is_published: t.is_published, sort_order: t.sort_order } : EMPTY);
  };

  const save = () =>
    start(async () => {
      const res = await saveTestimonial(editing === "new" ? null : editing, form);
      toast.result(res);
      if (!res.ok) return setErrors(res.fieldErrors ?? {});
      setEditing(null);
      router.refresh();
    });

  const formUi = (
    <Card title={editing === "new" ? "رأي جديد" : "تعديل الرأي"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="t-name">الاسم</Label>
          <Input id="t-name" value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} aria-invalid={!!errors.author_name} />
          <FieldError message={errors.author_name} />
        </div>
        <div>
          <Label htmlFor="t-label" optional>وصف مختصر</Label>
          <Input id="t-label" placeholder="مثل: والدة سارة" value={form.author_label} onChange={(e) => setForm({ ...form, author_label: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="t-content">نص الرأي</Label>
          <Textarea id="t-content" rows={4} maxLength={1000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} aria-invalid={!!errors.content} />
          <FieldError message={errors.content} />
        </div>
        <div>
          <Label>التقييم</Label>
          <div className="flex gap-1" role="radiogroup" aria-label="التقييم">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} من 5`} onClick={() => setForm({ ...form, rating: n })} className="p-1">
                <Star className={cn("size-7", n <= (form.rating ?? 5) ? "fill-sun text-sun" : "text-ink-soft/30")} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="t-service" optional>الجلسة</Label>
          <Select id="t-service" value={form.service_id ?? ""} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
            <option value="">بدون</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="t-sort">الترتيب</Label>
          <Input id="t-sort" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
        </div>
        <label className="flex items-center gap-3 self-end pb-3">
          <Switch checked={!!form.is_published} onChange={(v) => setForm({ ...form, is_published: v })} />
          منشور في الموقع
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={save} loading={pending}>حفظ</Button>
        <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>إلغاء</Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {editing === null && <Button onClick={() => open()} icon={<Plus className="size-4" />}>إضافة رأي</Button>}
      {editing === "new" && formUi}
      {items.length === 0 && editing === null && <EmptyState title="لا توجد آراء بعد" />}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((t) =>
          editing === t.id ? (
            <li key={t.id} className="md:col-span-2">{formUi}</li>
          ) : (
            <li key={t.id} className={cn("rounded-3xl bg-paper p-5 shadow-soft", !t.is_published && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-plum">{t.author_name}</p>
                  {t.author_label && <p className="text-sm text-ink-soft">{t.author_label}</p>}
                </div>
                <span className="flex gap-0.5" aria-label={`${t.rating} من 5`}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("size-4", n <= t.rating ? "fill-sun text-sun" : "text-ink-soft/25")} />)}
                </span>
              </div>
              <p className="mt-3 leading-7 text-ink">«{t.content}»</p>
              {!t.is_published && <p className="mt-2 text-xs font-semibold text-coral-ink">غير منشور</p>}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => open(t)} icon={<Pencil className="size-4" />}>تعديل</Button>
                <ConfirmButton icon={<Trash className="size-4" />} onConfirm={async () => {
                  const res = await deleteTestimonial(t.id);
                  toast.result(res);
                  router.refresh();
                }}>حذف</ConfirmButton>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
