import { createContext, use } from "react";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Props a form control should merge in when rendered inside <Field>: the
 * label's `id`, `aria-describedby` (hint + error), `aria-invalid`, `required`.
 * Input, Textarea and Select do this automatically.
 */
export function useFieldControl<
  P extends {
    id?: string | undefined;
    "aria-describedby"?: string | undefined;
    "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling" | undefined;
    required?: boolean | undefined;
  },
>(props: P): P {
  const field = use(FieldContext);
  if (!field) return props;
  const describedBy = [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ");
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}
