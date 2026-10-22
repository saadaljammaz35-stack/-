# CliniBot web app

React single-page app for CliniBot: marketing site (`/`), clinic dashboard
(`/app/*`), auth and onboarding, and the patient web chat (`/c/:slug`).
Arabic first (RTL), English second (LTR). Backend: Supabase (Auth, Postgres
with RLS, Edge Functions — see [`../docs/API.md`](../docs/API.md)).

## Run

```bash
cd clinibot/web
npm ci
cp .env.example .env.local   # public values for the real project
npm run dev                  # http://localhost:5173
```

| Script              | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Vite dev server                             |
| `npm run build`     | `tsc -b && vite build` → `dist/`            |
| `npm run preview`   | Serve `dist/` on http://localhost:4173      |
| `npm run typecheck` | `tsc -b` (strict, noUncheckedIndexedAccess) |
| `npm run lint`      | ESLint, zero warnings allowed               |
| `npm test`          | Vitest (jsdom), run once                    |
| `npm run format`    | Prettier                                    |

All four of typecheck, lint, test and build must pass before merging.

### Environment

| Variable                 | Value                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://<project-ref>.supabase.co`                              |
| `VITE_SUPABASE_ANON_KEY` | The anon / publishable key (public by design; RLS protects data) |

Everything in a `VITE_*` variable ships to every browser. **Never** put a
service-role key, AI key or any other secret here. When a variable is missing
or invalid the app renders a bilingual "not configured" screen instead of
crashing (`src/components/layout/NotConfigured.tsx`).

Supabase Auth → URL configuration must list `<site>/auth/callback`,
`<site>/reset-password` and `<site>/auth/accept-invite` as redirect URLs.

### Hosting

`vercel.json` (Vercel) and `public/_headers` + `public/_redirects`
(Netlify / Cloudflare Pages) provide the SPA fallback and security headers
(CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors
none). Keep the two header sets identical. If a page needs a new origin
(e.g. an image CDN), add it to the CSP in **both** files. The Tajawal font is
bundled (`@fontsource/tajawal`, imported in `main.tsx`), so `font-src` and
`style-src` are `'self'` only and no visitor request goes to a font CDN.

The CSP `connect-src` pins this app's own Supabase project origin
(`https://<project-ref>.supabase.co` and `wss://…`), not every
`*.supabase.co` project. When the project changes, update the origin in
**both** files (and `PROJECT_HOST` in `src/hosting.test.ts`); `vite build`
fails when `VITE_SUPABASE_URL` is not in both CSPs, and `npm test` fails when
the two CSPs differ. Styles need no `'unsafe-inline'`: keep inline `style="…"`
out of `index.html` (React `style` props are fine). This only narrows
fetch/XHR/WebSocket exfiltration; navigation can still carry data out.

## Structure

```
src/
  main.tsx, App.tsx      providers: I18n → ErrorBoundary → Router → Toast → React Query
  routes.tsx             the route table (every page lazy-loaded)
  env.ts                 reads/validates VITE_* variables
  auth/                  AuthProvider, useAuth, ProtectedRoute, GuestOnlyRoute, email-link handling
  org/                   OrgProvider, useOrg, RequireOrg, RequireRole, roles helpers
  i18n/                  I18nProvider, useI18n, formatters, messages/<namespace>.ts
  lib/
    supabase.ts          the single Supabase client (PKCE, persisted session)
    api.ts               callFunction() for Edge Functions → throws ApiError
    errors.ts            errorText(t, error): any error → translated message
    queryClient.ts       React Query defaults + queryKeys
    validation.ts        slug / phone / password rules shared with the DB constraints
    useForm.ts           tiny Zod-backed form state
    database.types.ts    generated Supabase types (regenerate after migrations)
  components/
    ui/                  the UI kit (below)
    brand/               Logo, LogoMark, LanguageToggle
    layout/              AppShell, AuthLayout, PublicLayout, StubPage, QueryError, …
  pages/
    marketing/           HomePage, PrivacyPage, TermsPage          (stubs)
    chat/                PatientChatPage                           (stub)
    auth/                Login, Register, Forgot/Reset password, AuthCallback, AcceptInvite
    onboarding/          OnboardingPage (create a clinic)
    app/                 <Section>Page.tsx for every dashboard section (stubs)
  test/                  setup + renderWithProviders()
```

