# FireCert

Fire alarm certification, service scheduling and customer portal for fire alarm engineers.

- **Engineers** complete BS 5839-1 based certificates on their phone. They get autosave, an offline backup, finger signatures and camera photos.
- **Office/admin** manage customers, sites and staff. They book visits, see what's overdue, and void or reissue certificates.
- **Customers** sign in to a portal to download their certificates at any time and see upcoming visits.
- **Reminders** go out automatically by email, SMS or WhatsApp at 30 days, 7 days, when overdue, and the day before a booked visit. The office also gets a daily summary.

Built with Next.js 15 (React 19), TypeScript, PostgreSQL (Drizzle ORM) and Tailwind CSS. It is installable on phones as an app (PWA).

## Quick start (developer)

Requirements: Node 22+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and AUTH_SECRET
npm run db:migrate            # create tables
npm run db:seed -- --demo     # optional demo data (password Demo12345!)
npm run dev                   # http://localhost:3000
```

Demo logins (after `--demo`): `admin@demo.test`, `engineer@demo.test`, `customer@demo.test`.

For a real system, skip `--demo` and create your first admin instead:

```bash
npm run db:seed -- --admin you@techvu.co.uk "Your Name"   # prints a link to set your password
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (form engine, scheduling, dates) |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate -- --name x` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run reminders` | Run the reminder job once (schedule daily) |
| `node tests/e2e/walkthrough.cjs` | Full browser walkthrough against a running demo instance |

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): hosting, email/SMS/WhatsApp, daily reminders, backups
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organised and why
- [docs/ADDING-FORMS.md](docs/ADDING-FORMS.md): add a new certificate type or change an existing one

## Important

The certificate forms follow the structure of the BS 5839-1 model certificates. Before going live, check the wording against your copy of the current standard and your certification body's requirements (e.g. BAFE SP203-1 or NSI), and adjust the definitions in `src/forms/definitions/`.
