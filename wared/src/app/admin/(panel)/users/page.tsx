import { EntityForm } from '@/components/admin/EntityForm';
import { UserControls } from '@/components/admin/UserRow';
import { AdminHeader, formatAdminDate } from '@/components/admin/ui';
import { inviteUser } from '@/lib/admin/actions/manage';
import { requireStaff } from '@/lib/admin/auth';
import { assignableRoles, ROLE_LABELS, ROLE_RANK, type RoleKey } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'المستخدمون والصلاحيات' };

const ROLE_HELP: Record<RoleKey, string> = {
  owner: 'كل الصلاحيات، بما فيها إدارة المالكين.',
  admin: 'كل شيء عدا منح دور المالك أو المدير.',
  editor: 'إنشاء وتعديل ونشر وجدولة كل المحتوى والوسائط، والإحصائيات.',
  writer: 'كتابة مسودات المقالات ورفع الصور، والنشر يتم عبر المحرر.',
};

export default async function UsersAdmin() {
  const staff = await requireStaff('users.manage');
  const rows = await listTable('profiles', 'id, email, full_name, role, is_active, last_sign_in_at, created_at', { order: 'created_at' });
  const roles = assignableRoles(staff.role).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  return (
    <>
      <AdminHeader title="المستخدمون والصلاحيات" description="الأدوار مطبّقة في قاعدة البيانات نفسها، لا في الواجهة فقط." />
      <dl className="mb-12 grid gap-4 md:grid-cols-4">
        {(Object.keys(ROLE_LABELS) as RoleKey[]).map((r) => (
          <div key={r} className="rounded-2xl border border-line p-4">
            <dt className="font-bold">{ROLE_LABELS[r]}</dt>
            <dd className="mt-1 text-sm leading-6 text-muted">{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => {
          const role = r.role as RoleKey | null;
          const editable = r.id !== staff.id && (staff.role === 'owner' || !role || ROLE_RANK[role] < ROLE_RANK[staff.role]);
          return (
            <li key={String(r.id)} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-medium">{String(r.full_name || r.email)}</p>
                <p className="text-sm text-muted">
                  <span dir="ltr">{String(r.email)}</span> · آخر دخول: {formatAdminDate(r.last_sign_in_at as string | null)}
                </p>
              </div>
              {editable ? (
                <UserControls id={String(r.id)} role={role} active={Boolean(r.is_active)} roles={roles} />
              ) : (
                <span className="text-sm text-muted">
                  {role ? ROLE_LABELS[role] : 'بدون صلاحية'}
                  {r.id === staff.id ? ' (أنت)' : ''}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <section className="mt-14 max-w-3xl">
        <h2 className="mb-2 text-lg font-bold">دعوة عضو جديد</h2>
        <p className="mb-6 text-sm text-muted">تصله رسالة من Supabase لتعيين كلمة المرور. يتطلب ذلك مفتاح Supabase السري وإعداد البريد في Supabase Auth.</p>
        <EntityForm
          schema="invite"
          action={inviteUser}
          resetOnSuccess
          submitLabel="إرسال الدعوة"
          defaultValues={{ email: '', full_name: '', role: roles[roles.length - 1]?.value ?? 'writer' }}
          fields={[
            { type: 'text', name: 'full_name', label: 'الاسم' },
            { type: 'email', name: 'email', label: 'البريد الإلكتروني' },
            { type: 'select', name: 'role', label: 'الدور', options: roles },
          ]}
        />
      </section>
    </>
  );
}
