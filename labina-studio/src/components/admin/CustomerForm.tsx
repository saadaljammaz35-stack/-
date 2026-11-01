"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCustomer } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Field";
import { toast } from "./Toaster";

export function CustomerForm({ id, initial }: { id: string; initial: { full_name: string; email: string; notes: string } }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateCustomer(id, form);
          toast.result(res);
          setErrors(!res.ok ? res.fieldErrors ?? {} : {});
          if (res.ok) router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="cf-name">الاسم</Label>
        <Input id="cf-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <FieldError message={errors.full_name} />
      </div>
      <div>
        <Label htmlFor="cf-email" optional>البريد</Label>
        <Input id="cf-email" dir="ltr" className="text-right" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <FieldError message={errors.email} />
      </div>
      <div>
        <Label htmlFor="cf-notes" optional>ملاحظات داخلية</Label>
        <Textarea id="cf-notes" rows={4} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Button type="submit" variant="dark" loading={pending}>حفظ</Button>
    </form>
  );
}
