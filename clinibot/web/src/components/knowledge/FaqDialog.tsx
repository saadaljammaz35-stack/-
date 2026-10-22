import { useId, useState, type FormEvent } from "react";
import { Button, Dialog, Field, Input, Switch, Textarea } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import {
  EMPTY_FAQ,
  LIMITS,
  faqToForm,
  validateFaq,
  type FaqField,
  type FaqFormValues,
  type FaqRow,
  type FormErrors,
} from "./model";
import { useSaveFaq } from "./queries";
import { useFieldErrorText } from "./useFieldErrorText";

export interface FaqDialogProps {
  orgId: string;
  /** null = add a new question. */
  faq: FaqRow | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  /** Focus target on close when the opener is gone (see Dialog). */
  returnFocus?: () => HTMLElement | null;
}

/** Add / edit an approved FAQ. Mount it only while open so the form starts fresh. */
export function FaqDialog({ orgId, faq, onClose, onSaved, returnFocus }: FaqDialogProps) {
  const { t, formatNumber } = useI18n();
  const formId = useId();
  const save = useSaveFaq(orgId);
  const errorText = useFieldErrorText();
  const [values, setValues] = useState<FaqFormValues>(faq ? faqToForm(faq) : EMPTY_FAQ);
  const [errors, setErrors] = useState<FormErrors<FaqField>>({});
  const [submitted, setSubmitted] = useState(false);

  function set<K extends FaqField>(key: K, value: FaqFormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) {
      const result = validateFaq(next);
      setErrors(result.ok ? {} : result.errors);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const result = validateFaq(values);
    if (!result.ok) {
      setErrors(result.errors);
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    save.mutate(
      { id: faq?.id ?? null, payload: result.payload },
      { onSuccess: () => onSaved(faq === null) },
    );
  }

  const questionHint = t("knowledge.questionHint", {
    min: formatNumber(LIMITS.questionMin),
    max: formatNumber(LIMITS.questionMax),
  });
  const answerHint = t("knowledge.answerHint", { max: formatNumber(LIMITS.answerMax) });

  const languages = [
    {
      code: "ar",
      dir: "rtl",
      legend: t("knowledge.faqArabic"),
      question: "question_ar",
      answer: "answer_ar",
      questionLabel: t("knowledge.fieldQuestionAr"),
      answerLabel: t("knowledge.fieldAnswerAr"),
    },
    {
      code: "en",
      dir: "ltr",
      legend: t("knowledge.faqEnglish"),
      question: "question_en",
      answer: "answer_en",
      questionLabel: t("knowledge.fieldQuestionEn"),
      answerLabel: t("knowledge.fieldAnswerEn"),
    },
  ] as const;

  return (
    <Dialog
      open
      onClose={onClose}
      returnFocus={returnFocus}
      dismissible={!save.isPending}
      size="lg"
      title={faq ? t("knowledge.faqEditTitle") : t("knowledge.faqNewTitle")}
      description={t("knowledge.faqDialogDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {faq ? t("common.saveChanges") : t("knowledge.addFaq")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {languages.map((language) => (
          <fieldset
            key={language.code}
            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 p-4"
          >
            <legend className="px-1 text-sm font-extrabold text-slate-900">
              {language.legend}
            </legend>
            <Field
              label={language.questionLabel}
              hint={questionHint}
              error={errorText(errors[language.question])}
            >
              <Input
                dir={language.dir}
                lang={language.code}
                value={values[language.question]}
                onChange={(event) => set(language.question, event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field
              label={language.answerLabel}
              hint={answerHint}
              error={errorText(errors[language.answer])}
            >
              <Textarea
                dir={language.dir}
                lang={language.code}
                rows={4}
                value={values[language.answer]}
                onChange={(event) => set(language.answer, event.target.value)}
              />
            </Field>
          </fieldset>
        ))}

        <Switch
          checked={values.is_active}
          onCheckedChange={(checked) => set("is_active", checked)}
          label={t("knowledge.faqActiveLabel")}
          description={t("knowledge.faqActiveHint")}
        />

        {save.error ? <QueryError error={save.error} /> : null}
      </form>
    </Dialog>
  );
}
