'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useI18n } from '@/components/I18nProvider';
import { sendEvent } from '@/lib/client/analytics';
import {
  submitCareers,
  submitContact,
  submitSponsorship,
  subscribeNewsletter,
  type FormResult,
} from '@/lib/actions/public';
import {
  budgetRanges,
  careersSchema,
  contactKinds,
  contactSchema,
  newsletterSchema,
  sponsorshipInterests,
  sponsorshipSchema,
} from '@/lib/validation/public';
import { FormStatus, Honeypot, SelectField, SubmitButton, TextAreaField, TextField, useErrorText, useFormToken } from './shared';

function useSubmit<T>(action: (input: unknown) => Promise<FormResult>, onSuccess?: () => void) {
  const [result, setResult] = useState<FormResult | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (values: T, setError: (field: string, message: string) => void) =>
    startTransition(async () => {
      try {
        const res = await action(values);
        setResult(res);
        if (!res.ok && res.fieldErrors) for (const [field, message] of Object.entries(res.fieldErrors)) setError(field, message);
        if (res.ok) onSuccess?.();
      } catch {
        setResult({ ok: false, message: 'error' });
      }
    });
  return { result, pending, submit };
}

export function ContactForm() {
  const { dict, locale } = useI18n();
  const token = useFormToken('contact');
  const err = useErrorText();
  const form = useForm<z.input<typeof contactSchema>, unknown, z.output<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { kind: 'general', name: '', email: '', subject: '', message: '', locale },
  });
  const { result, pending, submit } = useSubmit(submitContact, () => form.reset());
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="relative grid max-w-2xl gap-8"
      onSubmit={form.handleSubmit((values) => submit({ ...values, _t: token }, (f, m) => form.setError(f as never, { message: m })))}
    >
      <SelectField label={dict.forms.kind} error={err(e.kind)} {...form.register('kind')}>
        {contactKinds.map((k) => (
          <option key={k} value={k}>
            {dict.forms.kinds[k]}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-8 sm:grid-cols-2">
        <TextField label={dict.forms.name} autoComplete="name" error={err(e.name)} {...form.register('name')} />
        <TextField label={dict.forms.email} type="email" inputMode="email" autoComplete="email" dir="ltr" error={err(e.email)} {...form.register('email')} />
      </div>
      <TextField label={dict.forms.subject} error={err(e.subject)} {...form.register('subject')} />
      <TextAreaField label={dict.forms.message} error={err(e.message)} {...form.register('message')} />
      <Honeypot {...form.register('website_confirm')} />
      <div className="flex flex-wrap items-center gap-6">
        <SubmitButton pending={pending} />
        <FormStatus result={result} />
      </div>
    </form>
  );
}

export function CareersForm() {
  const { dict, locale } = useI18n();
  const token = useFormToken('careers');
  const err = useErrorText();
  const form = useForm<z.input<typeof careersSchema>, unknown, z.output<typeof careersSchema>>({
    resolver: zodResolver(careersSchema),
    defaultValues: { name: '', email: '', position: '', portfolio: '', message: '', locale },
  });
  const { result, pending, submit } = useSubmit(submitCareers, () => form.reset());
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="relative grid max-w-2xl gap-8"
      onSubmit={form.handleSubmit((values) => submit({ ...values, _t: token }, (f, m) => form.setError(f as never, { message: m })))}
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <TextField label={dict.forms.name} autoComplete="name" error={err(e.name)} {...form.register('name')} />
        <TextField label={dict.forms.email} type="email" inputMode="email" autoComplete="email" dir="ltr" error={err(e.email)} {...form.register('email')} />
      </div>
      <TextField label={dict.forms.position} error={err(e.position)} {...form.register('position')} />
      <TextField label={dict.forms.portfolio} type="url" inputMode="url" dir="ltr" placeholder="https://" error={err(e.portfolio)} {...form.register('portfolio')} />
      <TextAreaField label={dict.forms.message} error={err(e.message)} {...form.register('message')} />
      <Honeypot {...form.register('website_confirm')} />
      <div className="flex flex-wrap items-center gap-6">
        <SubmitButton pending={pending} />
        <FormStatus result={result} />
      </div>
    </form>
  );
}

