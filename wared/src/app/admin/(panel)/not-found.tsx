import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="py-20">
      <h1 className="display text-4xl">العنصر غير موجود</h1>
      <p className="mt-4 text-muted">ربما حُذف، أو ليست لديك صلاحية الوصول إليه.</p>
      <Link href="/admin" className="btn btn-ghost mt-8">
        الرجوع للوحة التحكم
      </Link>
    </div>
  );
}
