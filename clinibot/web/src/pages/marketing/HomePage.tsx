import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Placeholder landing page: replace this file with the real marketing site. */
export default function HomePage() {
  const { t } = useI18n();
  useDocumentTitle(t("marketing.metaTitle"));
  return (
    <PublicLayout>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          {t("marketing.heroTitle")}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {t("marketing.heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink
            to="/register"
            size="lg"
            trailingIcon={<ArrowRight className="flip-rtl size-5" aria-hidden="true" />}
          >
            {t("marketing.ctaStart")}
          </ButtonLink>
          <ButtonLink to="/login" size="lg" variant="outline">
            {t("marketing.ctaSignIn")}
          </ButtonLink>
        </div>
      </section>
    </PublicLayout>
  );
}
