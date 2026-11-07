"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      className="link"
      style={{ textDecoration: "none", padding: "8px 10px" }}
      onClick={async () => {
        await api("POST", "/api/auth/logout");
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}

export function LangSwitch({ to, label }: { to: "ar" | "en"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-sm btn-ghost"
      disabled={busy}
      lang={to}
      onClick={async () => {
        setBusy(true);
        await api("POST", "/api/locale", { locale: to });
        router.refresh();
        setBusy(false);
      }}
    >
      {label}
    </button>
  );
}
