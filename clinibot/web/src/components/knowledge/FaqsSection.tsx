import { useState } from "react";
import { ArrowDown, ArrowUp, MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Switch,
  useToast,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { FaqDialog } from "./FaqDialog";
import { IconButton } from "./IconButton";
import { faqDisplay, reorderUpdates, type FaqRow } from "./model";
import { useDeleteFaq, useFaqs, useReorderFaqs, useSetFaqActive } from "./queries";

type Editing = { faq: FaqRow | null } | null;

export function FaqsSection({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const faqs = useFaqs(orgId);
  const setActive = useSetFaqActive(orgId);
  const reorder = useReorderFaqs(orgId);
  const remove = useDeleteFaq(orgId);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<FaqRow | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const items = faqs.data ?? [];

  function move(index: number, delta: -1 | 1) {
    const faq = items[index];
    const updates = reorderUpdates(items, index, delta);
    if (!faq || updates.length === 0) return;
    reorder.mutate(updates, {
      onSuccess: () =>
        setAnnouncement(
          t(delta < 0 ? "knowledge.movedUp" : "knowledge.movedDown", {
            name: faqDisplay(faq, lang).question,
          }),
        ),
    });
  }

  const addButton = canEdit ? (
    <Button
      size="sm"
      icon={<Plus className="size-4" aria-hidden="true" />}
      onClick={() => setEditing({ faq: null })}
    >
      {t("knowledge.addFaq")}
    </Button>
  ) : null;

  return (
    <Card as="section" aria-labelledby="faqs-heading">
      <CardHeader
        title={<span id="faqs-heading">{t("knowledge.faqsTitle")}</span>}
        description={t("knowledge.faqsDescription")}
        actions={items.length > 0 ? addButton : null}
      />

      {faqs.isPending ? (
        <div className="flex flex-col gap-3 p-5" aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : faqs.error ? (
        <div className="p-5">
          <QueryError
            error={faqs.error}
            onRetry={() => void faqs.refetch()}
            retrying={faqs.isFetching}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={t("knowledge.faqsEmptyTitle")}
          text={canEdit ? t("knowledge.faqsEmptyText") : t("knowledge.faqsEmptyReadOnly")}
          action={addButton}
        />
      ) : (
        <ul className="divide-y divide-slate-100" aria-label={t("knowledge.faqsListLabel")}>
          {items.map((faq, index) => {
            const text = faqDisplay(faq, lang);
            const busy = setActive.isPending && setActive.variables?.id === faq.id;
            return (
              <li
                key={faq.id}
                className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-bold break-words text-slate-900" dir="auto">
                      {text.question}
                    </h3>
                    {!faq.is_active && <Badge tone="neutral">{t("knowledge.faqInactive")}</Badge>}
                  </div>
                  <p
                    className="mt-1 line-clamp-3 text-sm leading-relaxed break-words whitespace-pre-line text-slate-600"
                    dir="auto"
                  >
                    {text.answer}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {text.hasAr && <Badge tone="info">{t("knowledge.langArabic")}</Badge>}
                    {text.hasEn && <Badge tone="info">{t("knowledge.langEnglish")}</Badge>}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1 md:flex-nowrap">
                    <Switch
                      className="me-2"
                      checked={faq.is_active}
                      busy={busy}
                      onCheckedChange={(checked) =>
                        setActive.mutate({ id: faq.id, active: checked })
                      }
                      label={
                        <>
                          <span className="sr-only">{text.question}: </span>
                          {t("knowledge.activeShort")}
                        </>
                      }
                    />
                    <IconButton
                      label={t("knowledge.moveUp", { name: text.question })}
                      icon={<ArrowUp className="size-5" aria-hidden="true" />}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      label={t("knowledge.moveDown", { name: text.question })}
                      icon={<ArrowDown className="size-5" aria-hidden="true" />}
                      disabled={index === items.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    />
                    <IconButton
                      label={t("knowledge.editItem", { name: text.question })}
                      icon={<Pencil className="size-5" aria-hidden="true" />}
                      onClick={() => setEditing({ faq })}
                    />
                    <IconButton
                      tone="danger"
                      label={t("knowledge.deleteItem", { name: text.question })}
                      icon={<Trash2 className="size-5" aria-hidden="true" />}
                      onClick={() => {
                        remove.reset();
                        setDeleting(faq);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {editing && (
        <FaqDialog
          orgId={orgId}
          faq={editing.faq}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            toast.success(created ? t("knowledge.faqCreated") : t("knowledge.faqSaved"));
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("knowledge.deleteFaqTitle")}
        description={
          deleting
            ? t("knowledge.deleteFaqText", { name: faqDisplay(deleting, lang).question })
            : null
        }
        confirmLabel={t("common.delete")}
        error={remove.error ? errorText(t, remove.error) : undefined}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
            toast.success(t("knowledge.faqDeleted"));
          } catch {
            // Shown inside the dialog.
          }
        }}
      />
    </Card>
  );
}
