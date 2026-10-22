import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, CardHeader, Field, Skeleton, Textarea } from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { useNow } from "@/components/dashboard/hooks";
import {
  memberLabel,
  memberNameMap,
  type MemberLabel,
  type useOrgMembers,
} from "@/components/dashboard/members";
import { formatDateTime, formatRelativeTime } from "@/components/dashboard/time";
import { NOTE_MAX } from "./model";
import { useAddNote, useNotes } from "./queries";

function NoteAuthor({ label, loading }: { label: MemberLabel; loading: boolean }) {
  const { t } = useI18n();
  if (label.kind === "unknown" && loading) {
    return <Skeleton className="inline-block h-3 w-20 align-middle" />;
  }
  return (
    <span className="font-bold text-slate-700">
      {label.kind === "name"
        ? label.name
        : label.kind === "former"
          ? t("appointments.formerMember")
          : t("dashboard.nameUnavailable")}
    </span>
  );
}

/** Internal notes on a request (never shown to the patient). Anyone in the clinic can add one. */
export function NotesCard({
  orgId,
  requestId,
  members,
}: {
  orgId: string;
  requestId: string;
  /** The team list, for author names (the page shows its error once, with a retry). */
  members: Pick<ReturnType<typeof useOrgMembers>, "data" | "isPending">;
}) {
  const { t, lang, formatNumber } = useI18n();
  const now = useNow();
  const notes = useNotes(orgId, requestId);
  const add = useAddNote(orgId, requestId);
  const names = memberNameMap(members.data);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reject(form: HTMLFormElement, message: string) {
    setError(message);
    // From the Add button, focus moves to the note so its error is read out.
    requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      reject(event.currentTarget, t("appointments.noteEmpty"));
      return;
    }
    if (text.length > NOTE_MAX) {
      reject(event.currentTarget, t("appointments.noteTooLong", { max: formatNumber(NOTE_MAX) }));
      return;
    }
    setError(null);
    add.mutate(text, {
      onSuccess: () => setBody(""),
      onError: (failure) => setError(errorText(t, failure)),
    });
  }

  return (
    <Card as="section" aria-labelledby="notes-title">
      <CardHeader
        title={<span id="notes-title">{t("appointments.notesTitle")}</span>}
        description={t("appointments.notesDescription")}
      />
      <CardBody className="flex flex-col gap-5">
        {notes.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : notes.error ? (
          <QueryError error={notes.error} onRetry={() => void notes.refetch()} />
        ) : notes.data.length === 0 ? (
          <p className="text-sm text-slate-600">{t("appointments.notesEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {notes.data.map((note) => (
              <li key={note.id} className="rounded-xl bg-slate-50 px-3.5 py-3">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                  <NoteAuthor
                    label={note.author_id ? memberLabel(names, note.author_id) : { kind: "former" }}
                    loading={members.isPending}
                  />
                  <time dateTime={note.created_at} title={formatDateTime(lang, note.created_at)}>
                    {formatRelativeTime(lang, note.created_at, now)}
                  </time>
                </p>
                <p
                  className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-800"
                  dir="auto"
                >
                  {note.body}
                </p>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Field label={t("appointments.noteLabel")} error={error}>
            <Textarea
              rows={3}
              value={body}
              maxLength={NOTE_MAX}
              onChange={(event) => {
                setBody(event.target.value);
                if (error) setError(null);
              }}
              placeholder={t("appointments.notePlaceholder")}
              dir="auto"
            />
          </Field>
          <Button type="submit" variant="secondary" loading={add.isPending} className="self-end">
            {t("appointments.noteAdd")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
