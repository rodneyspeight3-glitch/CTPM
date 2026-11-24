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

The [prioritized 500-feature roadmap](docs/ROADMAP-500.md), also available as a [planning CSV](docs/ROADMAP-500.csv), describes proposed future work. These entries are not shipped features. It builds on the existing workflows and keeps new paid add-ons outside scope.

The primary production address is **https://ctpm.online**. The `www` address redirects there; the existing Render address remains available for older private links. See [domain and HTTPS troubleshooting](docs/DOMAIN.md) for current checks and what to collect if a browser reports an SSL warning.

The shared visual design uses warm ivory, charcoal, restrained slate and champagne accents, locally served variable fonts, and consistent public, application, account and staff layouts. The design retains visitor-local day/night, alternate palettes, readable headings, contrast, large text, touch targets, compact density, reduced motion and print styles. The architectural background and agent animations remain available. [Font sources and licenses](public/fonts/README.md) are included; no paid design service or external font request is required.

## Main workflows

- **Public:** `/`, `/vacancies`, `/agents`, `/apply`, and `/application-status`. Available verified properties accept applications. Open applications accept an address before a property exists in the portfolio. Private receipt links support status tracking without email.
- **Access:** `/login` combines sign-in with tenant registration. Roles are detected from accounts. Agent/admin accounts are administrator-created. `/dashboard` requires a session. All API permissions are enforced on the server.
- **Properties:** agents/admins manage real and illustrative inventory. Agent-created homes automatically assign their creator; administrators can select multiple responsible agents in Add/Edit property. Public listings, details, saved homes and showcases display current active agents using their public profiles. Add property includes multiple photos, previews, cover selection, ordering, captions, browser resizing, and atomic saves. Public home pages have no Add property controls. Showcase homes cannot accept applications. Linked records are archived instead of deleted.
- **Applications:** a full required form, with optional other income/pets and optional rental-history/additional uploads. Income proof and photo ID are required. Agents/admins explicitly confirm Approved or Rejected decisions; status tracking and opted-in configured email reflect the outcome while staff notes remain private. Private documents, review history, matching, priorities, follow-up dates, receipt claiming, applicant withdrawals, and follow-up document requests are persisted.

  In **Applications → Review application**, agents and administrators can download the completed application and every currently retained supporting document as one private PDF. Uploaded PDF pages and photos appear after the answers, including follow-up uploads; original files are also embedded as PDF attachments. Unreadable, locked, or unusually long documents get a notice page with their original attached. Removed documents and private staff notes are excluded. Individual downloads remain available.
- **Applicant agreements:** staff can share a revocable 90-day private lease link before an applicant has a tenant account. Applicants can review/download and electronically sign or decline; the link-based identity method is recorded accurately. Each approved applicant can upload and sign a separate lease for the same address, even when another applicant has already signed or the home is assigned. Private invitation links expose only their own agreement; only agents and administrators can view all applicants’ agreements. Original/signed PDFs and invitation history remain private. Staff can attach an applicant-signed agreement to a later matching account without requesting another signature. Optional invitation email uses the configured sender and a staff-confirmed one-time request; general application-update preferences stay separate. Staff can also copy a private link or open a prepared draft in their own email app.

  The first open of each private lease invitation creates one in-app alert for active agents/admins. The staff dashboard and notification bell show the applicant, property and time, with a direct lease-review action and per-user read controls. Visible staff dashboards refresh alerts about every ten seconds. Reopening or replacing the same invitation link does not duplicate the alert; viewing is not evidence of signing, and view alerts do not send email.
