"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import { deleteFaq, saveFaq, type FaqInput } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { Card, EmptyState } from "./ui";
import { ConfirmButton } from "./ConfirmButton";
import { Switch } from "./Switch";
import { toast } from "./Toaster";
import { cn } from "@/lib/cn";
import type { Faq } from "@/lib/types";

export function FaqManager({ items }: { items: Faq[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FaqInput>({ question: "", answer: "", is_published: true, sort_order: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const open = (f?: Faq) => {
    setErrors({});
    setEditing(f?.id ?? "new");
    setForm(f ? { question: f.question, answer: f.answer, is_published: f.is_published, sort_order: f.sort_order } : { question: "", answer: "", is_published: true, sort_order: (items.at(-1)?.sort_order ?? 0) + 10 });
  };

  const save = () =>
    start(async () => {
      const res = await saveFaq(editing === "new" ? null : editing, form);
      toast.result(res);
      if (!res.ok) return setErrors(res.fieldErrors ?? {});
      setEditing(null);
      router.refresh();
    });

  const formUi = (
    <Card title={editing === "new" ? "سؤال جديد" : "تعديل السؤال"}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="f-q">السؤال</Label>
          <Input id="f-q" value={form.question} maxLength={200} onChange={(e) => setForm({ ...form, question: e.target.value })} aria-invalid={!!errors.question} />
          <FieldError message={errors.question} />
        </div>
        <div>
          <Label htmlFor="f-a">الإجابة</Label>
          <Textarea id="f-a" rows={4} maxLength={2000} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} aria-invalid={!!errors.answer} />
          <FieldError message={errors.answer} />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-32">
            <Label htmlFor="f-sort">الترتيب</Label>
            <Input id="f-sort" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
          </div>
          <label className="flex items-center gap-3 pb-3">
            <Switch checked={!!form.is_published} onChange={(v) => setForm({ ...form, is_published: v })} />
            منشور
          </label>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={save} loading={pending}>حفظ</Button>
        <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>إلغاء</Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {editing === null && <Button onClick={() => open()} icon={<Plus className="size-4" />}>إضافة سؤال</Button>}
      {editing === "new" && formUi}
      {items.length === 0 && editing === null && <EmptyState title="لا توجد أسئلة" />}
      <ul className="space-y-3">
        {items.map((f) =>
          editing === f.id ? (
            <li key={f.id}>{formUi}</li>
          ) : (
            <li key={f.id} className={cn("rounded-3xl bg-paper p-5 shadow-soft", !f.is_published && "opacity-60")}>
              <p className="font-semibold text-plum">{f.question}</p>
              <p className="mt-2 whitespace-pre-line leading-7 text-ink-soft">{f.answer}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => open(f)} icon={<Pencil className="size-4" />}>تعديل</Button>
                <ConfirmButton icon={<Trash className="size-4" />} onConfirm={async () => {
                  const res = await deleteFaq(f.id);
                  toast.result(res);
                  router.refresh();
                }}>حذف</ConfirmButton>
                {!f.is_published && <span className="text-xs font-semibold text-coral-ink">غير منشور</span>}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
