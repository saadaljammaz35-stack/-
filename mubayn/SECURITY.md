# MUBAYN security notes

## Assets

Customer evidence (photos/videos of their devices, possibly with incidental
personal data), reports, account credentials, the Anthropic API key (direct
cost exposure), and the admin console.

## Controls in place (implemented and covered by tests unless marked)

| Area | Control | Test |
|---|---|---|
| Passwords | scrypt N=32768 r=8 p=1, per-password salt, NFKC normalisation, min 10 chars | unit |
| Sessions | 32-byte random token, SHA-256 at rest, HttpOnly/Secure/SameSite=Lax, 30-day expiry, revoked on logout, password reset, password change, account disable | e2e |
| Brute force | per-IP and per-e-mail rate limits (PostgreSQL), account lock after 8 failures for 15 min | e2e |
| Enumeration | register and forgot-password answer identically for known/unknown e-mails; owner gets an "account exists" e-mail | e2e |
| CSRF | Origin / Sec-Fetch-Site check on every non-GET API call; SameSite cookies | e2e |
| Native form fallback | every form is `method="post"` and submit stays disabled until hydration, so fields never reach a URL | browser |
| Authorisation | all customer reads filter by `user_id`; foreign ids return 404 | e2e (two accounts, 12 routes) |
| Admin | role only via CLI; TOTP enrolment required; session must pass TOTP; 60-min idle limit; non-admins get 404 on pages, 403 on APIs; every view of customer data audited | e2e |
| Uploads | presigned PUT with signed content-type and content-length; server re-reads the object, sniffs type from bytes, decodes it, rejects mismatches, HEIC, duplicates, tiny images; video length via ffmpeg | e2e |
| Storage | private bucket; 5-minute presigned GET after ownership check; account deletion removes the user's whole prefix | e2e (S3 emulator) |
| Output | React escaping; PDF template escapes every model and user string; the only `dangerouslySetInnerHTML` is the server-generated QR SVG | review |
| Prompt injection | system prompt treats image text and seller claims as data; output constrained to a JSON schema; citations validated against what was sent | unit |
| Headers | CSP with per-request nonce and strict-dynamic, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | e2e |
| Config | production refuses local storage, console e-mail, AI/base-URL overrides, http APP_URL | unit |
| Secrets | none in code; `.env*` ignored by git; MFA secrets AES-256-GCM encrypted | unit |
| Cron | bearer secret compared in constant time | e2e |

## Known gaps / accepted risks

1. **TOTP replay within the 90-second window** is not blocked (no last-used-step store).
2. **No malware scanning** of uploads. Files are only ever decoded by sharp/ffmpeg
   on the server and served from the bucket origin, never from the app origin.
3. **Rate limits depend on `TRUST_PROXY=true`** behind Vercel. Without it every
   visitor shares one bucket (sign-ups would stop after 10/hour). Shown in the
   admin readiness list.
4. **ffmpeg parses untrusted video.** Mitigation: size cap 100 MB, 60-second
   timeout per call, runs in an isolated serverless sandbox. Keep `ffmpeg-static`
   updated.
5. **No independent penetration test** has been done. Do one before scaling.
6. **Admin can read customer evidence** (needed for support and quality review).
   Every access is logged; the privacy policy says so.
7. **Dependency updates**: run `npm audit` and update monthly; Dependabot is not configured.

## Reporting

Security issues: the support e-mail configured in `SUPPORT_EMAIL`.
