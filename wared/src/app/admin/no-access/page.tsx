import { signOut } from '@/lib/admin/actions/manage';

export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md">
        <h1 className="display mb-4 text-3xl">لا تملك صلاحية الوصول</h1>
        <p className="mb-8 leading-8 text-muted">حسابك مسجّل لكن لم يُمنح دورًا في فريق وارد بعد، أو تم إيقافه. تواصل مع المالك أو المدير.</p>
        <form action={signOut}>
          <button type="submit" className="btn btn-ghost">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
