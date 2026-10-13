import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Minus, Plus, Send } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { useI18n } from "@/i18n";
import { isApiError } from "@/lib/api";
import { errorReference, errorText } from "@/lib/errors";
import {
  REPLY_MAX,
  TEMPLATE_LANGUAGE_PATTERN,
  TEMPLATE_MAX_PARAMS,
  TEMPLATE_NAME_PATTERN,
  TEMPLATE_PARAM_MAX,
  type ConversationRow,
} from "./model";
import { useReply, type ReplyInput, type ReplyMessage } from "./queries";

type Outcome = { kind: "sent"; message: ReplyMessage } | { kind: "error"; error: unknown };

/** The result of the last send, announced politely and shown honestly. */
function OutcomeNotice({
  outcome,
  channel,
  onDismiss,
}: {
  outcome: Outcome;
  channel: ConversationRow["channel"];
  onDismiss: () => void;
}) {
  const { t, tRich } = useI18n();
  if (outcome.kind === "sent") {
    const { message } = outcome;
    if (message.status === "failed") {
      return (
        <Alert tone="error" title={t("conversations.replyFailedTitle")} onDismiss={onDismiss}>
          {message.error_code
            ? t("conversations.replyFailedCode", { code: message.error_code })
            : t("conversations.replyFailedNoCode")}
        </Alert>
      );
    }
    return (
      <Alert tone="success" onDismiss={onDismiss}>
        {channel === "whatsapp"
          ? t("conversations.replySentWhatsapp")
          : t("conversations.replySentWeb")}
      </Alert>
    );
  }

  const { error } = outcome;
  const code = isApiError(error) ? error.code : null;
  const reference = errorReference(error);
  let body: ReactNode = errorText(t, error);
  if (code === "whatsapp_not_connected") {
    body = tRich("conversations.replyNotConnected", {
      link: (
        <Link to="/app/whatsapp" className="font-bold underline">
          {t("conversations.whatsappPageLink")}
        </Link>
      ),
    });
  } else if (code === "customer_opted_out") {
    body = t("conversations.replyOptedOut");
  } else if (code === "outside_service_window") {
    body = t("conversations.replyOutsideWindow");
  }
  return (
    <Alert tone="error" title={t("conversations.replyErrorTitle")} onDismiss={onDismiss}>
      <p>{body}</p>
      {reference && (
        <p className="mt-1 text-xs opacity-80">
          {tRich("errors.reference", {
            id: (
              <span dir="ltr" className="font-mono select-all">
                {reference}
              </span>
            ),
          })}
        </p>
      )}
    </Alert>
  );
}

function PauseOption({
  conversation,
  checked,
  onChange,
}: {
  conversation: ConversationRow;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  if (conversation.ai_paused) {
    return <p className="text-[0.8125rem] text-slate-600">{t("conversations.pauseAlready")}</p>;
  }
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      label={t("conversations.pauseLabel")}
      description={t("conversations.pauseDescription")}
    />
  );
}

