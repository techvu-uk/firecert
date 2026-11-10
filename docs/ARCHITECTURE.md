# Architecture

## Layout

```
src/
  app/                    Next.js routes (pages + API)
    (auth)/               login, forgot password, set password (invites & resets)
    (staff)/              engineer + admin area: dashboard, schedule, certificates, customers, sites, staff, settings
    portal/               customer portal
    api/                  PDF download, draft autosave, photo upload/serve, cron reminders, health check
    actions/              server actions (form submissions), always permission-checked
  components/             UI kit (ui.tsx, form.tsx), app shell, certificate editor
  forms/                  FORM ENGINE: types, registry, validation, formatting, definitions/
  db/                     Drizzle schema + connection
  server/                 server-only logic
    services/             certificates (draft → issue → void), scheduling, reminders, company
    notify/               email / SMS / WhatsApp channels + message templates
    pdf/                  generic PDF renderer
    auth.ts               sessions, roles, invites, password rules
    storage.ts            file storage (local disk; swap for S3/Azure)
    schedule-rules.ts     pure scheduling rules (tested)
  lib/                    dates (UK time zone), env, utilities
drizzle/                  SQL migrations (generated, committed)
scripts/                  migrate, seed, reminders
tests/                    unit tests + e2e walkthrough
```

## Key design decisions

**Forms are data, not screens.** One `FormDefinition` drives the UI, the validation and the PDF (see ADDING-FORMS.md). Each certificate stores `formId` and `formVersion`, so old certificates always render with the definition they were created with.

**The same validation runs in two places.** `forms/validate.ts` runs in the browser for instant feedback and on the server for every save and issue. Draft mode allows part-complete work. Issue mode enforces required fields, requires notes on failed checks, and strips hidden fields so the issued record is exact.

**Issuing is atomic.** In one database transaction, the app:

1. locks the certificate
2. validates it
3. assigns the next sequential number (per year, e.g. `TV-2026-000123`)
4. updates the service schedule
5. generates and stores the PDF
6. writes an audit entry

If any step fails, nothing is issued. The customer email is sent afterwards, so an email outage can't block issuing. A SHA-256 checksum of the PDF is stored for evidence.

**Issued certificates are immutable.** Corrections are made by voiding (with a reason) and reissuing as a new draft linked to the original. Voided certificates stay on record, watermarked VOID, and are hidden from customers.

**Scheduling.** Each active site has at most one open service visit, enforced by a partial unique index. Issuing an inspection (routine visit) or commissioning certificate closes it and creates the next one at visit date + the site's interval. Follow-up visits and remedial reports don't move the schedule. A late-issued older certificate never moves the schedule backwards.

**Reminders can't double-send.** Each message has a dedupe key (visit + reminder type + channel + recipient) that is claimed in the database *before* sending. Failed sends are retried on the next run. Only the single most relevant reminder is sent, so a missed run doesn't cause a burst of messages.

**Security.**

- Sessions are signed, httpOnly cookies.
- Passwords are hashed with bcrypt, and logins are rate-limited.
- Invite and reset links are single-use, time-limited, and stored only as hashes.
- Every page, action and API route checks the user's role on the server. Middleware is only a first filter.
- Customers can only reach issued certificates for their own sites.
- Uploads are checked by file signature, size-limited and stored outside the web root.
- Every important action is written to `audit_logs`.

**Offline tolerance.** The editor autosaves every couple of seconds and also keeps a copy in the phone's local storage. If signal drops, it shows "Offline – kept on this device" and saves when the connection returns. If the page is reopened with unsaved local changes, it offers to restore them.

## Extending

| To add… | Change |
|---|---|
| A certificate type | `src/forms/definitions/*` + registry |
| A notification channel (e.g. Telegram) | Implement `Channel` in `server/notify/channels.ts` |
| Cloud file storage | Implement `FileStorage` in `server/storage.ts` |
| A database column | `src/db/schema.ts`, then `npm run db:generate` |
| Message wording | `server/notify/templates.ts` |
| Reminder timings | `server/schedule-rules.ts` (+ tests) |