- **Lease preparation:** approval automatically creates a private staff draft with the applicant, known home/rent, requested move-in and proposed term dates. Agents/admins can edit versioned company wording, generate a PDF or upload a readable PDF up to 5 MB. Private applicant-link delivery is the default. Staff can explicitly choose tenant-account delivery to atomically assign the home, retain the agreement and request the tenant's signature. Selecting a signed applicant agreement for account assignment preserves that signature; other applicants’ signed copies stay separate. Missing accounts, property matches or amounts stay explicit; approval alone creates no active lease or charges.
- **Resident services:** maintenance with photos/contractor work tracking, appointments, leases, in-app resident signatures, private messages, saved homes/searches, notifications, a noticeboard, an authorized document library, and calendars.
- **Staff:** lease assignments, rent charges, received-payment records/receipts, expense attachments, budgets/reports, team tasks, preventive maintenance plans, account management, admin-managed public agent profiles, and editable contacts/payment instructions.
- **Handover:** admin database checks, storage/retention review, owner checklist, staff action audit, and password-confirmed consistent SQLite backup downloads. Personal exports contain only the current account's records.
- **Appearance:** a refreshed teal/mint/coral interface, alternate palettes, dark/system mode, compact spacing, reduced motion, keyboard command search, and a home-screen manifest. No sensitive offline cache or service worker is installed.
- **Visual details:** warm peach highlights, an architectural home-page accent, expressive hero typography, coordinated property/team cards and dashboard totals, and short entrance/hover effects. The shared visual layer supports night mode, quiet visuals and reduced motion without external fonts or libraries.
- **State and tenancy choices:** all 50 states plus Washington, D.C. have separate editable company templates. California starts from the company-supplied 61-clause lease, with the original personal details replaced. Other states start from a national draft and require staff-reviewed state/local terms and disclosures before a generated send. Fixed-term and year-to-year tenancy options use distinct wording and date labels; periodic dates track renewal reviews without automatically ending the tenancy or preventing later rent charges. State selection does not certify legal compliance.
- **Agent presence and feedback:** missing portraits use an animated branded illustration, and blank biographies receive an editable introduction based only on public name, title and areas. Residents with a management-assigned lease can submit feedback; administrators can record genuine previous-client feedback with publication permission, moderate it and publish it on profiles/home. Generated review examples remain labeled in the administrator preview and never populate public ratings.
- **Neighborhood moments:** every page has a compact local-time greeting and an optional illustrated neighborhood with palette choices, window lights, a celebration and quiet controls. Real records keep their original values. Motion respects device and app preferences.
- **New-chapter moments:** real lease progress cards, a resident welcome panel and short decorative celebrations after approval, sending and resident signing. Celebrations honor quiet and reduced-motion settings; no audio, tracking or paid libraries are added.
- **Property help:** a built-in help chat on every page searches current public vacancies by bedrooms, budget, neighborhood or assigned agent and explains applications and portal navigation. It uses curated guidance, not generative AI or a live operator. Questions stay in page memory and are never submitted to an external service, stored in the database or retained after reload. Private account questions link to the authorized portal.

The [50 home-page additions](docs/HOME-50.md) cover advanced discovery, local shortlists, budgets, moving plans, viewing preparation and application help. These tools use the current public inventory and browser storage, without paid add-ons.

The [50-improvement index](docs/RELEASE-50.md) identifies each control. The [handover guide](docs/HANDOVER.md) explains operating limits, owner setup, backup restoration, and validation.

