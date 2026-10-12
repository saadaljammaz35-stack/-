import { useCallback, useRef, useState, type FormEvent } from "react";
import type { z } from "zod";
import { hasMessage, type MessageKey } from "@/i18n";

/** Field → message key of its first problem. */
export type FormErrors<T> = Partial<Record<keyof T & string, MessageKey>>;

/**
 * Validates with a Zod schema whose error messages are message keys
 * (e.g. `z.string().min(10, "auth.passwordTooShort")`).
 */
export function validateForm<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: Record<string, MessageKey> } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, MessageKey> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (errors[field]) continue;
    errors[field] = hasMessage(issue.message) ? issue.message : "errors.invalid_request";
  }
  return { ok: false, errors };
}

/**
 * Minimal controlled-form state backed by a Zod schema:
 *
 *   const form = useForm(schema, { email: "", password: "" });
 *   <form onSubmit={form.handleSubmit(async (data) => { … })} noValidate>
 *     <Field label=… error={form.errorText("email")}>
 *       <Input value={form.values.email} onChange={(e) => form.setValue("email", e.target.value)} />
 *
 * Errors appear after the first submit and then update as the user types;
 * on a failed submit the first invalid field receives focus.
 */
export function useForm<S extends z.ZodType<unknown, Record<string, unknown>>>(
  schema: S,
  initialValues: z.input<S>,
) {
  type Values = z.input<S>;
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<FormErrors<Values>>({});
  const submitted = useRef(false);

  /** Updates several fields at once (e.g. a name and the slug suggested from it). */
  const setFields = useCallback(
    (patch: Partial<Values>) => {
      const next = { ...values, ...patch } as Values;
      setValues(next);
      if (!submitted.current) return;
      // Keep showing only problems that still exist (a fixed field clears as
      // they type) plus the edited fields' own; untouched fields stay quiet.
      const result = validateForm(schema, next);
      const current = (result.ok ? {} : result.errors) as FormErrors<Values>;
      setErrors((previous) => {
        const updated: FormErrors<Values> = {};
        const keys = new Set([...Object.keys(previous), ...Object.keys(patch)]) as Set<
          keyof Values & string
        >;
        for (const field of keys) {
          const message = current[field];
          if (message) updated[field] = message;
        }
        return updated;
      });
    },
    [schema, values],
  );

  const setValue = useCallback(
    <K extends keyof Values & string>(key: K, value: Values[K]) => {
      setFields({ [key]: value } as unknown as Partial<Values>);
    },
    [setFields],
  );

  const setFieldError = useCallback(
    (key: keyof Values & string, message: MessageKey | undefined) => {
      setErrors((previous) => ({ ...previous, [key]: message }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (onValid: (data: z.output<S>) => void | Promise<void>) =>
      async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        submitted.current = true;
        const result = validateForm(schema, values);
        if (!result.ok) {
          setErrors(result.errors as FormErrors<Values>);
          // Wait for the re-render that sets aria-invalid, then focus the first bad field.
          requestAnimationFrame(() => {
            formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
          });
          return;
        }
        setErrors({});
        await onValid(result.data);
      },
    [schema, values],
  );

  return { values, setValue, setFields, errors, setFieldError, handleSubmit };
}
