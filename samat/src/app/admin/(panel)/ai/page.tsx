import { requireStaffPage } from '@/lib/auth/staff';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { env } from '@/lib/env';
import { PageHeader } from '@/components/admin/ui';
import { AiChat } from '@/components/admin/AiChat';

export default async function AiPage() {
  await requireStaffPage('ai.use', '/admin/ai');
  const a = adminDicts[await getLocale()];
  return (
    <div>
      <PageHeader title={a.ai.title} subtitle={a.ai.subtitle} />
      <AiChat configured={Boolean(env.anthropicApiKey)} />
    </div>
  );
}
