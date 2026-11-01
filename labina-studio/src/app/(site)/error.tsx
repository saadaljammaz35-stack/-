"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-16 items-end justify-center gap-1.5" aria-hidden>
          <span className="h-8 w-5 rotate-12 rounded-md bg-coral" />
          <span className="h-14 w-5 -rotate-6 rounded-md bg-sun" />
          <span className="h-10 w-5 rotate-[20deg] rounded-md bg-teal" />
        </div>
        <h1 className="mt-8 text-3xl font-bold text-plum">تعثّرنا قليلاً</h1>
        <p className="mt-3 leading-8 text-ink-soft">حدث خطأ غير متوقع أثناء تحميل الصفحة. جرّب مرة أخرى، وإن تكرر الخطأ تواصل معنا.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>إعادة المحاولة</Button>
          <ButtonLink href="/" variant="outline">الرئيسية</ButtonLink>
        </div>
      </div>
    </div>
  );
}