## Hosting and email configuration

Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`. Recovery codes, private receipts, management identity confirmation, notifications, signing, PDF/CSV exports, and calendars run inside this service. OpenStreetMap directions are ordinary external links; video tours open the selected provider only after a click.

Payments follow staff-configured instructions. Staff record money actually received; the app does not debit accounts or reconcile bank statements automatically. Existing Render hosting and persistent-disk charges remain the owner's current subscription. No external subscription is purchased by the app. Personal Gmail SMTP is supported without a paid email subscription when the account supports app passwords; mail.com SMTP requires an existing Premium account. See the setup below.

Legacy optional Stripe and Resend integrations are retained for existing history. They require explicit `ALLOW_PAID_INTEGRATIONS=true` **and** the relevant secret configuration before enabling new checkout/email. Existing signed webhooks can reconcile prior transactions. Legacy-provider credentials belong in Render Environment. SMTP can also be managed through the administrator dashboard. The default handover requires none of them.

| Optional variable | Purpose |
|---|---|
| `PUBLIC_APP_URL` | Canonical HTTPS origin. `RENDER_EXTERNAL_URL` is the Render fallback. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional verified-domain email delivery. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional hosted checkout and signed raw webhooks. |

Do not enable legacy providers without separately verifying delivery and the full checkout/refund/failure flow in a staging environment. A redirect never confirms payment. The app retains original and resident-signed lease PDFs. Generated agreements use editable company wording reviewed by staff; management signatures are supplied separately. Emergency dispatch, SMS/push, automatic recurring billing, and offsite backups are not configured.

## SMTP and automated messages

**Admin → Service connections → Administrator email settings** lets administrators save paused settings, check the saved connection, or check and enable automatic delivery. Custom public SMTP hostname, provider port, TLS/STARTTLS mode, username, authorized sender and password changes apply without a redeploy. Spacemail, Gmail and mail.com have optional presets. The Spacemail preset selects `mail.spacemail.com`, port 465 and TLS for an existing domain mailbox; the owner selected `screening@ctpm.online`. It still requires that mailbox's valid password saved privately in Admin. No mailbox or subscription is created. Private/internal destinations and unencrypted connections are blocked. Dashboard credentials use AES-256-GCM encryption with a separate private key beside the persistent database; saved passwords are never returned. Sensitive actions require the current administrator password. Existing Render SMTP variables remain the fallback until an override is saved. The [SMTP setup and delivery guide](docs/SMTP.md) also documents the hosting fallback and provider requirements; keep legacy paid integrations off. A sender display name does not conceal the sender address in email headers. Custom SMTP logins can differ from the provider-authorized sender; Gmail and mail.com require a matching mailbox. An owner-selected personal mailbox remains visible to recipients.

New signup creates an in-app welcome and, when configured, a welcome/verification email. Opted-in applicants receive a private receipt, actual status changes, and generic document-request emails, with unsubscribe controls. All automated email is marked No Reply, with portal/contact help links and automatic-response suppression. The authorized sender address is retained; no unregistered no-reply alias is invented. Queue retries and suppression preserve private records. Admin service connections shows configuration status and an SMTP connection check. Gmail uses 2-Step Verification and a Google app password, with a 400-email rolling daily app budget. mail.com requires Premium; the app does not purchase or upgrade an account.

Administrators can also **Send a plain-text test email** from the saved SMTP settings. It requires the current administrator password and explicit recipient confirmation, uses the normal outbox, and reports provider acceptance separately from inbox delivery. It does not enable paused delivery or alter credentials. Duplicate request references do not create duplicate queue entries; tests are rate-limited and expire after 15 minutes.

The white page background now uses locally served real-building photography in a continuous left-to-right loop, with aligned repeating tiles, pause controls, and reduced-motion support. Hero photos remain unchanged. [Asset source and license](docs/SMTP.md#background-photography).

## Data and deployment

See [RENDER.md](RENDER.md). Keep one instance and the existing persistent disk/database path. This release preserves existing account, application, document, and financial records. The required-property application table migrates to allow an unmatched address, preserving IDs, indexes, child documents, and foreign keys. New fields/tables are added without seeding real inventory or replacing accounts.

The property-agent migration assigns existing homes only when `created_by` identifies an agent. It runs once, preserves the original creator, and does not undo later administrator changes. Admin-created or untraceable homes remain with the property team until an administrator selects agents. Deactivated agents disappear from public listings immediately and remain flagged for review in the staff editor. Agent reassignment does not restrict the existing shared staff portfolio permissions.

The six existing showcase homes remain staff-manageable and do not regenerate after deletion. Their illustrative assets are served locally from the Bedimcode real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace illustrations with owner-supplied photographs and confirmed property details before publishing actual vacancies. The Come Together brand mark is served locally as well.

Protect the database and backups: they contain account hashes, identity documents, private photos, signed agreements, messages, and financial records. Apply the owner's retention policy; the app never automatically deletes application documents based on age. The handover page flags records for review.

The home page presents current vacancies and the direct-address application first, then application guidance, resident services, the team, the illustrative collection, FAQs, and contact. Mobile navigation and property filters remain visible; the illustrative collection scrolls horizontally on phones to keep the page focused.
