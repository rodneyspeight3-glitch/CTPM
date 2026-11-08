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

The [200-capability app expansion](docs/APP-200.md) adds visitor-local day/night, reading controls, an account-private organizer, and ten staff workflow packs under Operations hub. It uses the existing SQLite database and no paid add-ons.

## Main workflows

- **Public:** `/`, `/vacancies`, `/agents`, `/apply`, and `/application-status`. Available verified properties accept applications. Open applications accept an address before a property exists in the portfolio. Private receipt links support status tracking without email.
- **Access:** `/login` combines sign-in with tenant registration. Roles are detected from accounts. Agent/admin accounts are administrator-created. `/dashboard` requires a session. All API permissions are enforced on the server.
- **Properties:** agents/admins manage real and illustrative inventory. Agent-created homes automatically assign their creator; administrators can select multiple responsible agents in Add/Edit property. Public listings, details, saved homes and showcases display current active agents using their public profiles. Add property includes multiple photos, previews, cover selection, ordering, captions, browser resizing, and atomic saves. Public home pages have no Add property controls. Showcase homes cannot accept applications. Linked records are archived instead of deleted.
- **Applications:** a full required form, with optional other income/pets and optional rental-history/additional uploads. Income proof and photo ID are required. Agents/admins explicitly confirm Approved or Rejected decisions; status tracking and opted-in configured email reflect the outcome while staff notes remain private. Private documents, review history, matching, priorities, follow-up dates, receipt claiming, applicant withdrawals, and follow-up document requests are persisted.
- **Applicant agreements:** staff can share a revocable 90-day private lease link before an applicant has a tenant account. Applicants can review/download and electronically sign or decline; the link-based identity method is recorded accurately. Original/signed PDFs and invitation history remain private. Staff can attach an applicant-signed agreement to a later matching account without requesting another signature. Optional invitation email uses the existing configured, opted-in outbox; otherwise staff copy and share the link.
- **Lease preparation:** approval automatically creates a private staff draft with the applicant, known home/rent, requested move-in and proposed term dates. Agents/admins can edit versioned company wording, generate a PDF or upload a readable PDF up to 5 MB. Sending after review atomically assigns the home, retains the agreement and requests the tenant's signature. Missing accounts, property matches or amounts stay explicit; approval alone creates no active lease or charges.
- **Resident services:** maintenance with photos/contractor work tracking, appointments, leases, in-app resident signatures, private messages, saved homes/searches, notifications, a noticeboard, an authorized document library, and calendars.
- **Staff:** lease assignments, rent charges, received-payment records/receipts, expense attachments, budgets/reports, team tasks, preventive maintenance plans, account management, admin-managed public agent profiles, and editable contacts/payment instructions.
- **Handover:** admin database checks, storage/retention review, owner checklist, staff action audit, and password-confirmed consistent SQLite backup downloads. Personal exports contain only the current account's records.
- **Appearance:** a refreshed teal/mint/coral interface, alternate palettes, dark/system mode, compact spacing, reduced motion, keyboard command search, and a home-screen manifest. No sensitive offline cache or service worker is installed.
- **Visual details:** warm peach highlights, an architectural home-page accent, expressive hero typography, coordinated property/team cards and dashboard totals, and short entrance/hover effects. The shared visual layer supports night mode, quiet visuals and reduced motion without external fonts or libraries.
- **State and tenancy choices:** all 50 states plus Washington, D.C. have separate editable company templates. California starts from the company-supplied 61-clause lease, with the original personal details replaced. Other states start from a national draft and require staff-reviewed state/local terms and disclosures before a generated send. Fixed-term and year-to-year tenancy options use distinct wording and date labels; periodic dates track renewal reviews without automatically ending the tenancy or preventing later rent charges. State selection does not certify legal compliance.
- **New-chapter moments:** real lease progress cards, a resident welcome panel and short decorative celebrations after approval, sending and resident signing. Celebrations honor quiet and reduced-motion settings; no audio, tracking or paid libraries are added.
- **Property help:** a built-in help chat on every page searches current public vacancies by bedrooms, budget, neighborhood or assigned agent and explains applications and portal navigation. It uses curated guidance, not generative AI or a live operator. Questions stay in page memory and are never submitted to an external service, stored in the database or retained after reload. Private account questions link to the authorized portal.

