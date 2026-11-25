import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Refreshes the Supabase session cookie and keeps signed-out visitors out of staff screens.
// Fine-grained permission checks happen in the server layouts, API routes and the database.
export async function proxy(request: NextRequest) {
  // A sign-in link that fell back to the Site URL (redirect URL not allow-listed yet) lands on "/".
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.search = `?code=${encodeURIComponent(request.nextUrl.searchParams.get('code')!)}&next=/admin`;
    return NextResponse.redirect(url);
  }
  // design preview: /?design=new shows the new storefront design, /?design=old goes back (per browser, remembered for a year)
  const design = request.nextUrl.searchParams.get('design');
  if (design === 'new' || design === 'old') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('design');
    const res = NextResponse.redirect(url);
    res.cookies.set('samat_design', design === 'new' ? 'studio' : 'classic', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const staffArea = (path.startsWith('/admin') && !path.startsWith('/admin/login') && !path.startsWith('/admin/setup')) || path.startsWith('/kitchen');
  if (staffArea && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|media/|brand/|icons/|favicon|manifest|sw.js|api/webhooks|api/hooks|api/cron|api/print-bridge).*)'],
};
