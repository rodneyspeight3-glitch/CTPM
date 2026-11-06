# Deploy to Render

This app requires **Node.js 24**, one web service instance, and a persistent disk for the SQLite account/session database. Adding a persistent disk requires a paid Render service. Confirm the existing service and disk before changing settings; do not replace an unrelated app or its database.

## Blueprint setup

The root `render.yaml` defines a Starter web service and a 1 GB persistent disk. In Render, create a Blueprint connected to `rodneyspeight3-glitch/CTPM` on branch `main`, then review the paid resources before applying it. Enter `ADMIN_EMAIL` and a unique 16–128 character `ADMIN_PASSWORD` when prompted; these values are not stored in the Blueprint. The Blueprint configures the build, startup, health check, Node version, and persistent database path.

For an existing service, use the settings below and preserve its existing disk and database. Creating a new Blueprint can create a separate service; it does not automatically migrate an existing service or its accounts.

## Existing service settings

- Repository: `rodneyspeight3-glitch/CTPM`, branch `main`.
- Runtime: Node.
- Build command: `npm ci --omit=dev`.
- Start command: `npm start`.
- Health check path: `/health`.
- Node version environment variable: `NODE_VERSION=24.22.1`.
- Environment: `NODE_ENV=production`.
- Persistent disk mount: `/var/data`, at least 1 GB. Set `DATABASE_PATH=/var/data/ctpm/app.sqlite`.
- Optional `APP_ORIGIN`: the exact HTTPS service URL, without a trailing slash. Leave unset to support same-origin access on both Render and custom domains.

Render provides `PORT`; the app binds to `0.0.0.0`.

## Initialize accounts securely

In the existing service's Render Environment settings, set `ADMIN_EMAIL` to the company administrator's email and `ADMIN_PASSWORD` to a unique password of 16–128 characters. Do not put these values in source control, chat, or build commands. On the first start of an empty database, the server creates this administrator and stores a scrypt password hash. Existing accounts are never overwritten by bootstrap values. Production startup fails if the database is empty and the bootstrap values are missing or invalid.

After signing in as Admin, use **Manage accounts** to create Tenant, Agent, or Admin accounts. Share initial credentials securely; no initial password is emailed. Resend verification and recovery require the configuration below. Users can change their password in **My account**. Remove the bootstrap password from Render's Environment settings after verifying the initial administrator account. Back up the disk and maintain a recovery process before relying on it for production accounts.

## Automatic deployments

The Blueprint sets `autoDeployTrigger: checksPass` for `main`. `.github/workflows/test.yml` installs Node.js 24 and Chromium and runs all API, production, and browser checks on pushes and pull requests. After this Blueprint setting is synced to the existing Render service, pushes to `main` deploy automatically when GitHub checks pass. Keep Blueprint auto-sync and the repository connection enabled in Render. An existing service with automatic deployments disabled needs the Blueprint change applied once; committing YAML alone does not prove the live setting changed.

`GET /health` checks the SQLite connection and reports `revision` from Render's injected `RENDER_GIT_COMMIT`. Use that full commit SHA to verify that the intended release is live. Local environments return a null revision. GitHub push success is separate from GitHub checks passing, Render building, and live health verification.

For direct Render API management from a Codex environment, configure `RENDER_API_KEY` securely for `api.render.com` and allow `api.render.com`, `render.com`, and `ctpm.onrender.com` in its network settings. This credential belongs in the Codex environment configuration, not the application repository or tenant-facing Management settings. Never paste credentials into chat. API access is not required for Render's GitHub-triggered deployments once connected.

## Release and verify

Only deploy after the persistent disk and environment variables are configured. Deploy the latest commit from the existing service's dashboard. Check `/health`, open `/login`, and sign in using the administrator account. Create a tenant and an agent, verify their role-specific landing pages, confirm neither can access `/api/admin/users`, and sign out. The root `/` serves the public home page; `/dashboard` without a session redirects to the shared `/login`. Confirm that `/signup` creates only tenant access and that existing staff accounts sign in without choosing a role.

Do not scale to multiple instances with this SQLite configuration. A shared managed database is needed for horizontal scaling. Do not point `DATABASE_PATH` at a pre-existing unrelated database. Redeploys must retain the same disk path.

## Dashboard and vacancies release

The release adds an availability column and application tables on startup without replacing existing data. Existing properties start Unavailable. After deployment, agents/admins should mark the intended vacancies Available from the portfolio, then check the dashboard and `/vacancies`. New properties can be marked Available in the Add property form. Keep the existing persistent disk and database path.

Use a test application to verify the staff-only Applications queue and status updates. The shared sign-in page remains `/login`; prospective tenants can apply from `/vacancies` without an account. The form does not charge a fee, create a lease or tenant account, or send email.

## Operating workflows release

This release adds active/archived flags, leases, PDF documents, rent charges/payment records, resident conversations, and property photo tables without replacing existing data. Keep the same disk and DATABASE_PATH. Photos and PDFs are stored in SQLite and must be included in database backups. No additional runtime service or third-party credential is required for these portal workflows.

After deployment, verify that an administrator can create a resident, staff can assign a lease and upload its signed PDF, and the resident can read only their own lease/ledger/messages. Check that leased homes disappear from vacancies. Record received payments only after verifying receipt outside the app; payment entries do not collect money. All these paths are covered by the repository's API and Chromium suites.

## Remaining product integrations

