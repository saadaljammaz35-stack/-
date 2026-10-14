import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
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
import { IconButton } from "./IconButton";
import { formatServicePrice, localizedPair, reorderUpdates, type ServiceRow } from "./model";
import { useDeleteService, useReorderServices, useServices, useSetServiceActive } from "./queries";
import { ServiceDialog } from "./ServiceDialog";

type Editing = { service: ServiceRow | null } | null;

export function ServicesSection({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { t, lang, formatSar, formatNumber } = useI18n();
  const toast = useToast();
  const services = useServices(orgId);
  const setActive = useSetServiceActive(orgId);
  const reorder = useReorderServices(orgId);
  const remove = useDeleteService(orgId);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const items = services.data ?? [];
  const nameOf = (service: ServiceRow) =>
    localizedPair(service.name_ar, service.name_en, lang).primary;

  function move(index: number, delta: -1 | 1) {
    const service = items[index];
    const updates = reorderUpdates(items, index, delta);
    if (!service || updates.length === 0) return;
    reorder.mutate(updates, {
      onSuccess: () =>
        setAnnouncement(
          t(delta < 0 ? "knowledge.movedUp" : "knowledge.movedDown", { name: nameOf(service) }),
        ),
    });
  }

  const addButton = canEdit ? (
    <Button
      size="sm"
      icon={<Plus className="size-4" aria-hidden="true" />}
      onClick={() => setEditing({ service: null })}
    >
      {t("knowledge.addService")}
    </Button>
  ) : null;

  return (
    <Card as="section" aria-labelledby="services-heading">
      <CardHeader
        title={<span id="services-heading">{t("knowledge.servicesTitle")}</span>}
        description={t("knowledge.servicesDescription")}
        actions={items.length > 0 ? addButton : null}
      />

      {services.isPending ? (
        <div className="flex flex-col gap-3 p-5" aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : services.error ? (
        <div className="p-5">
          <QueryError
            error={services.error}
            onRetry={() => void services.refetch()}
            retrying={services.isFetching}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t("knowledge.servicesEmptyTitle")}
          text={canEdit ? t("knowledge.servicesEmptyText") : t("knowledge.servicesEmptyReadOnly")}
          action={addButton}
        />
      ) : (
        <ul className="divide-y divide-slate-100" aria-label={t("knowledge.servicesListLabel")}>
          {items.map((service, index) => {
            const name = localizedPair(service.name_ar, service.name_en, lang);
            const busy = setActive.isPending && setActive.variables?.id === service.id;
            return (
              <li
                key={service.id}
                className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-bold break-words text-slate-900">{name.primary}</h3>
                    {!service.is_active && (
                      <Badge tone="neutral">{t("knowledge.serviceInactive")}</Badge>
                    )}
                  </div>
                  {name.secondary && (
                    <p className="text-sm break-words text-slate-500" dir="auto">
                      {name.secondary}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                    <span className="font-bold text-slate-900">
                      {formatServicePrice(service, { t, formatSar })}
                    </span>
                    {service.duration_minutes !== null && (
                      <span>
                        {t("knowledge.durationMinutes", {
                          minutes: formatNumber(service.duration_minutes),
                        })}
                      </span>
                    )}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1 md:flex-nowrap">
                    <Switch
                      className="me-2"
                      checked={service.is_active}
                      busy={busy}
                      onCheckedChange={(checked) =>
                        setActive.mutate({ id: service.id, active: checked })
                      }
                      label={
                        <>
                          <span className="sr-only">{name.primary}: </span>
                          {t("knowledge.activeShort")}
                        </>
                      }
                    />
                    <IconButton
                      label={t("knowledge.moveUp", { name: name.primary })}
                      icon={<ArrowUp className="size-5" aria-hidden="true" />}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      label={t("knowledge.moveDown", { name: name.primary })}
                      icon={<ArrowDown className="size-5" aria-hidden="true" />}
                      disabled={index === items.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    />
                    <IconButton
                      label={t("knowledge.editItem", { name: name.primary })}
                      icon={<Pencil className="size-5" aria-hidden="true" />}
                      onClick={() => setEditing({ service })}
                    />
                    <IconButton
                      tone="danger"
                      label={t("knowledge.deleteItem", { name: name.primary })}
                      icon={<Trash2 className="size-5" aria-hidden="true" />}
                      onClick={() => {
                        remove.reset();
                        setDeleting(service);
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
        <ServiceDialog
          orgId={orgId}
          service={editing.service}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            toast.success(created ? t("knowledge.serviceCreated") : t("knowledge.serviceSaved"));
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("knowledge.deleteServiceTitle")}
        description={deleting ? t("knowledge.deleteServiceText", { name: nameOf(deleting) }) : null}
        confirmLabel={t("common.delete")}
        error={remove.error ? errorText(t, remove.error) : undefined}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
            toast.success(t("knowledge.serviceDeleted"));
          } catch {
            // Shown inside the dialog.
          }
        }}
      >
        <p className="text-sm leading-relaxed text-slate-600">{t("knowledge.deleteServiceTip")}</p>
      </ConfirmDialog>
    </Card>
  );
}
