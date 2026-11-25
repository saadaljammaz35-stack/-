'use client';

import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { FieldError } from 'react-hook-form';
import { useI18n } from '@/components/I18nProvider';
import type { FormResult } from '@/lib/actions/public';

/** Fetches the signed timing token the server expects with every public form submission. */
export function useFormToken(form: string): string {
  const [token, setToken] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/form-token?form=${form}`, { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { token?: string } | null) => {
        if (data?.token) setToken(data.token);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [form]);
  return token;
}

export function useErrorText() {
  const { dict } = useI18n();
  return (error?: FieldError | { message?: string }) => {
    if (!error?.message) return undefined;
    const key = error.message as keyof typeof dict.forms;
    const value = dict.forms[key];
    return typeof value === 'string' ? value : dict.forms.required;
  };
}

interface FieldShellProps {
  label: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  hint?: string;
}

export function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-[#b3261e] dark:text-[#ff8a80]">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => <input id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />}
    </FieldShell>
  );
}

export function TextAreaField({ label, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <FieldShell label={label} error={error}>
      {(id, describedBy) => <textarea id={id} rows={6} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />}
    </FieldShell>
  );
}

export function SelectField({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return (
    <FieldShell label={label} error={error}>
      {(id, describedBy) => (
        <select id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/** Hidden honeypot. Real visitors never see or fill it. */
export function Honeypot(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" {...props} />
      </label>
    </div>
  );
}

export function FormStatus({ result }: { result: FormResult | null }) {
  const { dict } = useI18n();
  if (!result || result.message === 'invalid') return null;
  const text = result.ok
    ? result.message === 'sent'
      ? dict.forms.sent
      : result.message === 'successConfirm'
        ? dict.newsletter.successConfirm
        : dict.newsletter.successPending
    : result.message === 'rateLimited'
      ? dict.forms.rateLimited
      : result.message === 'unavailable'
        ? dict.forms.unavailable
        : dict.forms.error;
  return (
    <p role="status" aria-live="polite" className={`text-base ${result.ok ? 'text-fg' : 'text-[#b3261e] dark:text-[#ff8a80]'}`}>
      {text}
    </p>
  );
}

export function SubmitButton({ pending, label }: { pending: boolean; label?: string }) {
  const { dict } = useI18n();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? dict.forms.sending : (label ?? dict.forms.send)}
    </button>
  );
}