The [50 home-page additions](docs/HOME-50.md) cover advanced discovery, local shortlists, budgets, moving plans, viewing preparation and application help. These tools use the current public inventory and browser storage, without paid add-ons.

The [50-improvement index](docs/RELEASE-50.md) identifies each control. The [handover guide](docs/HANDOVER.md) explains operating limits, owner setup, backup restoration, and validation.

## Hosting and email configuration

Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`. Recovery codes, private receipts, management identity confirmation, notifications, signing, PDF/CSV exports, and calendars run inside this service. OpenStreetMap directions are ordinary external links; video tours open the selected provider only after a click.

Payments follow staff-configured instructions. Staff record money actually received; the app does not debit accounts or reconcile bank statements automatically. Existing Render hosting and persistent-disk charges remain the owner's current subscription. No external subscription is purchased by the app. Personal Gmail SMTP is supported without a paid email subscription when the account supports app passwords; mail.com SMTP requires an existing Premium account. See the setup below.

Legacy optional Stripe and Resend integrations are retained for existing history. They require explicit `ALLOW_PAID_INTEGRATIONS=true` **and** the relevant secret configuration before enabling new checkout/email. Existing signed webhooks can reconcile prior transactions. Credentials belong only in Render Environment. The default handover requires none of them.

| Optional variable | Purpose |
|---|---|
| `PUBLIC_APP_URL` | Canonical HTTPS origin. `RENDER_EXTERNAL_URL` is the Render fallback. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional verified-domain email delivery. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional hosted checkout and signed raw webhooks. |

Do not enable legacy providers without separately verifying delivery and the full checkout/refund/failure flow in a staging environment. A redirect never confirms payment. The app retains original and resident-signed lease PDFs. Generated agreements use editable company wording reviewed by staff; management signatures are supplied separately. Emergency dispatch, SMS/push, automatic recurring billing, and offsite backups are not configured.

## SMTP and automated messages

[SMTP setup and delivery guide](docs/SMTP.md) documents the owner-authorized sender, required Render variables, TLS, and verification. SMTP is separately enabled with `SMTP_ENABLED=true`; keep legacy paid integrations off. The mailbox password belongs only in Render Environment. A sender display name does not conceal the sender address in email headers. The SMTP login and sender must match. An owner-selected personal mailbox remains visible to recipients.

New signup creates an in-app welcome and, when configured, a welcome/verification email. Opted-in applicants receive a private receipt, actual status changes, and generic document-request emails, with unsubscribe controls. All automated email is marked No Reply, with portal/contact help links and automatic-response suppression. The authorized sender address is retained; no unregistered no-reply alias is invented. Queue retries and suppression preserve private records. Admin service connections shows configuration status and an SMTP connection check. Gmail uses 2-Step Verification and a Google app password, with a 400-email rolling daily app budget. mail.com requires Premium; the app does not purchase or upgrade an account.

The white page background now uses locally served real-building photography in a continuous left-to-right loop, with aligned repeating tiles, pause controls, and reduced-motion support. Hero photos remain unchanged. [Asset source and license](docs/SMTP.md#background-photography).

## Data and deployment

See [RENDER.md](RENDER.md). Keep one instance and the existing persistent disk/database path. This release preserves existing account, application, document, and financial records. The required-property application table migrates to allow an unmatched address, preserving IDs, indexes, child documents, and foreign keys. New fields/tables are added without seeding real inventory or replacing accounts.

The property-agent migration assigns existing homes only when `created_by` identifies an agent. It runs once, preserves the original creator, and does not undo later administrator changes. Admin-created or untraceable homes remain with the property team until an administrator selects agents. Deactivated agents disappear from public listings immediately and remain flagged for review in the staff editor. Agent reassignment does not restrict the existing shared staff portfolio permissions.

The six existing showcase homes remain staff-manageable and do not regenerate after deletion. Their illustrative assets are served locally from the Bedimcode real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace illustrations with owner-supplied photographs and confirmed property details before publishing actual vacancies. The Come Together brand mark is served locally as well.

Protect the database and backups: they contain account hashes, identity documents, private photos, signed agreements, messages, and financial records. Apply the owner's retention policy; the app never automatically deletes application documents based on age. The handover page flags records for review.

The home page presents current vacancies and the direct-address application first, then application guidance, resident services, the team, the illustrative collection, FAQs, and contact. Mobile navigation and property filters remain visible; the illustrative collection scrolls horizontally on phones to keep the page focused.
