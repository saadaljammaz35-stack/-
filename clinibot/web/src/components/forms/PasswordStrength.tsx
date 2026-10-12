import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/validation";

const LEVELS: ReadonlyArray<{ label: MessageKey; bar: string; text: string }> = [
  { label: "auth.strengthWeak", bar: "bg-red-500", text: "text-red-700" },
  { label: "auth.strengthFair", bar: "bg-amber-500", text: "text-amber-700" },
  { label: "auth.strengthGood", bar: "bg-emerald-500", text: "text-accent-strong" },
  { label: "auth.strengthStrong", bar: "bg-accent-strong", text: "text-accent-strong" },
];

/** A simple length-first strength hint under a new-password field. */
export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const { t } = useI18n();
  if (!password) return null;
  const score = passwordStrength(password);
  const level = LEVELS[score]!;
  return (
    <div id={id} className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {LEVELS.map((_, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full", index <= score ? level.bar : "bg-slate-200")}
          />
        ))}
      </div>
      <span className={cn("shrink-0 text-xs font-bold", level.text)}>
        {t("auth.passwordStrength", { level: t(level.label) })}
      </span>
    </div>
  );
}