## Routes

| Path                                                                                                                                                          | Page                | Access                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------ |
| `/`, `/privacy`, `/terms`                                                                                                                                     | marketing (stubs)   | public                         |
| `/c/:slug`                                                                                                                                                    | patient chat (stub) | public                         |
| `/login`, `/register`, `/forgot-password`                                                                                                                     | auth                | signed-out only                |
| `/reset-password`, `/auth/callback`, `/auth/accept-invite`                                                                                                    | email-link landings | public                         |
| `/onboarding`                                                                                                                                                 | create a clinic     | signed in                      |
| `/app`                                                                                                                                                        | Overview            | signed in + member of a clinic |
| `/app/conversations/*`, `/app/appointments/*`, `/app/knowledge/*`, `/app/assistant/*`, `/app/whatsapp/*`, `/app/staff/*`, `/app/billing/*`, `/app/settings/*` | sections (stubs)    | any member                     |
| `/app/audit/*`                                                                                                                                                | Audit log (stub)    | owner / admin                  |

Signed-in users with no clinic are sent to `/onboarding`.

## Conventions for later work

### Replacing a stub / adding a page

Dashboard sections already exist as `src/pages/app/<Name>Page.tsx` with a
**default export**: replace the file's contents, keep the default export.
Each section route ends in `/*`, so a page can own its sub-routes with a
relative `<Routes>`:

```tsx
// src/pages/app/ConversationsPage.tsx
import { Route, Routes } from "react-router";
export default function ConversationsPage() {
  return (
    <Routes>
      <Route index element={<ConversationList />} />
      <Route path=":id" element={<ConversationThread />} />
    </Routes>
  );
}
```

A brand-new top-level page: create the file with a default export, then add
one `lazy()` line and one `<Route>` in `src/routes.tsx` (and an entry in
`src/components/layout/nav.ts` if it belongs in the sidebar). Inside a page:

```tsx
const { t } = useI18n();
const { current: org, role } = useOrg();   // current clinic + your role
useDocumentTitle(t("staff.title"));
return <><PageHeader title={t("staff.title")} description={t("staff.description")} actions={…} />…</>;
```

Use `canManage(role)` / `<RequireRole roles={MANAGER_ROLES}>` from `src/org`
to hide owner/admin-only UI (the server enforces it regardless).

### Strings (i18n)

Every user-visible string comes from `src/i18n/messages/<namespace>.ts`:

```ts
export default {
  ar: { title: "الفريق", invited: "أُرسلت الدعوة إلى {email}" },
  en: { title: "Team", invited: "Invitation sent to {email}" },
} satisfies Namespace;
```

- Add each key to **both** `ar` and `en`. A missing or extra key is a type
  error (`KeyParity` in `catalog.ts`) and a test failure (`i18n.test.ts`).
- Use it as `t("staff.invited", { email })`. Keys are type-checked.
- Only edit your own section's namespace. Shared words (Save, Cancel, roles,
  nav) live in `common`; error texts in `errors`.
- A new namespace = a new file + one line in `src/i18n/messages/index.ts`.
- `tRich("auth.acceptTerms", { terms: <Link …/> })` for links inside text.
- `useI18n()` returns `{ t, tRich, lang, dir, setLang, formatNumber, formatDate, formatSar }`:
  `formatNumber(1234)` → `1,234` (Latin digits in both languages),
  `formatDate("2026-10-12")` → `12 أكتوبر 2026` / `12 Oct 2026` (Gregorian, Asia/Riyadh),
  `formatSar(299)` → `299 ر.س` / `SAR 299`.

### Data

