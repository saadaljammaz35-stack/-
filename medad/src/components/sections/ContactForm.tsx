'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import {
  CONTACT_FIELDS,
  LIMITS,
  validateField,
  type ContactErrors,
  type ContactField,
  type ContactInput,
  type ContactResponse,
} from '@/lib/contact';
import { PREFILL_EVENT, type PrefillDetail } from '@/components/work/ProjectDialog';
import { Button } from '@/components/ui/Button';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success' }
  | { kind: 'error'; reason: 'invalid' | 'not_configured' | 'rate_limited' | 'generic' | 'network' };

const EMPTY: ContactInput = { name: '', email: '', projectType: '', budget: '', details: '' };

export function ContactForm({
  t,
  locale,
  fallbackEmail,
}: {
  t: Dictionary['contact'];
  locale: Locale;
  fallbackEmail: string | null;
}) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<ContactInput>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // "Start a similar project" from the portfolio pre-selects the type.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const { projectType } = (e as CustomEvent<PrefillDetail>).detail;
      setValues((v) => ({ ...v, projectType }));
      setErrors((er) => ({ ...er, projectType: undefined }));
    };
    window.addEventListener(PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(PREFILL_EVENT, onPrefill);
  }, []);

  const id = (f: string) => `${uid}-${f}`;
  const message = (f: ContactField) => {
    const code = errors[f];
    return code ? t.errors[code] : null;
  };

  const update = <K extends ContactField>(field: K, value: ContactInput[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (touched[field] || errors[field]) {
      setErrors((er) => ({ ...er, [field]: validateField(field, value) ?? undefined }));
    }
  };

  const blur = (field: ContactField) => {
    setTouched((tt) => ({ ...tt, [field]: true }));
    setErrors((er) => ({ ...er, [field]: validateField(field, values[field]) ?? undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status.kind === 'sending') return;

    const next: ContactErrors = {};
    for (const f of CONTACT_FIELDS) {
      const code = validateField(f, values[f]);
      if (code) next[f] = code;
    }
    setErrors(next);
    setTouched({ name: true, email: true, projectType: true, budget: true, details: true });
    const firstInvalid = CONTACT_FIELDS.find((f) => next[f]);
    if (firstInvalid) {
      setStatus({ kind: 'error', reason: 'invalid' });
      const el =
        formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`) ?? null;
      el?.focus();
      return;
    }

    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, website: honeypot, locale }),
      });
      const data = (await res.json().catch(() => null)) as ContactResponse | null;
      if (res.ok && data?.ok) {
        setStatus({ kind: 'success' });
        setValues(EMPTY);
        setTouched({});
        setErrors({});
      } else if (data && !data.ok && data.error === 'invalid') {
        setErrors(data.fields ?? {});
        setStatus({ kind: 'error', reason: 'invalid' });
      } else if (data && !data.ok && data.error === 'not_configured') {
        setStatus({ kind: 'error', reason: 'not_configured' });
      } else if (data && !data.ok && data.error === 'rate_limited') {
        setStatus({ kind: 'error', reason: 'rate_limited' });
      } else {
        setStatus({ kind: 'error', reason: 'generic' });
      }
    } catch {
      setStatus({ kind: 'error', reason: 'network' });
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  const fieldCls = (f: ContactField) =>
    `w-full rounded-2xl border bg-white/[0.03] px-5 text-[1rem] text-white placeholder:text-mist transition-[border-color,box-shadow,background-color] duration-300 outline-none focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgb(65_105_255/0.18)] ${
      errors[f] ? 'border-[#ff7a7a]/70 focus:border-[#ff7a7a]' : 'border-white/10 hover:border-white/20 focus:border-icy/60'
    }`;

  const label = (f: ContactField, text: string) => (
    <label htmlFor={id(f)} className="mb-2.5 flex items-center gap-2 text-sm font-medium text-white">
      {text}
      <span className="text-icy" aria-hidden="true">
        *
      </span>
      <span className="sr-only">({t.form.required})</span>
    </label>
  );

  const errorText_ = (f: ContactField) =>
    message(f) ? (
      <p id={id(`${f}-error`)} className="mt-2 flex items-center gap-1.5 text-[0.85rem] text-[#ff9b9b]">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
        {message(f)}
      </p>
    ) : null;

  const describedBy = (f: ContactField, extra?: string) =>
    [errors[f] ? id(`${f}-error`) : null, extra].filter(Boolean).join(' ') || undefined;

  if (status.kind === 'success') {
    return (
      <div className="glass glass-rim relative overflow-hidden rounded-[2rem] p-8 sm:p-12">
        <div aria-hidden="true" className="absolute -top-20 h-60 w-60 rounded-full bg-electric/40 blur-[90px] ltr:-right-10 rtl:-left-10" />
        <div ref={statusRef} tabIndex={-1} role="status" className="relative flex flex-col items-start gap-6 outline-none">
          <span className="grid size-14 place-items-center rounded-full bg-electric shadow-[0_0_30px_rgb(65_105_255/0.7)]">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h3 className="text-h3">{t.status.successTitle}</h3>
          <p className="max-w-md text-lead text-cool">{t.status.successText}</p>
          <Button variant="glass" onClick={() => setStatus({ kind: 'idle' })}>
            {t.form.sendAnother}
          </Button>
        </div>
      </div>
    );
  }

  const errorText =
    status.kind === 'error'
      ? {
          invalid: t.errors.fix,
          not_configured: t.status.notConfigured,
          rate_limited: t.status.rateLimited,
          generic: t.status.generic,
          network: t.status.network,
        }[status.reason]
      : null;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={id('title')}
      className="reveal glass glass-rim relative overflow-hidden rounded-[2rem] p-6 sm:p-10"
    >
      <div aria-hidden="true" className="absolute -top-24 h-64 w-64 rounded-full bg-electric/25 blur-[100px] ltr:-right-16 rtl:-left-16" />
      <div className="relative">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h3 id={id('title')} className="text-h3">
            {t.form.title}
          </h3>
          <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase">MEDAD / Brief</span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            {label('name', t.form.name)}
            <input
              id={id('name')}
              name="name"
              type="text"
              autoComplete="name"
              maxLength={LIMITS.name.max}
              placeholder={t.form.namePh}
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              onBlur={() => blur('name')}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy('name')}
              aria-required="true"
              className={`${fieldCls('name')} h-14`}
            />
            {errorText_('name')}
          </div>
          <div>
            {label('email', t.form.email)}
            <input
              id={id('email')}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              maxLength={LIMITS.email.max}
              placeholder={t.form.emailPh}
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              onBlur={() => blur('email')}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy('email')}
              aria-required="true"
              className={`${fieldCls('email')} h-14 rtl:text-right`}
            />
            {errorText_('email')}
          </div>

          <div className="sm:col-span-2">
            {label('projectType', t.form.type)}
            <div className="relative">
              <select
                id={id('projectType')}
                name="projectType"
                value={values.projectType}
                onChange={(e) => update('projectType', e.target.value as ContactInput['projectType'])}
                onBlur={() => blur('projectType')}
                aria-invalid={Boolean(errors.projectType)}
                aria-describedby={describedBy('projectType')}
                aria-required="true"
                className={`${fieldCls('projectType')} h-14 appearance-none pe-12 ${values.projectType ? '' : 'text-mist'}`}
              >
                <option value="" disabled>
                  {t.form.typePh}
                </option>
                {t.projectTypes.map((o) => (
                  <option key={o.value} value={o.value} className="bg-midnight text-white">
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-cool ltr:right-5 rtl:left-5" />
            </div>
            {errorText_('projectType')}
          </div>

          <fieldset
            className="sm:col-span-2"
            aria-invalid={Boolean(errors.budget)}
            aria-describedby={describedBy('budget')}
          >
            <legend className="mb-2.5 flex items-center gap-2 text-sm font-medium text-white">
              {t.form.budget}
              <span className="text-icy" aria-hidden="true">
                *
              </span>
              <span className="sr-only">({t.form.required})</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {t.budgets.map((b) => {
                const checked = values.budget === b.value;
                return (
                  <label
                    key={b.value}
                    className={`relative cursor-pointer rounded-full border px-4 py-2.5 text-[0.9rem] transition-all duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-icy ${
                      checked
                        ? 'border-icy/70 bg-electric/25 text-white shadow-[0_0_20px_-4px_rgb(65_105_255/0.7)]'
                        : errors.budget
                          ? 'border-[#ff7a7a]/50 text-cool hover:text-white'
                          : 'border-white/10 text-cool hover:border-white/25 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={b.value}
                      checked={checked}
                      onChange={() => {
                        update('budget', b.value);
                        setTouched((tt) => ({ ...tt, budget: true }));
                      }}
                      className="sr-only"
                    />
                    {b.label}
                  </label>
                );
              })}
            </div>
            {errorText_('budget')}
          </fieldset>

          <div className="sm:col-span-2">
            {label('details', t.form.details)}
            <textarea
              id={id('details')}
              name="details"
              rows={5}
              maxLength={LIMITS.details.max}
              placeholder={t.form.detailsPh}
              value={values.details}
              onChange={(e) => update('details', e.target.value)}
              onBlur={() => blur('details')}
              aria-invalid={Boolean(errors.details)}
              aria-describedby={describedBy('details', id('details-count'))}
              aria-required="true"
              className={`${fieldCls('details')} min-h-40 resize-y py-4 leading-relaxed`}
            />
            <div className="flex items-start justify-between gap-4">
              {errorText_('details')}
              <p id={id('details-count')} className="mt-2 ms-auto font-latin text-xs text-mist" dir="ltr">
                {values.details.trim().length} / {LIMITS.details.max}
              </p>
            </div>
          </div>

          {/* honeypot — hidden from people and assistive tech */}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 size-px overflow-hidden opacity-0 [clip-path:inset(50%)]">
            <label htmlFor={id('website')}>{t.form.honeypot}</label>
            <input
              id={id('website')}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
        </div>

        <div
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="outline-none"
        >
          <AnimatePresence initial={false}>
            {errorText ? (
              <motion.div
                key={status.kind === 'error' ? status.reason : 'none'}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/[0.07] p-4 text-[0.92rem] text-[#ffc2c2]">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p>{errorText}</p>
                    {status.kind === 'error' && status.reason === 'not_configured' && fallbackEmail ? (
                      <p className="mt-1">
                        {t.status.notConfiguredEmail}{' '}
                        <a href={`mailto:${fallbackEmail}`} className="font-semibold text-white underline" dir="ltr">
                          {fallbackEmail}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Button type="submit" size="lg" arrow={status.kind !== 'sending'} disabled={status.kind === 'sending'} aria-busy={status.kind === 'sending'} className="disabled:opacity-80">
            {status.kind === 'sending' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t.form.sending}
              </span>
            ) : (
              t.form.submit
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
