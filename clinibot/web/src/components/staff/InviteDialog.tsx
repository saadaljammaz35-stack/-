import { useId, useRef, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { Link } from "react-router";
import { z } from "zod";
import { Alert, Button, Dialog, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useForm } from "@/lib/useForm";
import type { MemberRole } from "@/org/context";
import { ROLE_LABELS } from "@/org/roles";
import { cn } from "@/lib/cn";
import { ErrorDetails } from "./ErrorDetails";
import { useInviteMember, type InviteResult } from "./queries";
import { ROLE_HINTS } from "./roleText";

const inviteSchema = z.object({
  fullName: z.string().trim().max(120, "staff.nameTooLong"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "staff.emailRequired")
    .max(254, "staff.emailInvalid")
    .pipe(z.email("staff.emailInvalid")),
  role: z.enum(["admin", "receptionist"]),
});

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  /** Roles the caller may give (owner → admin/receptionist, admin → receptionist). */
  roles: MemberRole[];
  onInvited: (result: InviteResult & { email: string }) => void;
}

export function InviteDialog(props: InviteDialogProps) {
  // Remount on every open so the form starts empty.
  if (!props.open) return null;
  return <InviteForm {...props} />;
}

function InviteForm({ open, onClose, orgId, roles, onInvited }: InviteDialogProps) {
  const { t } = useI18n();
  const invite = useInviteMember(orgId);
  const formId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const allowed = roles.filter((role): role is "admin" | "receptionist" => role !== "owner");
  const form = useForm(inviteSchema, {
    fullName: "",
    email: "",
    role: allowed.includes("receptionist") ? "receptionist" : (allowed[0] ?? "receptionist"),
  });
  const [failure, setFailure] = useState<
    { kind: "seat_limit" } | { kind: "other"; error: unknown } | null
  >(null);

  async function save(data: z.output<typeof inviteSchema>) {
    setFailure(null);
    try {
      const result = await invite.mutateAsync({
        email: data.email,
        role: data.role,
        fullName: data.fullName,
      });
      onInvited({ ...result, email: data.email });
      onClose();
    } catch (error) {
      const { code } = describeError(error);
      if (code === "already_member") {
        form.setFieldError("email", "errors.already_member");
        emailRef.current?.focus();
      } else if (code === "seat_limit") {
        setFailure({ kind: "seat_limit" });
      } else {
        setFailure({ kind: "other", error });
      }
    }
  }

  let failureView: ReactNode = null;
  if (failure?.kind === "seat_limit") {
    failureView = (
      <Alert
        tone="warning"
        title={t("staff.seatLimitTitle")}
        action={
          <Link
            to="/app/billing"
            className="font-bold underline underline-offset-2 hover:no-underline"
            onClick={onClose}
          >
            {t("staff.viewPlans")}
          </Link>
        }
      >
        {t("errors.seat_limit")}
      </Alert>
    );
  } else if (failure?.kind === "other") {
    failureView = <ErrorDetails error={failure.error} />;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("staff.inviteTitle")}
      description={t("staff.inviteDescription")}
      dismissible={!invite.isPending}
      initialFocusRef={emailRef}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={invite.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={invite.isPending}
            icon={<Send className="flip-rtl size-4" aria-hidden="true" />}
          >
            {t("staff.sendInvite")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => void form.handleSubmit(save)(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field
          label={t("staff.emailLabel")}
          required
          error={form.errors.email && t(form.errors.email)}
        >
          <Input
            ref={emailRef}
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            placeholder="name@clinic.sa"
            value={form.values.email}
            onChange={(event) => form.setValue("email", event.target.value)}
          />
        </Field>
        <Field
          label={t("staff.nameLabel")}
          optional
          hint={t("staff.nameHint")}
          error={form.errors.fullName && t(form.errors.fullName)}
        >
          <Input
            autoComplete="off"
            maxLength={120}
            value={form.values.fullName}
            onChange={(event) => form.setValue("fullName", event.target.value)}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-bold text-slate-800">
            {t("staff.roleLabel")}
          </legend>
          {allowed.map((role) => (
            <label
              key={role}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                form.values.role === role
                  ? "border-primary bg-primary-soft"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name={`${formId}-role`}
                value={role}
                checked={form.values.role === role}
                onChange={() => form.setValue("role", role)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-slate-900">{t(ROLE_LABELS[role])}</span>
                <span className="text-[0.8125rem] leading-relaxed text-slate-600">
                  {t(ROLE_HINTS[role])}
                </span>
              </span>
            </label>
          ))}
          {roles.length === 1 && roles[0] === "receptionist" && (
            <p className="text-[0.8125rem] text-slate-600">{t("staff.inviteAdminLimit")}</p>
          )}
        </fieldset>
        <div aria-live="polite">{failureView}</div>
      </form>
    </Dialog>
  );
}