Authentication, account management, property creation, and maintenance tracking use the persistent SQLite database. Staff can create properties and update tenant requests through the portal. Existing accounts and sessions are preserved by additive table creation on startup; keep the same disk and DATABASE_PATH. Browser-local demo requests from older versions are not imported. Showcase homes are persisted in the property inventory, managed by staff, and displayed separately from actual vacancies. Staff can upload property photos and signed lease PDFs, manage rent records, and send resident messages inside the portal. Contact and payment instructions are configured by agents/admins in Management settings. Actual payment processing and receipts remain with the linked provider. Resend email verification/recovery/notifications, Stripe Checkout, and resident electronic signing are included in the current release. Email and payments require the provider configuration below. Automatic recurring billing and push/SMS delivery are not enabled. Administrators can reset account access in Manage accounts.

## Public home and tenant sign-up release

The home page is now `/`, the shared login is `/login`, tenant registration shares `/login?mode=signup`, and the protected role-specific portal is `/dashboard`. Existing root portal bookmarks with page fragments forward to the dashboard. No database reset is needed; registration notices and rate-limit records are added automatically. Public registration always creates Tenant access. New registered applicants cannot view payment account details until a lease is assigned. Agent and Admin accounts remain administrator-created.

Only actual properties marked Available are listed as vacancies and accept applications. Showcase homes are separate from actual vacancies and cannot receive applications. Only agents/admins can use Add property inside their dashboard or portfolio to enter verified inventory. The public home page does not expose property-creation actions. Existing real listings are not overwritten. The showcase inventory is initialized once and can be deleted from staff dashboards.

## Search and tenant shortlists release

The public home page no longer contains staff property-creation controls, including for signed-in staff. Add property remains available only inside agent/admin dashboards and portfolios, with server-side role checks. Tenant shortlists use an additive saved_homes table; no existing properties or accounts are replaced. Public search supports bedroom/budget filters, sorting, and shareable available-property details. Closed properties cannot be saved or opened as new public listings. Previously saved homes retain only their last public snapshot when unavailable.

## Managed collection and combined access release

This release adds property description, amenities, and showcase flags plus a migration marker. Six showcase records are initialized once against the existing administrator account. Deleted records are not restored by restart or redeployment. Agents/admins can delete unlinked homes; properties with resident/application history must be archived. Verify changes using the existing disk and DATABASE_PATH.

Sign-in and tenant registration now share `/login`, with registration at `/login?mode=signup`; old `/signup` links redirect there. Showcase records cannot be published as vacancies until staff enter verified details and change the listing category. Existing real listings remain unchanged.

## Complete rental applications release

This release adds application details, a form-version flag, private supporting-document storage, and document-removal audit records to the existing SQLite database. No database reset is needed. Keep the same persistent disk and `DATABASE_PATH`; earlier applications and reviews remain available. Income proof and photo ID are required for new applications, with optional rental-history and additional files (PDF/JPEG/PNG, 2 MB each, five files total). Only agents and administrators can view full submissions and download or remove documents. Credit is self-reported and the app makes no eligibility decisions.

Verify the full form on an available listing and test submissions in a staging environment using artificial documents. Verify staff-only review/download access, retention/removal with a reason, and preservation after redeploy. Application documents are stored in the database and its backups; protect them and apply your document-retention policy. Do not submit test identity documents to production.

## Brand, application guidance, and dashboard priorities release

Deploy this update to the existing service with the same disk and `DATABASE_PATH`. Additive application-review event tables preserve existing applications, accounts, documents, and leases. New submissions use form version 3: all answers are required except other income and pet information. Rental-history and additional-document uploads remain optional; income proof and photo ID remain required. Historical submissions are unchanged.

Verify the new logo/styles on `/` and `/login`, application completion and answer preview on an available listing, staff application search/status/property filters, review history, and dashboard reminders. Shared assets use version 11. No new environment variables or external services are required.

## Resident services, Agents directory, and provider integrations release

Deploy to the existing `ctpm` service from the repository’s `main` branch. Keep the same persistent disk and `DATABASE_PATH`; do not initialize or replace the production database. New service tables and user/property fields are additive. Existing sessions retain their original table shape; browser metadata is stored separately. Asset version is 12. Build remains `npm ci --omit=dev`; runtime dependencies now include the official Stripe SDK and `pdf-lib`.

Set `PUBLIC_APP_URL` to the app’s canonical HTTPS origin (Render’s `RENDER_EXTERNAL_URL` is a fallback). For email, configure `RESEND_API_KEY` and `EMAIL_FROM` after verifying the sending domain in Resend. For checkout, configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Keep credentials in Render Environment, never in chat or public settings. Admin → Service connections reports missing configuration without displaying secret values. Without provider keys, existing portal functions remain available and email/checkout controls explain setup is needed.

In Stripe, register `/api/webhooks/stripe` on the canonical HTTPS origin for checkout completion, asynchronous payment success/failure, session expiry, refunds, and dispute created/updated/closed events. Use a separate staging database with Stripe test-mode credentials to verify paid, pending bank, failed, expired, refunded, and disputed cases before accepting live payments. A browser redirect alone cannot confirm payment. Unpaid checkouts can be expired safely from the ledger; pending bank payments wait for provider confirmation.

Verify signup/login, verification/reset mail to controlled test inboxes, tenant application tracking/follow-up uploads, agent creation and admin-only public profile/portrait editing, gallery privacy, viewing requests/confirmation/calendar files, maintenance assignments/history/photos, saved searches, expense budgets, CSV/PDF reports, session revocation, and resident signing/downloads. Confirm unrelated tenants cannot access another applicant’s files, lease, appointment, or receipt. Keep real identities and payment tests out of production verification.

The app uses a persistent email outbox and hourly reminder checks on its single running instance. Database/disk backups include application identity documents, signatures, private photos, account-token delivery queues, and financial records; apply access and retention policies to backups too. Multi-instance deployment still requires a shared managed database and coordinated workers.
