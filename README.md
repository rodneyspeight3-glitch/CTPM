# Come Together Property Management

A Node.js 24 application for tenants, agents, and administrators, with a public home, available properties, address applications, and one shared sign-in/sign-up page. Accounts, photos, documents, sessions, and operational records persist in SQLite.

## Run locally

Use Node.js 24 (production pins 24.22.1).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. A fresh local database needs `ADMIN_EMAIL` and a unique 16–128 character `ADMIN_PASSWORD` in the process environment. Never commit credentials. `DATABASE_PATH` defaults to `.data/app.sqlite`. Existing accounts are never overwritten by bootstrap values. Remove the bootstrap password after verifying the administrator account.

`npm test` runs API and Chromium integration suites using isolated databases and randomized credentials. Install Chromium with `npx playwright install chromium` and set `CHROMIUM_PATH` to the installed executable when it is not `/usr/bin/chromium`. Provider tests use local doubles and cannot send real email or charge real cards.

## Main workflows

- **Public:** `/`, `/vacancies`, `/agents`, `/apply`, and `/application-status`. Available verified properties accept applications. Open applications accept an address before a property exists in the portfolio. Private receipt links support status tracking without email.
- **Access:** `/login` combines sign-in with tenant registration. Roles are detected from accounts. Agent/admin accounts are administrator-created. `/dashboard` requires a session. All API permissions are enforced on the server.
- **Properties:** agents/admins manage real and illustrative inventory. Add property includes multiple photos, previews, cover selection, ordering, captions, browser resizing, and atomic saves. Public home pages have no Add property controls. Showcase homes cannot accept applications. Linked records are archived instead of deleted.
- **Applications:** a full required form, with optional other income/pets and optional rental-history/additional uploads. Income proof and photo ID are required. Private documents, review history, matching, priorities, follow-up dates, receipt claiming, applicant withdrawals, and follow-up document requests are persisted.
- **Resident services:** maintenance with photos/contractor work tracking, appointments, leases, in-app resident signatures, private messages, saved homes/searches, notifications, a noticeboard, an authorized document library, and calendars.
- **Staff:** lease assignments, rent charges, received-payment records/receipts, expense attachments, budgets/reports, team tasks, preventive maintenance plans, account management, admin-managed public agent profiles, and editable contacts/payment instructions.
- **Handover:** admin database checks, storage/retention review, owner checklist, staff action audit, and password-confirmed consistent SQLite backup downloads. Personal exports contain only the current account's records.
- **Appearance:** a refreshed teal/mint/coral interface, alternate palettes, dark/system mode, compact spacing, reduced motion, keyboard command search, and a home-screen manifest. No sensitive offline cache or service worker is installed.

The [50 home-page additions](docs/HOME-50.md) cover advanced discovery, local shortlists, budgets, moving plans, viewing preparation and application help. These tools use the current public inventory and browser storage, without paid add-ons.

The [50-improvement index](docs/RELEASE-50.md) identifies each control. The [handover guide](docs/HANDOVER.md) explains operating limits, owner setup, backup restoration, and validation.

## Hosting and email configuration

Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`. Recovery codes, private receipts, management identity confirmation, notifications, signing, PDF/CSV exports, and calendars run inside this service. OpenStreetMap directions are ordinary external links; video tours open the selected provider only after a click.

Payments follow staff-configured instructions. Staff record money actually received; the app does not debit accounts or reconcile bank statements automatically. Existing Render hosting and persistent-disk charges remain the owner's current subscription. No external subscription is purchased by the app. Owner-selected mail.com SMTP requires an existing SMTP-enabled mailbox; see the setup below.

Legacy optional Stripe and Resend integrations are retained for existing history. They require explicit `ALLOW_PAID_INTEGRATIONS=true` **and** the relevant secret configuration before enabling new checkout/email. Existing signed webhooks can reconcile prior transactions. Credentials belong only in Render Environment. The default handover requires none of them.

| Optional variable | Purpose |
|---|---|
| `PUBLIC_APP_URL` | Canonical HTTPS origin. `RENDER_EXTERNAL_URL` is the Render fallback. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional verified-domain email delivery. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional hosted checkout and signed raw webhooks. |

Do not enable legacy providers without separately verifying delivery and the full checkout/refund/failure flow in a staging environment. A redirect never confirms payment. The app retains original and resident-signed lease PDFs; it neither drafts contracts nor supplies management signatures. Emergency dispatch, SMS/push, automatic recurring billing, and offsite backups are not configured.

## Company SMTP and automated messages

[SMTP setup and delivery guide](docs/SMTP.md) documents the owner-authorized sender, required Render variables, TLS, and verification. SMTP is separately enabled with `SMTP_ENABLED=true`; keep legacy paid integrations off. The mailbox password belongs only in Render Environment. A sender display name does not conceal the sender address in email headers. The SMTP login and sender must match. An owner-selected personal mailbox remains visible to recipients.

New signup creates an in-app welcome and, when configured, a welcome/verification email. Opted-in applicants receive a private receipt, actual status changes, and generic document-request emails, with unsubscribe controls. All automated email is marked No Reply, with portal/contact help links and automatic-response suppression. The authorized sender address is retained; no unregistered no-reply alias is invented. Queue retries and suppression preserve private records. Admin service connections shows configuration status and an SMTP connection check. mail.com access may require Premium; the app does not purchase or upgrade an account.

The white page background now uses locally served real-building photography in a continuous left-to-right loop, with aligned repeating tiles, pause controls, and reduced-motion support. Hero photos remain unchanged. [Asset source and license](docs/SMTP.md#background-photography).

## Data and deployment

See [RENDER.md](RENDER.md). Keep one instance and the existing persistent disk/database path. This release preserves existing account, application, document, and financial records. The required-property application table migrates to allow an unmatched address, preserving IDs, indexes, child documents, and foreign keys. New fields/tables are added without seeding real inventory or replacing accounts.

The six existing showcase homes remain staff-manageable and do not regenerate after deletion. Their illustrative assets are served locally from the Bedimcode real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace illustrations with owner-supplied photographs and confirmed property details before publishing actual vacancies. The Come Together brand mark is served locally as well.

Protect the database and backups: they contain account hashes, identity documents, private photos, signed agreements, messages, and financial records. Apply the owner's retention policy; the app never automatically deletes application documents based on age. The handover page flags records for review.

The home page presents current vacancies and the direct-address application first, then application guidance, resident services, the team, the illustrative collection, FAQs, and contact. Mobile navigation and property filters remain visible; the illustrative collection scrolls horizontally on phones to keep the page focused.
