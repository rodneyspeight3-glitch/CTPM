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

After signing in as Admin, use **Manage accounts** to create Tenant, Agent, or Admin accounts. Share initial credentials securely; email delivery is not configured. Users can change their password in **My account**. Remove the bootstrap password from Render's Environment settings after verifying the initial administrator account. Back up the disk and maintain a recovery process before relying on it for production accounts.

## Automatic deployments

The Blueprint sets `autoDeployTrigger: checksPass` for `main`. `.github/workflows/test.yml` installs Node.js 24 and Chromium and runs all API, production, and browser checks on pushes and pull requests. After this Blueprint setting is synced to the existing Render service, pushes to `main` deploy automatically when GitHub checks pass. Keep Blueprint auto-sync and the repository connection enabled in Render. An existing service with automatic deployments disabled needs the Blueprint change applied once; committing YAML alone does not prove the live setting changed.

`GET /health` checks the SQLite connection and reports `revision` from Render's injected `RENDER_GIT_COMMIT`. Use that full commit SHA to verify that the intended release is live. Local environments return a null revision. GitHub push success is separate from GitHub checks passing, Render building, and live health verification.

For direct Render API management from a Codex environment, configure `RENDER_API_KEY` securely for `api.render.com` and allow `api.render.com`, `render.com`, and `ctpm.onrender.com` in its network settings. This credential belongs in the Codex environment configuration, not the application repository or tenant-facing Management settings. Never paste credentials into chat. API access is not required for Render's GitHub-triggered deployments once connected.

## Release and verify

Only deploy after the persistent disk and environment variables are configured. Deploy the latest commit from the existing service's dashboard. Check `/health`, open `/login`, and sign in using the administrator account. Create a tenant and an agent, verify their role-specific landing pages, confirm neither can access `/api/admin/users`, and sign out. Requests to `/` without a session must redirect to `/login`.

Do not scale to multiple instances with this SQLite configuration. A shared managed database is needed for horizontal scaling. Do not point `DATABASE_PATH` at a pre-existing unrelated database. Redeploys must retain the same disk path.

## Dashboard and vacancies release

The release adds an availability column and application tables on startup without replacing existing data. Existing properties start Unavailable. After deployment, agents/admins should mark the intended vacancies Available from the portfolio, then check the dashboard and `/vacancies`. New properties can be marked Available in the Add property form. Keep the existing persistent disk and database path.

Use a test application to verify the staff-only Applications queue and status updates. The shared sign-in page remains `/login`; prospective tenants can apply from `/vacancies` without an account. The form does not charge a fee, create a lease or tenant account, or send email.

## Operating workflows release

This release adds active/archived flags, leases, PDF documents, rent charges/payment records, resident conversations, and property photo tables without replacing existing data. Keep the same disk and DATABASE_PATH. Photos and PDFs are stored in SQLite and must be included in database backups. No additional runtime service or third-party credential is required for these portal workflows.

After deployment, verify that an administrator can create a resident, staff can assign a lease and upload its signed PDF, and the resident can read only their own lease/ledger/messages. Check that leased homes disappear from vacancies. Record received payments only after verifying receipt outside the app; payment entries do not collect money. All these paths are covered by the repository's API and Chromium suites.

## Remaining product integrations

Authentication, account management, property creation, and maintenance tracking use the persistent SQLite database. Staff can create properties and update tenant requests through the portal. Existing accounts and sessions are preserved by additive table creation on startup; keep the same disk and DATABASE_PATH. Browser-local demo requests from older versions are not imported. Three clearly marked sample listings are available by opt-in. Staff can upload property photos and signed lease PDFs, manage rent records, and send resident messages inside the portal. Contact and payment instructions are configured by agents/admins in Management settings. Actual payment processing and receipts remain with the linked provider. Email password recovery, electronic signatures, automatic recurring billing, and email/push notifications are not connected. Administrators can reset account access in Manage accounts.
