# Deployment

The app is a standard Node.js web app with a PostgreSQL database. You need:

1. **A server for the app** (Node 22)
2. **A PostgreSQL database**
3. **Persistent file storage** for PDFs and photos
4. **A daily trigger** for reminders
5. **Email (SMTP)** and, optionally, **Twilio** for SMS/WhatsApp

## Option A: Managed hosting (simplest)

**Render** or **Railway** each provide the app server, a managed PostgreSQL database, a persistent disk and scheduled jobs in one place. Choose a UK/EU region.

1. Push this code to a private GitHub repository.
2. Create a PostgreSQL database and copy its connection string.
3. Create a Web Service from the repo:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run db:migrate && npm start`
   - Attach a persistent disk mounted at `/data` and set `STORAGE_DIR=/data/storage`.
   - Set the environment variables below.
4. Create a Cron Job that runs daily at 08:00: `npm run reminders`. Alternatively, call `GET https://your-app/api/cron/reminders` with the header `Authorization: Bearer <CRON_SECRET>`.
5. Point `app.techvu.co.uk` at the service (CNAME) and enable HTTPS (automatic on these hosts).
6. Create your admin account by running `npm run db:seed -- --admin you@techvu.co.uk "Your Name"` in the service shell, then open the link it prints.

## Option B: Your own server (UK data residency)

On a VM (for example Azure UK South, AWS London or a UK VPS) with Docker:

```bash
cp .env.example .env    # fill in values
docker compose up -d --build
docker compose exec app npm run db:seed -- --admin you@techvu.co.uk "Your Name"
```

Then:

- Put a reverse proxy (Caddy or nginx) in front for HTTPS.
- Add a crontab entry: `0 8 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.techvu.co.uk/api/cron/reminders`

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✔ | PostgreSQL connection string |
| `AUTH_SECRET` | ✔ | 32+ random characters (`openssl rand -base64 48`). Changing it signs everyone out. |
| `APP_URL` | ✔ | e.g. `https://app.techvu.co.uk`, used in email links |
| `STORAGE_DIR` | ✔ | Persistent folder for PDFs and photos |
| `CRON_SECRET` | ✔ | 8+ characters; protects the reminders endpoint |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | for email | Any SMTP provider: Microsoft 365, Google Workspace, Postmark, SendGrid, Amazon SES… |
| `OFFICE_NOTIFY_EMAIL` | optional | Receives the daily overdue/due-soon summary |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | for SMS | |
| `TWILIO_WHATSAPP_FROM` | for WhatsApp | e.g. `whatsapp:+447…`. Needs an approved WhatsApp sender and message templates in Twilio. |

Until SMTP is configured, emails are written to the server log instead of being sent. This is useful for testing. **Settings → Notification channels** in the app shows which channels are live.

## Email deliverability

To send as `@techvu.co.uk`, add the SPF/DKIM records your email provider gives you to your domain's DNS. Otherwise reminders may land in spam.

## Backups

- **Database:** use your host's daily automated backups (keep 30 days or more), or `pg_dump` nightly.
- **Files:** back up `STORAGE_DIR`. The PDFs are your legal record. Every issued certificate also stores a SHA-256 checksum in the database, so you can prove a file hasn't changed.
- **Disaster recovery:** if PDFs were ever lost, they can be regenerated from the database data. Do test a restore once.

## Moving files to cloud storage (optional)

To store PDFs and photos in S3 or Azure Blob instead of disk, implement the `FileStorage` interface in `src/server/storage.ts` (three methods: put, get, delete). Nothing else changes.

## Updating the app

Deploy the new code. `npm run db:migrate` runs on start and applies any new database migrations safely.

## Health check

`GET /api/health` returns `{"ok":true}` when the app and database are up. Point your uptime monitor at it.
