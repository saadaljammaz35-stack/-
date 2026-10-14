import { useId } from "react";
import { CircleAlert, Plus, X } from "lucide-react";
import { Button, Input, Switch } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  DAY_KEYS,
  DEFAULT_RANGE,
  MAX_RANGES,
  type DayError,
  type DayKey,
  type HoursDraft,
} from "./workingHours";

const DAY_LABELS: Record<DayKey, MessageKey> = {
  sat: "settings.day_sat",
  sun: "settings.day_sun",
  mon: "settings.day_mon",
  tue: "settings.day_tue",
  wed: "settings.day_wed",
  thu: "settings.day_thu",
  fri: "settings.day_fri",
};

const ERROR_LABELS: Record<DayError, MessageKey> = {
  noRanges: "settings.hoursError_noRanges",
  incomplete: "settings.hoursError_incomplete",
  closeBeforeOpen: "settings.hoursError_closeBeforeOpen",
  overlap: "settings.hoursError_overlap",
  tooMany: "settings.hoursError_tooMany",
};

interface WorkingHoursEditorProps {
  value: HoursDraft;
  onChange: (next: HoursDraft) => void;
  errors: Partial<Record<DayKey, DayError>>;
  readOnly: boolean;
}

/**
 * Saturday … Friday. Each day is closed or has up to three periods. The time
 * inputs are native (wheel pickers on phones).
 */
export function WorkingHoursEditor({ value, onChange, errors, readOnly }: WorkingHoursEditorProps) {
  const { t } = useI18n();
  const baseId = useId();

  function setDay(day: DayKey, next: HoursDraft[DayKey]) {
    onChange({ ...value, [day]: next });
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
      {DAY_KEYS.map((day) => {
        const draft = value[day];
        const dayName = t(DAY_LABELS[day]);
        const error = errors[day];
        const errorId = `${baseId}-${day}-error`;
        return (
          <li
            key={day}
            data-day={day}
            className={cn("flex flex-col gap-3 px-4 py-3", error && "bg-red-50/60")}
          >
            <Switch
              label={dayName}
              description={draft.isOpen ? t("settings.dayOpen") : t("settings.dayClosed")}
              checked={draft.isOpen}
              disabled={readOnly}
              onCheckedChange={(isOpen) =>
                setDay(day, {
                  isOpen,
                  ranges: isOpen && draft.ranges.length === 0 ? [{ ...DEFAULT_RANGE }] : draft.ranges,
                })
              }
            />
            {draft.isOpen && (
              <div className="flex flex-col gap-2">
                <ul className="flex flex-col gap-2">
                  {draft.ranges.map((range, index) => {
                    const n = index + 1;
                    const update = (patch: Partial<typeof range>) =>
                      setDay(day, {
                        ...draft,
                        ranges: draft.ranges.map((item, i) =>
                          i === index ? { ...item, ...patch } : item,
                        ),
                      });
                    return (
                      <li key={index} className="grid grid-cols-[1fr_1fr_2.75rem] items-end gap-2">
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600" aria-hidden="true">
                            {t("settings.rangeFrom")}
                          </span>
                          <Input
                            type="time"
                            dir="ltr"
                            step={300}
                            className="px-2 text-center"
                            value={range.open}
                            disabled={readOnly}
                            aria-label={t("settings.rangeFromLabel", { day: dayName, n })}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            onChange={(event) => update({ open: event.target.value })}
                          />
                        </label>
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600" aria-hidden="true">
                            {t("settings.rangeTo")}
                          </span>
                          <Input
                            type="time"
                            dir="ltr"
                            step={300}
                            className="px-2 text-center"
                            value={range.close}
                            disabled={readOnly}
                            aria-label={t("settings.rangeToLabel", { day: dayName, n })}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            onChange={(event) => update({ close: event.target.value })}
                          />
                        </label>
                        {draft.ranges.length > 1 && !readOnly ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDay(day, {
                                ...draft,
                                ranges: draft.ranges.filter((_, i) => i !== index),
                              })
                            }
                            className="inline-flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-red-700"
                            aria-label={t("settings.removeRange", { n, day: dayName })}
                          >
                            <X className="size-5" aria-hidden="true" />
                          </button>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {draft.ranges.length < MAX_RANGES && !readOnly && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Plus className="size-4" aria-hidden="true" />}
                      onClick={() =>
                        setDay(day, { ...draft, ranges: [...draft.ranges, { open: "", close: "" }] })
                      }
                    >
                      {t("settings.addRange")}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p
                id={errorId}
                className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-red-700"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t(ERROR_LABELS[error])}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