- **Reads / simple edits:** `supabase.from(...)` / `supabase.rpc(...)`
  directly (RLS decides). Wrap in React Query and prefix keys with
  `queryKeys.org(org.id)` so switching clinics never mixes data:

  ```ts
  const query = useQuery({
    queryKey: [...queryKeys.org(org.id), "services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_services").select("*").eq("organization_id", org.id);
      if (error) throw error;
      return data;
    },
  });
  if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  ```

- **Edge Functions** (everything in docs/API.md):

  ```ts
  import { callFunction, isApiError } from "@/lib/api";
  import { errorText } from "@/lib/errors";

  try {
    const res = await callFunction<{ member_id: string; invited: boolean }>("invite-member", {
      organization_id: org.id,
      email,
      role: "receptionist",
      full_name: name,
    });
  } catch (error) {
    // ApiError { status, code, message, details, requestId }; code "network_error" when offline
    if (isApiError(error) && error.code === "seat_limit") {
      /* … */
    }
    setFormError(errorText(t, error)); // translated, both languages
  }
  ```

  Add new function names to `FunctionName` in `src/lib/api.ts`.

- **Errors:** always show `errorText(t, error)` (works for ApiError,
  Postgrest/RPC errors incl. hints `slug_taken`, `org_limit`, `last_owner`,
  `seat_limit`, `assistant_not_tested`, `confirm_mismatch`, Auth errors and
  network failures). Never show `error.message` from the server. New codes:
  add a key to `errors.ts` in both languages.
- Mutations show a toast on failure automatically; pass
  `meta: { silentError: true }` when the form shows the error inline, and
  `meta: { successMessage: "staff.invited" }` for a success toast.

### UI kit (`@/components/ui`)

`Button` (primary / secondary / outline / ghost / danger; sm / md / lg;
`loading`, `icon`, `trailingIcon`), `ButtonLink` (a router link styled as a
button), `Input`, `PasswordInput`, `Textarea`, `Select`, `Checkbox`, `Switch`,
`Field` (label, hint, error, required / optional marker; wires ids and aria
to its control), `Card` / `CardHeader` / `CardBody` / `CardFooter`, `Badge`
(neutral, info, success, warning, danger, brand), `Alert` (info, success,
warning, error), `Dialog`, `ConfirmDialog` (`confirmText` for typed
confirmation of destructive actions), `Sheet` (slide-over), `Menu`,
`Spinner`, `Skeleton` / `SkeletonText`, `EmptyState`, `ToastProvider` +
`useToast()`, `PageHeader`, `Tabs` / `TabList` / `TabPanel`, `StatTile`,
`DataList` (table on desktop, cards on phones). Brand: `Logo`
(`variant="mark" | "horizontal" | "inverse"`, `tagline`), `LogoMark`,
`LanguageToggle`.

### Styling rules

- Tailwind v4 tokens (`src/index.css`): `primary` (navy #0F4C81), `accent`
  (teal #10B981), `accent-strong` (teal for text), `mint`, `canvas`,
  `navy-50…950`; text in `slate`.
- **Logical utilities only** (`ms/me/ps/pe/start/end/text-start/border-s/rounded-s`).
  ESLint rejects `ml-`, `pr-`, `left-`, `text-right`, etc. Add `flip-rtl` to
  directional icons (arrows, chevrons).
- Phones / iPhone Safari: `min-h-dvh` (never `vh`), `pt-safe` / `pb-safe`
  for notches, controls ≥ 16px text (no zoom on focus), touch targets ≥ 44px
  (`min-h-11` / `size-11`), nothing that only works on hover.
- Accessibility: every control has a label (use `Field`), icons are
  `aria-hidden`, icon-only buttons get `aria-label`, dialogs come from the kit
  (focus trap, Escape, focus return).

### Tests

Put `*.test.ts(x)` next to the code. `renderWithProviders(ui, { route, lang, auth, org })`
from `src/test/render.tsx` renders with every provider and fake auth/org
values; mock `@/lib/supabase` or `@/lib/api` for network calls.
