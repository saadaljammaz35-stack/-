import { redirect } from 'next/navigation';
import { confirmSubscription, unsubscribe } from '@/lib/actions/public';
import type { Dictionary } from '@/lib/i18n';
import { localePath, type Locale } from '@/lib/i18n/config';
import { PageHeader } from './blocks';

/**
 * Newsletter confirm/unsubscribe pages. The change happens on a button press (POST), never on page load, so
 * link scanners in email clients cannot confirm or cancel a subscription by prefetching the URL.
 */
export function TokenAction({ kind, locale, dict, token, status }: { kind: 'confirm' | 'unsubscribe'; locale: Locale; dict: Dictionary; token: string; status?: string }) {
  const path = localePath(locale, `/newsletter/${kind}`);
  async function act(formData: FormData) {
    'use server';
    const value = String(formData.get('token') ?? '');
    const ok = kind === 'confirm' ? await confirmSubscription(value) : await unsubscribe(value);
    redirect(`${path}?status=${ok ? 'done' : 'invalid'}`);
  }

  if (status === 'done') {
    return kind === 'confirm' ? (
      <PageHeader title={dict.newsletter.confirmedTitle} intro={dict.newsletter.confirmedBody} />
    ) : (
      <PageHeader title={dict.newsletter.unsubscribedTitle} intro={dict.newsletter.unsubscribedBody} />
    );
  }
  if (status === 'invalid' || token.length < 20) {
    return <PageHeader title={dict.newsletter.invalidLinkTitle} intro={dict.newsletter.invalidLinkBody} />;
  }
  return (
    <PageHeader title={kind === 'confirm' ? dict.newsletter.confirmPromptTitle : dict.newsletter.unsubscribePromptTitle}>
      <form action={act} className="mt-10">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-primary">
          {kind === 'confirm' ? dict.newsletter.confirmButton : dict.newsletter.unsubscribeButton}
        </button>
      </form>
    </PageHeader>
  );
}
