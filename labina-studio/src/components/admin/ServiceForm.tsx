"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveService, type ServiceInput } from "@/app/admin/actions";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldError, Hint, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Card } from "./ui";
import { ImageUpload } from "./ImageUpload";
import { Switch } from "./Switch";
import { toast } from "./Toaster";
import { BRAND_COLORS, SERVICE_ICONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { BrandColor, Service } from "@/lib/types";

export function ServiceForm({ service }: { service?: Service }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    slug: service?.slug ?? "",
    name: service?.name ?? "",
    tagline: service?.tagline ?? "",
    description: service?.description ?? "",
    features: (service?.features ?? []).join("\n"),
    price: service?.price === null || service?.price === undefined ? "" : String(service.price),
    price_note: service?.price_note ?? "",
    duration_minutes: String(service?.duration_minutes ?? 60),
    image_url: service?.image_url ?? null,
    color: (service?.color ?? "coral") as BrandColor,
    icon: service?.icon ?? "camera",
    is_active: service?.is_active ?? true,
    is_bookable: service?.is_bookable ?? true,
    sort_order: String(service?.sort_order ?? 100),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: ServiceInput = {
      slug: form.slug,
      name: form.name,
      tagline: form.tagline,
      description: form.description,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
      price: form.price.trim() === "" ? null : Number(form.price),
      price_note: form.price_note,
      duration_minutes: Number(form.duration_minutes),
      image_url: form.image_url,
      color: form.color,
      icon: form.icon,
      is_active: form.is_active,
      is_bookable: form.is_bookable,
      sort_order: Number(form.sort_order) || 0,
    };
    start(async () => {
      const res = await saveService(service?.id ?? null, input);
      toast.result(res);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return;
      }
      setErrors({});
      if (!service && res.data) router.replace(`/admin/services/${res.data.id}`);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="المعلومات الأساسية">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-name">اسم الخدمة</Label>
              <Input id="s-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
              <FieldError message={errors.name} />
            </div>
            <div>
              <Label htmlFor="s-slug">الرابط المختصر</Label>
              <Input id="s-slug" dir="ltr" className="text-right" placeholder="newborn" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} aria-invalid={!!errors.slug} />
              {errors.slug ? <FieldError message={errors.slug} /> : <Hint>يظهر في عنوان الصفحة: /services/{form.slug || "…"}</Hint>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="s-tagline" optional>وصف قصير</Label>
              <Input id="s-tagline" maxLength={160} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              <FieldError message={errors.tagline} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="s-desc" optional>الوصف التفصيلي</Label>
              <Textarea id="s-desc" rows={5} maxLength={4000} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="s-features" optional>ما تتضمنه الجلسة</Label>
              <Textarea id="s-features" rows={5} value={form.features} onChange={(e) => set("features", e.target.value)} />
              <Hint>كل نقطة في سطر مستقل (حتى 12 نقطة).</Hint>
              <FieldError message={errors.features} />
            </div>
          </div>
        </Card>

        <Card title="السعر والمدة">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="s-price" optional>السعر</Label>
              <Input id="s-price" type="number" inputMode="decimal" min={0} step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
              {errors.price ? <FieldError message={errors.price} /> : <Hint>اتركه فارغاً ليظهر «السعر عند الاستفسار».</Hint>}
            </div>
            <div>
              <Label htmlFor="s-pnote" optional>قبل السعر</Label>
              <Input id="s-pnote" placeholder="يبدأ من" maxLength={80} value={form.price_note} onChange={(e) => set("price_note", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-dur">مدة الجلسة (دقيقة)</Label>
              <Input id="s-dur" type="number" min={15} max={600} step={15} value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} aria-invalid={!!errors.duration_minutes} />
              {errors.duration_minutes ? <FieldError message={errors.duration_minutes} /> : <Hint>تحجز هذه المدة كاملة في التقويم.</Hint>}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="الصورة" description="اختيارية. بدونها تظهر الخدمة بلونها وأيقونتها.">
          <ImageUpload folder="services" value={form.image_url} onChange={(v) => set("image_url", v)} />
          <FieldError message={errors.image_url} />
        </Card>

        <Card title="المظهر">
          <Label>اللون</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="اللون">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={form.color === c.value}
                aria-label={c.label}
                onClick={() => set("color", c.value)}
                className={cn("size-10 rounded-xl ring-offset-2 ring-offset-paper transition", form.color === c.value && "ring-2 ring-plum")}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Label htmlFor="s-icon" className="mt-5">الأيقونة</Label>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cream text-plum"><ServiceIcon name={form.icon} className="size-6" /></span>
            <Select id="s-icon" value={form.icon} onChange={(e) => set("icon", e.target.value)}>
              {SERVICE_ICONS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </Select>
          </div>
          <Label htmlFor="s-sort" className="mt-5">ترتيب الظهور</Label>
          <Input id="s-sort" type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
          <Hint>الرقم الأصغر يظهر أولاً.</Hint>
        </Card>

        <Card title="الإتاحة">
          <label className="flex items-center justify-between gap-3 py-2">
            <span>ظاهرة في الموقع</span>
            <Switch checked={form.is_active} onChange={(v) => set("is_active", v)} />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <span>متاحة للحجز الإلكتروني</span>
            <Switch checked={form.is_bookable} onChange={(v) => set("is_bookable", v)} />
          </label>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" loading={pending}>{service ? "حفظ التعديلات" : "إضافة الخدمة"}</Button>
          <ButtonLink href="/admin/services" variant="ghost" size="lg">رجوع</ButtonLink>
        </div>
      </div>
    </form>
  );
}