export function SponsorshipForm() {
  const { dict, locale } = useI18n();
  const token = useFormToken('sponsorship');
  const err = useErrorText();
  const form = useForm<z.input<typeof sponsorshipSchema>, unknown, z.output<typeof sponsorshipSchema>>({
    resolver: zodResolver(sponsorshipSchema),
    defaultValues: { company: '', contactName: '', email: '', phone: '', website: '', interests: [], message: '', locale },
  });
  const { result, pending, submit } = useSubmit(submitSponsorship, () => form.reset());
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="relative grid max-w-2xl gap-8"
      onSubmit={form.handleSubmit((values) => submit({ ...values, _t: token }, (f, m) => form.setError(f as never, { message: m })))}
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <TextField label={dict.forms.company} autoComplete="organization" error={err(e.company)} {...form.register('company')} />
        <TextField label={dict.forms.contactName} autoComplete="name" error={err(e.contactName)} {...form.register('contactName')} />
        <TextField label={dict.forms.email} type="email" inputMode="email" autoComplete="email" dir="ltr" error={err(e.email)} {...form.register('email')} />
        <TextField label={dict.forms.phone} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" error={err(e.phone)} {...form.register('phone')} />
      </div>
      <TextField label={dict.forms.website} type="url" inputMode="url" dir="ltr" placeholder="https://" error={err(e.website)} {...form.register('website')} />
      <SelectField label={dict.forms.budget} error={err(e.budget)} {...form.register('budget', { setValueAs: (v: string) => (v ? v : undefined) })}>
        <option value="">—</option>
        {budgetRanges.map((b) => (
          <option key={b} value={b}>
            {dict.forms.budgets[b]}
          </option>
        ))}
      </SelectField>
      <fieldset>
        <legend className="mb-3 text-sm text-muted">{dict.forms.interests}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {sponsorshipInterests.map((interest) => (
            <label key={interest} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-fg">
              <input type="checkbox" value={interest} className="size-4 accent-current" {...form.register('interests')} />
              {dict.forms.interestOptions[interest]}
            </label>
          ))}
        </div>
      </fieldset>
      <TextAreaField label={dict.forms.message} error={err(e.message)} {...form.register('message')} />
      <Honeypot {...form.register('website_confirm')} />
      <div className="flex flex-wrap items-center gap-6">
        <SubmitButton pending={pending} />
        <FormStatus result={result} />
      </div>
    </form>
  );
}

export function NewsletterForm({ source = 'site', tone = 'default' }: { source?: string; tone?: 'default' | 'inverse' }) {
  const { dict, locale } = useI18n();
  const token = useFormToken('newsletter');
  const err = useErrorText();
  const form = useForm<z.input<typeof newsletterSchema>, unknown, z.output<typeof newsletterSchema>>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '', locale, source },
  });
  const { result, pending, submit } = useSubmit(subscribeNewsletter, () => {
    form.reset();
    sendEvent({ type: 'newsletter_signup', locale, path: location.pathname });
  });
  const error = err(form.formState.errors.email);
  return (
    <form
      noValidate
      className="relative"
      onSubmit={form.handleSubmit((values) => submit({ ...values, _t: token }, (f, m) => form.setError(f as never, { message: m })))}
    >
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-end ${tone === 'inverse' ? '[--fg:var(--inverse-fg)] [--line-strong:rgb(128_128_128/0.5)]' : ''}`}>
        <div className="flex-1">
          <TextField
            label={dict.newsletter.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            error={error}
            {...form.register('email')}
          />
        </div>
        <SubmitButton pending={pending} label={dict.newsletter.submit} />
      </div>
      <Honeypot {...form.register('website_confirm')} />
      <div className="mt-4 min-h-6">
        <FormStatus result={result} />
      </div>
      <p className="mt-2 text-xs text-muted">{dict.newsletter.privacyNote}</p>
    </form>
  );
}
