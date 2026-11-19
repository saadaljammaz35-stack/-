import { currentUser } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { getLocale } from '@/lib/i18n/server';

/** Creates the customer profile + loyalty account after the first phone sign-in. */
export async function POST() {
  const user = await currentUser();
  if (!user?.phone) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const phone = `+${user.phone.replace(/^\+/, '')}`;
  const db = adminDb();
  await db.from('profiles').upsert({ id: user.id, phone, locale: await getLocale() }, { onConflict: 'id', ignoreDuplicates: true });
  await db.from('loyalty_accounts').upsert({ customer_id: user.id }, { onConflict: 'customer_id', ignoreDuplicates: true });
  return Response.json({ ok: true });
}
