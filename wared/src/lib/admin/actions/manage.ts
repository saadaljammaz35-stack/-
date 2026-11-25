'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { staffFor } from '@/lib/admin/auth';
import { assignableRoles, type RoleKey } from '@/lib/admin/permissions';
import { revalidateContent } from '@/lib/admin/revalidate';
import { absoluteUrl } from '@/lib/env';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIpFrom } from '@/lib/security/request';
import { hashIp } from '@/lib/security/tokens';
import { getServiceClient } from '@/lib/supabase/admin';
import { getSessionClient } from '@/lib/supabase/server';
import { dbErrorMessage, inviteSchema, optText, settingsSchema, zodFieldErrors, type AdminResult } from '@/lib/validation/admin';

const DENIED: AdminResult = { ok: false, error: 'ليست لديك صلاحية لهذا الإجراء.' };

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200), next: z.string().max(300).optional() });

function safeNext(next: string | undefined): string {
  return next && /^\/admin(\/[a-z0-9/_-]*)?$/i.test(next) ? next : '/admin';
}

export async function signIn(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password'), next: formData.get('next') || undefined });
  if (!parsed.success) return { ok: false, error: 'أدخل البريد الإلكتروني وكلمة مرور صحيحة.' };
  const ip = hashIp(clientIpFrom(await headers()));
  const emailKey = parsed.data.email.toLowerCase();
  // Slow down password guessing per IP and per account.
  if (!(await rateLimit(`login:ip:${ip}`, 10, 900)) || !(await rateLimit(`login:email:${emailKey}`, 5, 900))) {
    return { ok: false, error: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.' };
  }
  const db = await getSessionClient();
  if (!db) return { ok: false, error: 'Supabase غير مهيأ. راجع ملف البيئة.' };
  const { data, error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { ok: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  await db.from('profiles').update({ last_sign_in_at: new Date().toISOString() }).eq('id', data.user.id);
  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const db = await getSessionClient();
  await db?.auth.signOut();
  redirect('/admin/login');
}

export async function requestPasswordReset(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const email = z.email().safeParse(formData.get('email'));
  if (!email.success) return { ok: false, error: 'أدخل بريدًا إلكترونيًا صحيحًا.' };
  const ip = hashIp(clientIpFrom(await headers()));
  if (!(await rateLimit(`reset:ip:${ip}`, 5, 3600))) return { ok: false, error: 'محاولات كثيرة. حاول لاحقًا.' };
  const db = await getSessionClient();
  if (!db) return { ok: false, error: 'Supabase غير مهيأ.' };
  await db.auth.resetPasswordForEmail(email.data, { redirectTo: absoluteUrl('/admin/auth/confirm?next=/admin/account') });
  // Same answer whether or not the account exists.
  return { ok: true, message: 'إذا كان البريد مسجلًا لدينا فستصلك رسالة لإعادة تعيين كلمة المرور.' };
}

export async function updateAccount(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const staff = await staffFor();
  const db = await getSessionClient();
  if (!staff || !db) return DENIED;
  const parsed = z
    .object({ full_name: z.string().trim().min(1).max(120), password: z.string().max(200).optional() })
    .safeParse({ full_name: formData.get('full_name'), password: formData.get('password') || undefined });
  if (!parsed.success) return { ok: false, error: 'تحقق من الحقول.' };
  const { error } = await db.from('profiles').update({ full_name: parsed.data.full_name }).eq('id', staff.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (parsed.data.password) {
    if (parsed.data.password.length < 12) return { ok: false, error: 'كلمة المرور يجب ألا تقل عن 12 حرفًا.' };
    const { error: pwError } = await db.auth.updateUser({ password: parsed.data.password });
    if (pwError) return { ok: false, error: 'تعذّر تحديث كلمة المرور.' };
  }
  return { ok: true, message: 'تم تحديث حسابك' };
}

// ---------------------------------------------------------------------------
// Inbox: contact messages and sponsorship requests
// ---------------------------------------------------------------------------

const INBOX_STATUSES = {
  contact_messages: ['new', 'in_progress', 'resolved', 'archived', 'spam'],
  sponsorship_requests: ['new', 'contacted', 'negotiating', 'won', 'lost', 'archived'],
} as const;

export async function updateInboxItem(table: keyof typeof INBOX_STATUSES, input: unknown): Promise<AdminResult> {
  const staff = await staffFor('inbox.manage');
  const db = await getSessionClient();
  if (!staff || !db || !(table in INBOX_STATUSES)) return DENIED;
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(INBOX_STATUSES[table] as unknown as [string, ...string[]]), internal_notes: optText(5000), assign_to_me: z.boolean().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'بيانات غير صالحة.' };
  const { id, assign_to_me, ...data } = parsed.data;
  const { error } = await db.from(table).update({ ...data, ...(assign_to_me ? { assigned_to: staff.id } : {}) }).eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, message: 'تم التحديث' };
}

export async function deleteInboxItem(table: keyof typeof INBOX_STATUSES, id: string): Promise<AdminResult> {
  const staff = await staffFor('inbox.manage');
  const db = await getSessionClient();
  if (!staff || !db || !(table in INBOX_STATUSES) || !z.uuid().safeParse(id).success) return DENIED;
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, message: 'تم الحذف', redirectTo: table === 'contact_messages' ? '/admin/messages' : '/admin/sponsorships' };
}

// ---------------------------------------------------------------------------
// Newsletter subscribers
// ---------------------------------------------------------------------------

export async function setSubscriberStatus(id: string, status: 'active' | 'unsubscribed'): Promise<AdminResult> {
  const staff = await staffFor('subscribers.manage');
  const db = await getSessionClient();
  if (!staff || !db || !z.uuid().safeParse(id).success || !['active', 'unsubscribed'].includes(status)) return DENIED;
  const { error } = await db
    .from('subscribers')
    .update(status === 'unsubscribed' ? { status, unsubscribed_at: new Date().toISOString() } : { status, confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, message: 'تم التحديث' };
}

export async function deleteSubscriber(id: string): Promise<AdminResult> {
  const staff = await staffFor('subscribers.manage');
  const db = await getSessionClient();
  if (!staff || !db || !z.uuid().safeParse(id).success) return DENIED;
  const { error } = await db.from('subscribers').delete().eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, message: 'تم حذف المشترك وبياناته' };
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

export async function inviteUser(input: unknown): Promise<AdminResult> {
  const staff = await staffFor('users.manage');
  if (!staff) return DENIED;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'راجع الحقول.', fieldErrors: zodFieldErrors(parsed.error) };
  if (!assignableRoles(staff.role).includes(parsed.data.role as RoleKey)) return { ok: false, error: 'لا يمكنك منح هذا الدور.' };
  const service = getServiceClient();
  if (!service) return { ok: false, error: 'مفتاح Supabase السري غير مهيأ، فلا يمكن إرسال الدعوات.' };
  const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: absoluteUrl('/admin/auth/confirm?next=/admin/account'),
  });
  if (error || !data.user) return { ok: false, error: error?.message?.includes('already') ? 'هذا البريد مسجل من قبل.' : 'تعذّر إرسال الدعوة.' };
  // Grant the role through the inviter's own session so the role guard and audit log apply to the inviter.
  const db = await getSessionClient();
  const { error: roleError } = await db!.from('profiles').update({ role: parsed.data.role, full_name: parsed.data.full_name }).eq('id', data.user.id);
  if (roleError) return { ok: false, error: dbErrorMessage(roleError) };
  return { ok: true, message: 'أُرسلت الدعوة بالبريد الإلكتروني' };
}

