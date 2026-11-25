import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/PublicForms';
import { PageHeader } from '@/components/site/blocks';
import { getSiteSettings } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/contact', title: dict.pages.contact.title, description: dict.pages.contact.lead });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const settings = await getSiteSettings();
  const email = settings.general.contact_email;
  return (
    <>
      <PageHeader title={dict.pages.contact.title} intro={dict.pages.contact.lead}>
        {email && (
          <p className="mt-6 text-lg">
            <a href={`mailto:${email}`} className="link-underline" dir="ltr">
              {email}
            </a>
          </p>
        )}
      </PageHeader>
      <div className="container-page">
        <div className="border-t border-line pt-10">
          <ContactForm />
        </div>
      </div>
    </>
  );
}
