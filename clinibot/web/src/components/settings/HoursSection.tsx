import { useRef, useState } from "react";
import type { z } from "zod";
import { Alert, Field, Textarea } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Json } from "@/lib/database.types";
import { useForm } from "@/lib/useForm";
import { hoursNotesSchema } from "./model";
import { useUpdateClinicSettings, type ClinicSettings } from "./queries";
import { SettingsFormCard } from "./SettingsFormCard";
import { WorkingHoursEditor } from "./WorkingHoursEditor";
import {
  DAY_KEYS,
  draftFromHours,
  sameHours,
  serializeHours,
  validateHoursDraft,
  type DayError,
  type DayKey,
  type HoursDraft,
} from "./workingHours";

/** clinic_settings.working_hours plus the free-text notes in both languages. */
export function HoursSection({
  orgId,
  settings,
  readOnly,
}: {
  orgId: string;
  settings: ClinicSettings;
  readOnly: boolean;
}) {
  const [version, setVersion] = useState(0);
  return (
    <HoursForm
      key={version}
      orgId={orgId}
      settings={settings}
      readOnly={readOnly}
      onReset={() => setVersion((value) => value + 1)}
    />
  );
}

function HoursForm({
  orgId,
  settings,
  readOnly,
  onReset,
}: {
  orgId: string;
  settings: ClinicSettings;
  readOnly: boolean;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const update = useUpdateClinicSettings(orgId);
  const editorRef = useRef<HTMLDivElement>(null);
  const [savedHours, setSavedHours] = useState(() => draftFromHours(settings.working_hours));
  const [hours, setHours] = useState<HoursDraft>(savedHours);
  const [dayErrors, setDayErrors] = useState<Partial<Record<DayKey, DayError>>>({});
  const [savedNotes, setSavedNotes] = useState(() => ({
    noteAr: settings.working_hours_note_ar ?? "",
    noteEn: settings.working_hours_note_en ?? "",
  }));
  const notes = useForm(hoursNotesSchema, savedNotes);
  const dirty =
    !sameHours(hours, savedHours) || JSON.stringify(notes.values) !== JSON.stringify(savedNotes);

  function changeHours(next: HoursDraft) {
    setHours(next);
    // Once problems are shown, keep them in step with the edits.
    if (Object.keys(dayErrors).length > 0) {
      const result = validateHoursDraft(next);
      setDayErrors(result.ok ? {} : result.errors);
    }
  }

  async function save(notePatch: z.output<typeof hoursNotesSchema>) {
    const result = validateHoursDraft(hours);
    if (!result.ok) {
      setDayErrors(result.errors);
      const first = DAY_KEYS.find((day) => result.errors[day]);
      // After the re-render that marks the fields, move focus to the first problem.
      requestAnimationFrame(() => {
        const row = editorRef.current?.querySelector(`li[data-day="${first}"]`);
        const target =
          row?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          row?.querySelector<HTMLElement>('[role="switch"]');
        target?.focus();
      });
      return;
    }
    setDayErrors({});
    try {
      await update.mutateAsync({
        // The exact JSON shape the database validates: {"sat":[["09:00","21:00"]],…,"fri":[]}
        working_hours: JSON.parse(serializeHours(result.hours)) as Json,
        ...notePatch,
      });
    } catch {
      return; // shown from update.error
    }
    const storedHours = draftFromHours(result.hours);
    setHours(storedHours);
    setSavedHours(storedHours);
    setSavedNotes(notes.values);
  }

  const hasDayErrors = Object.keys(dayErrors).length > 0;

  return (
    <SettingsFormCard
      title={t("settings.hoursTitle")}
      description={t("settings.hoursDescription")}
      readOnly={readOnly}
      dirty={dirty}
      saving={update.isPending}
      error={update.error}
      onSubmit={(event) => void notes.handleSubmit(save)(event)}
      onDiscard={onReset}
    >
      <div ref={editorRef} className="flex flex-col gap-3">
        <WorkingHoursEditor
          value={hours}
          onChange={changeHours}
          errors={dayErrors}
          readOnly={readOnly}
        />
        {!readOnly && (
          <p className="text-[0.8125rem] leading-relaxed text-slate-600">
            {t("settings.hoursMidnightHint")}
          </p>
        )}
        <div aria-live="assertive" className="empty:hidden">
          {hasDayErrors && <Alert tone="error">{t("settings.hoursInvalid")}</Alert>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("settings.hoursNoteArLabel")}
          optional
          error={notes.errors.noteAr && t(notes.errors.noteAr)}
        >
          <Textarea
            dir="rtl"
            lang="ar"
            rows={2}
            maxLength={300}
            placeholder={t("settings.hoursNotePlaceholderAr")}
            value={notes.values.noteAr}
            onChange={(event) => notes.setValue("noteAr", event.target.value)}
          />
        </Field>
        <Field
          label={t("settings.hoursNoteEnLabel")}
          optional
          error={notes.errors.noteEn && t(notes.errors.noteEn)}
        >
          <Textarea
            dir="ltr"
            lang="en"
            rows={2}
            maxLength={300}
            placeholder={t("settings.hoursNotePlaceholderEn")}
            value={notes.values.noteEn}
            onChange={(event) => notes.setValue("noteEn", event.target.value)}
          />
        </Field>
      </div>
    </SettingsFormCard>
  );
}
