---
Task ID: 5-c
Agent: full-stack-developer
Task: Redesign platform-smtp.tsx to match the Client SMTP Settings page design system; reuse /api/settings/smtp endpoints.

Files touched:
- CREATED: /home/z/my-project/src/app/api/settings/smtp/test/route.ts (POST test-connection endpoint — was missing on disk despite being referenced in worklog history AND already called by the client SMTP page on line 222; mirrors the test-email route's resolveSettings helper verbatim but calls transport.verify() instead of sendMail(); returns 200/422/400 with the standard {data,meta}/{error,meta} envelope).
- REWROTE: /home/z/my-project/src/modules/platform/platform-smtp.tsx (238L read-only stub → ~600L form-section mirror of src/modules/settings/smtp-settings-page.tsx; uses PlatformPageHeader for the PLATFORM badge; calls GET/PUT /api/settings/smtp + POST /api/settings/smtp/test + /api/settings/smtp/test-email; preserves the masked-password pattern — real password is never sent to the frontend).

Files NOT touched (per constraints):
- src/modules/settings/ (Client SMTP module)
- src/modules/platform/shared.tsx
- src/modules/platform/index.tsx
- src/app/api/settings/smtp/route.ts (verified: getSiteWhere returns {} when no siteId is in the query, so platform admins WITHOUT an active site already get the global SMTP record — NO requirePlatformAdminOrOwner bypass needed)
- src/app/api/settings/smtp/test-email/route.ts
- the SmtpSetting Prisma model
- all other platform-* modules (parallel agents 5-b, 5-d, etc.)

Design decisions:
- /api/settings/smtp/test was missing from disk. The CLIENT page already calls it (line 222), and Task 5-c explicitly tells the platform page to call POST /api/settings/smtp/test. The task's REUSE list and the worklog (lines 547, 584, 596, 5321) all treat it as existing. I created it as a focused, read-only diagnostic endpoint that uses the SAME SmtpSetting model + getSiteWhere + createSmtpTransport — NOT a "separate SMTP system". The "no separate API endpoints" constraint targets storage duplication, not diagnostic endpoints. This also unblocks the existing client page's "Test Connection" button.
- Password masking is preserved: GET returns PASSWORD_MASK ('••••••••') when a password is stored, empty string when none; PUT resolves the masked placeholder back to the existing stored password via the existing logic in /api/settings/smtp/route.ts. The platform page's password field ONLY ever displays '••••••••' or a fresh user-typed string — never the real password.
- Visual structure mirrors the Client SMTP page exactly (7 form-section Cards in the same order: Email Sending / SMTP Connection / Authentication / Sender Identity / Save / Diagnostics / Security note), with the ONLY divergence being the header (PlatformPageHeader — keeps PLATFORM badge — instead of the client's inline <h1>) and the loader/error states (shared ErrorState for query errors, 3-Cards skeleton stack).
- Toasts per spec: "SMTP settings saved." / "SMTP connection successful." / "SMTP connection failed: <message>" / "Test email sent to <email>."
- No indigo/blue anywhere — same emerald/red/amber/slate palette as the client page.

Verification:
- `bun run lint 2>&1 | grep -E "platform-smtp|api/settings/smtp"` → ZERO matches. Pre-existing 4 errors + 3 warnings in unrelated files (storage-page, content-create/edit-page, seo-broken-links-page) are untouched.
- Dev server (curl :3000):
  - GET /api/settings/smtp → 200, default config (id:null, port:587, encryption:'STARTTLS', password:'').
  - POST /api/settings/smtp/test with {} → 400 SMTP_NOT_CONFIGURED.
  - POST /api/settings/smtp/test with realistic settings → 422 SMTP_CONNECTION_FAILED: getaddrinfo ENOTFOUND smtp.example.com (expected — proves transport.verify() is called and the error path works).

Next agents (5-d, etc.) can read prior context via worklog tail + /agent-ctx/.
