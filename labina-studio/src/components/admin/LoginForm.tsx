"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : error.status === 429
            ? "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً."
            : "تعذر تسجيل الدخول. حاول مرة أخرى.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" dir="ltr" className="text-right" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">كلمة المرور</Label>
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} dir="ltr" className="pl-12 text-right" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral-ink">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        دخول
      </Button>
    </form>
  );
}
