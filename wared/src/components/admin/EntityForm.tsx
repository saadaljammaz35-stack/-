'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import {
  articleSchema,
  categorySchema,
  clipSchema,
  episodeSchema,
  guestSchema,
  inviteSchema,
  programSchema,
  settingsSchema,
  type AdminResult,
} from '@/lib/validation/admin';

/* Schemas are looked up by name because Zod objects cannot be passed from server to client components. */
const SCHEMAS = {
  program: programSchema,
  episode: episodeSchema,
  article: articleSchema,
  guest: guestSchema,
  clip: clipSchema,
  category: categorySchema,
  settings: settingsSchema,
  invite: inviteSchema,
} as const;
export type SchemaName = keyof typeof SCHEMAS;
import { MediaUploader, type MediaKind, type MediaOption } from './MediaUploader';

export type FieldConfig =
  | { type: 'section'; title: string; description?: string }
  | {
      type: 'text' | 'url' | 'email' | 'number' | 'datetime';
      name: string;
      label: string;
      hint?: string;
      dir?: 'rtl' | 'ltr';
      placeholder?: string;
      wide?: boolean;
    }
  | { type: 'textarea'; name: string; label: string; hint?: string; dir?: 'rtl' | 'ltr'; rows?: number; mono?: boolean; wide?: boolean }
  | { type: 'select'; name: string; label: string; hint?: string; options: { value: string; label: string }[]; wide?: boolean }
  | { type: 'checkbox'; name: string; label: string; hint?: string; wide?: boolean }
  | { type: 'media'; name: string; label: string; kind: MediaKind; hint?: string; wide?: boolean }
  | { type: 'multiselect'; name: string; label: string; hint?: string; options: { value: string; label: string }[]; wide?: boolean };

interface EntityFormProps {
  fields: FieldConfig[];
  schema: SchemaName;
  action: (values: unknown) => Promise<AdminResult>;
  defaultValues: Record<string, unknown>;
  media?: Partial<Record<MediaKind, MediaOption[]>>;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}

const errorClass = 'mt-1.5 text-sm text-[#b3261e] dark:text-[#ff8a80]';

/** Declarative admin form: React Hook Form + Zod on the client, the same schema re-checked by the server action. */
export function EntityForm({ fields, schema, action, defaultValues, media = {}, submitLabel = 'حفظ', resetOnSuccess = false }: EntityFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  const [mediaOptions, setMediaOptions] = useState(media);
  const form = useForm<FieldValues>({ resolver: zodResolver(SCHEMAS[schema] as never) as unknown as Resolver<FieldValues>, defaultValues, mode: 'onBlur' });
  const errors = form.formState.errors;
  const err = (name: string) => {
    const e = name.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], errors) as { message?: string } | undefined;
    return e?.message;
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await action(values);
      setResult(res);
      if (!res.ok && res.fieldErrors) for (const [field, message] of Object.entries(res.fieldErrors)) form.setError(field, { message });
      if (res.ok) {
        if (res.redirectTo) router.push(res.redirectTo);
        else router.refresh();
        if (resetOnSuccess) form.reset();
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-x-8 gap-y-7 md:grid-cols-2">
      {fields.map((field, index) => {
        if (field.type === 'section') {
          return (
            <div key={`section-${index}`} className="border-t border-line pt-6 md:col-span-2">
              <h2 className="text-lg font-bold">{field.title}</h2>
              {field.description && <p className="mt-1 text-sm text-muted">{field.description}</p>}
            </div>
          );
        }
        const id = `f-${field.name}`;
        const message = err(field.name);
        const span = field.wide || field.type === 'textarea' || field.type === 'media' || field.type === 'multiselect' ? 'md:col-span-2' : '';
        const describedBy = [message ? `${id}-error` : null, field.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
        const common = { id, 'aria-invalid': message ? true : undefined, 'aria-describedby': describedBy } as const;
        let control: React.ReactNode;

        switch (field.type) {
          case 'textarea':
            control = <textarea {...common} rows={field.rows ?? 5} dir={field.dir} className={`field ${field.mono ? 'font-mono text-sm' : ''}`} {...form.register(field.name)} />;
            break;
          case 'select':
            control = (
              <select {...common} className="field" {...form.register(field.name)}>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
            break;
          case 'checkbox':
            control = (
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" {...common} className="size-5 accent-current" {...form.register(field.name)} />
                <span>{field.label}</span>
              </label>
            );
            break;
          case 'multiselect':
            control = (
              <Controller
                control={form.control}
                name={field.name}
                render={({ field: f }) => {
                  const value: string[] = Array.isArray(f.value) ? f.value : [];
                  return field.options.length === 0 ? (
                    <p className="py-2 text-sm text-muted">لا توجد عناصر متاحة بعد.</p>
                  ) : (
                    <div className="grid max-h-64 gap-2 overflow-y-auto py-2 sm:grid-cols-2" {...common}>
                      {field.options.map((o) => (
                        <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 has-[:checked]:border-fg">
                          <input
                            type="checkbox"
                            className="size-4 accent-current"
                            checked={value.includes(o.value)}
                            onChange={(e) => f.onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
            );
            break;
          case 'media': {
            const options = mediaOptions[field.kind] ?? [];
            control = (
              <Controller
                control={form.control}
                name={field.name}
                render={({ field: f }) => {
                  const selected = options.find((o) => o.id === f.value);
                  return (
                    <div className="space-y-3">
                      <select {...common} className="field" value={(f.value as string) ?? ''} onChange={(e) => f.onChange(e.target.value)}>
                        <option value="">— بدون —</option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {selected && field.kind === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded asset
                        <img src={selected.url} alt="" className="h-28 w-auto rounded-xl border border-line object-cover" />
                      )}
                      {selected && field.kind === 'audio' && <audio src={selected.url} controls preload="none" className="w-full" />}
                      <MediaUploader
                        kind={field.kind}
                        onUploaded={(asset) => {
                          setMediaOptions((prev) => ({ ...prev, [field.kind]: [asset, ...(prev[field.kind] ?? [])] }));
                          f.onChange(asset.id);
                        }}
                      />
                    </div>
                  );
                }}
              />
            );
            break;
          }
          default:
            control = (
              <input
                {...common}
                type={field.type === 'datetime' ? 'datetime-local' : field.type}
                dir={field.dir ?? (field.type === 'url' || field.type === 'email' ? 'ltr' : undefined)}
                placeholder={field.placeholder}
                className="field"
                {...form.register(field.name)}
              />
            );
        }

        return (
          <div key={field.name} className={span}>
            {field.type !== 'checkbox' && (
              <label htmlFor={id} className="block text-sm text-muted">
                {field.label}
              </label>
            )}
            {control}
            {field.hint && (
              <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-muted">
                {field.hint}
              </p>
            )}
            {message && (
              <p id={`${id}-error`} role="alert" className={errorClass}>
                {message}
              </p>
            )}
          </div>
        );
      })}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur md:col-span-2 md:mx-0 md:px-0">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : submitLabel}
        </button>
        {result && (
          <p role="status" aria-live="polite" className={result.ok ? 'text-fg' : errorClass.replace('mt-1.5 ', '')}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  );
}
