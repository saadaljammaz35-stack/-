import { EllipsisVertical, MessageSquarePlus, Phone, Siren, Trash2 } from "lucide-react";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { LogoMark } from "@/components/brand/Logo";
import { Menu, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { telHref } from "./model";
import type { ChatProfile } from "./types";

export interface ChatHeaderProps {
  /** null while loading or when the clinic was not found. */
  profile: ChatProfile | null;
  loading?: boolean;
  /** Shown only while a conversation is open. */
  onNewChat?: (() => void) | undefined;
  onDeleteChat?: (() => void) | undefined;
}

function PoweredBy() {
  const { tRich } = useI18n();
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
      <LogoMark size={14} title="" />
      <span>
        {tRich("chat.poweredBy", {
          brand: (
            <span lang="en" dir="ltr" className="font-bold text-slate-600">
              CliniBot
            </span>
          ),
        })}
      </span>
    </p>
  );
}

/** Clinic name, "powered by CliniBot", reception phone, language and chat options. */
export function ChatHeader({ profile, loading = false, onNewChat, onDeleteChat }: ChatHeaderProps) {
  const { t } = useI18n();
  const phone = profile?.reception_phone ?? null;
  const showMenu = Boolean(onNewChat && onDeleteChat);

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white pt-safe ps-safe pe-safe">
      <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        <div className="min-w-0 flex-1 py-2">
          {profile ? (
            <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
              {profile.name}
            </h1>
          ) : loading ? (
            <Skeleton className="h-5 w-40 max-w-full" />
          ) : (
            <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
              {t("chat.title")}
            </h1>
          )}
          <PoweredBy />
        </div>

        {phone && (
          <a
            href={telHref(phone)}
            aria-label={t("chat.callReceptionNumber", { phone })}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold text-primary hover:bg-navy-50 sm:px-3"
          >
            <Phone className="size-5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t("chat.callReception")}</span>
            <span dir="ltr" className="hidden lg:inline">
              {phone}
            </span>
          </a>
        )}

        <LanguageToggle compact className="shrink-0" />

        {showMenu && (
          <Menu
            align="end"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={t("chat.chatOptions")}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                <EllipsisVertical className="size-5" aria-hidden="true" />
              </button>
            )}
            items={[
              {
                key: "new",
                label: t("chat.newChat"),
                icon: <MessageSquarePlus className="size-5" aria-hidden="true" />,
                onSelect: () => onNewChat?.(),
              },
              {
                key: "delete",
                label: t("chat.deleteChat"),
                icon: <Trash2 className="size-5" aria-hidden="true" />,
                danger: true,
                onSelect: () => onDeleteChat?.(),
              },
            ]}
          />
        )}
      </div>
    </header>
  );
}

/** Always visible under the header: emergencies must not wait for a chat reply. */
export function EmergencyLine({ number }: { number: string }) {
  const { tRich } = useI18n();
  return (
    <a
      href={telHref(number)}
      className="block shrink-0 border-b border-red-100 bg-red-50 text-sm font-bold text-red-800 ps-safe pe-safe hover:bg-red-100"
    >
      <span className="flex min-h-11 items-center justify-center gap-2 px-4 py-1.5 text-center">
        <Siren className="size-4 shrink-0" aria-hidden="true" />
        <span>
          {tRich("chat.emergency", {
            number: (
              <span dir="ltr" className="underline underline-offset-2">
                {number}
              </span>
            ),
          })}
        </span>
      </span>
    </a>
  );
}