export async function updateUser(input: unknown): Promise<AdminResult> {
  const staff = await staffFor('users.manage');
  const db = await getSessionClient();
  if (!staff || !db) return DENIED;
  const parsed = z
    .object({ id: z.uuid(), role: z.enum(['owner', 'admin', 'editor', 'writer', 'none']), is_active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'بيانات غير صالحة.' };
  if (parsed.data.id === staff.id) return { ok: false, error: 'لا يمكنك تعديل دورك بنفسك.' };
  const role = parsed.data.role === 'none' ? null : parsed.data.role;
  if (role && !assignableRoles(staff.role).includes(role)) return { ok: false, error: 'لا يمكنك منح هذا الدور.' };
  const { data, error } = await db.from('profiles').update({ role, is_active: parsed.data.is_active }).eq('id', parsed.data.id).select('id');
  if (error) return { ok: false, error: error.message.includes('last active owner') ? 'لا يمكن إزالة آخر مالك.' : dbErrorMessage(error) };
  if (!data?.length) return DENIED;
  return { ok: true, message: 'تم تحديث المستخدم' };
}

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export async function saveSettings(input: unknown): Promise<AdminResult> {
  const staff = await staffFor('settings.manage');
  const db = await getSessionClient();
  if (!staff || !db) return DENIED;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'راجع الحقول المظللة.', fieldErrors: zodFieldErrors(parsed.error) };
  for (const [key, value] of Object.entries(parsed.data)) {
    const { error } = await db.from('site_settings').update({ value, updated_by: staff.id }).eq('key', key);
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }
  revalidateContent();
  return { ok: true, message: 'تم حفظ الإعدادات' };
}