export function ReplyComposer({
  orgId,
  conversation,
  windowOpen,
}: {
  orgId: string;
  conversation: ConversationRow;
  /** WhatsApp only: inside the 24-hour customer service window. */
  windowOpen: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const reply = useReply(orgId, conversation.id);
  const [body, setBody] = useState("");
  const [pauseAi, setPauseAi] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // The server's clock decides: a 409 outside_service_window switches to templates even if ours disagrees.
  const [forceTemplate, setForceTemplate] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("ar");
  const [params, setParams] = useState<string[]>([]);
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({});
  const formId = useId();

  const templateMode = conversation.channel === "whatsapp" && (!windowOpen || forceTemplate);

  function send(input: ReplyInput, onSent: () => void) {
    setOutcome(null);
    reply.mutate(input, {
      onSuccess: (result) => {
        setOutcome({ kind: "sent", message: result.message });
        onSent();
      },
      onError: (error) => {
        if (isApiError(error) && error.code === "outside_service_window") setForceTemplate(true);
        setOutcome({ kind: "error", error });
      },
    });
  }

  function submitText(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text) {
      setBodyError(t("conversations.replyEmpty"));
      return;
    }
    if (text.length > REPLY_MAX) {
      setBodyError(t("conversations.replyTooLong", { max: formatNumber(REPLY_MAX) }));
      return;
    }
    setBodyError(null);
    send({ kind: "text", body: text, pauseAi: conversation.ai_paused || pauseAi }, () =>
      setBody(""),
    );
  }

  function submitTemplate(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const name = templateName.trim();
    const language = templateLanguage.trim();
    if (!TEMPLATE_NAME_PATTERN.test(name)) errors.name = t("conversations.templateNameInvalid");
    if (!TEMPLATE_LANGUAGE_PATTERN.test(language))
      errors.language = t("conversations.templateLanguageInvalid");
    const values = params.map((value) => value.trim());
    values.forEach((value, index) => {
      if (!value) errors[`p${index}`] = t("conversations.templateParamEmpty");
      else if (value.length > TEMPLATE_PARAM_MAX)
        errors[`p${index}`] = t("conversations.templateParamTooLong", {
          max: formatNumber(TEMPLATE_PARAM_MAX),
        });
    });
    setTemplateErrors(errors);
    if (Object.keys(errors).length > 0) return;
    send(
      {
        kind: "template",
        name,
        language,
        bodyParams: values,
        pauseAi: conversation.ai_paused || pauseAi,
      },
      () => setParams((current) => current.map(() => "")),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/⌘ + Enter sends; Enter alone is a new line (phones have no modifier keys).
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submitText();
    }
  }

  const notice = (
    <div aria-live="polite" aria-atomic="true">
      {outcome && (
        <OutcomeNotice
          outcome={outcome}
          channel={conversation.channel}
          onDismiss={() => setOutcome(null)}
        />
      )}
    </div>
  );

  if (templateMode) {
    return (
      <form
        onSubmit={submitTemplate}
        noValidate
        className="flex flex-col gap-4"
        aria-labelledby={`${formId}-title`}
      >
        <h3 id={`${formId}-title`} className="text-sm font-extrabold text-slate-900">
          {t("conversations.templateTitle")}
        </h3>
        <Alert tone="warning">{t("conversations.templateExplain")}</Alert>
        {notice}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Field
            label={t("conversations.templateName")}
            hint={t("conversations.templateNameHint")}
            error={templateErrors.name}
            required
          >
            <Input
              dir="ltr"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="appointment_follow_up"
            />
          </Field>
          <Field
            label={t("conversations.templateLanguage")}
            hint={t("conversations.templateLanguageHint")}
            error={templateErrors.language}
            required
          >
            <Input
              dir="ltr"
              value={templateLanguage}
              onChange={(event) => setTemplateLanguage(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold text-slate-800">
            {t("conversations.templateParams")}
          </legend>
          <p className="-mt-1 text-[0.8125rem] text-slate-600">
            {t("conversations.templateParamsHint")}
          </p>
          {params.map((value, index) => (
            <div key={index} className="flex items-end gap-2">
              <Field
                label={t("conversations.templateParam", { n: formatNumber(index + 1) })}
                error={templateErrors[`p${index}`]}
                className="min-w-0 flex-1"
              >
                <Input
                  value={value}
                  maxLength={TEMPLATE_PARAM_MAX}
                  onChange={(event) =>
                    setParams((current) =>
                      current.map((item, i) => (i === index ? event.target.value : item)),
                    )
                  }
                />
              </Field>
              <Button
                variant="ghost"
                className="size-11 px-0"
                aria-label={t("conversations.templateRemoveParam", {
                  n: formatNumber(index + 1),
                })}
                onClick={() => setParams((current) => current.filter((_, i) => i !== index))}
                icon={<Minus className="size-5" aria-hidden="true" />}
              />
            </div>
          ))}
          {params.length < TEMPLATE_MAX_PARAMS && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setParams((current) => [...current, ""])}
              icon={<Plus className="size-4" aria-hidden="true" />}
            >
              {t("conversations.templateAddParam")}
            </Button>
          )}
        </fieldset>
        <PauseOption conversation={conversation} checked={pauseAi} onChange={setPauseAi} />
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={reply.isPending}
            icon={<Send className="flip-rtl size-4" aria-hidden="true" />}
          >
            {reply.isPending ? t("conversations.sending") : t("conversations.sendTemplate")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitText} noValidate className="flex flex-col gap-3">
      {notice}
      <Field
        label={t("conversations.replyLabel")}
        error={bodyError}
        hint={
          conversation.channel === "web"
            ? t("conversations.replyHintWeb")
            : t("conversations.replyHintWhatsapp")
        }
      >
        <Textarea
          value={body}
          rows={3}
          maxLength={REPLY_MAX}
          onChange={(event) => {
            setBody(event.target.value);
            if (bodyError) setBodyError(null);
          }}
          onKeyDown={onKeyDown}
          dir="auto"
          placeholder={t("conversations.replyPlaceholder")}
        />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PauseOption conversation={conversation} checked={pauseAi} onChange={setPauseAi} />
        <Button
          type="submit"
          loading={reply.isPending}
          className="shrink-0 self-end sm:self-start"
          icon={<Send className="flip-rtl size-4" aria-hidden="true" />}
        >
          {reply.isPending ? t("conversations.sending") : t("conversations.send")}
        </Button>
      </div>
    </form>
  );
}
