import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { Menu, Spinner, useToast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { errorText } from "@/lib/errors";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}

export function UserMenu({ placement = "bottom", showName = false }: { placement?: "top" | "bottom"; showName?: boolean }) {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;

  const fullName =
    typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const email = user.email ?? "";
  const display = fullName || email;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      void navigate("/login", { replace: true });
    } catch (error) {
      toast.error(errorText(t, error));
      setSigningOut(false);
    }
  }

  return (
    <Menu
      align={showName ? "start" : "end"}
      placement={placement}
      className={cn(showName && "min-w-0 flex-1")}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={t("common.accountMenu")}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-xl text-start hover:bg-slate-100",
            showName ? "w-full px-2" : "w-11 justify-center",
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
            aria-hidden="true"
          >
            {signingOut ? <Spinner size="sm" /> : initials(display)}
          </span>
          {showName && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold text-slate-900">{fullName || t("common.account")}</span>
              <span dir="ltr" className="truncate text-start text-xs text-slate-500">
                {email}
              </span>
            </span>
          )}
        </button>
      )}
      header={
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{t("common.signedInAs")}</p>
          {fullName && <p className="truncate text-sm font-bold text-slate-900">{fullName}</p>}
          <p dir="ltr" className="truncate text-start text-sm text-slate-700">
            {email}
          </p>
        </div>
      }
      items={[
        {
          key: "sign-out",
          label: signingOut ? t("common.signingOut") : t("common.signOut"),
          icon: <LogOut className="flip-rtl size-5" aria-hidden="true" />,
          disabled: signingOut,
          onSelect: () => void handleSignOut(),
        },
      ]}
    />
  );
}
