# Existing Render deployment

Keep the existing `ctpm` service at https://ctpm.onrender.com and its current persistent disk. Do not create a second service or replace an unrelated database. The owner chose **Keep Render; no paid add-ons**. Render hosting/disk remains the existing subscription; this release requires no additional email, payment, map, file, or signature service.

## Settings

- Repository: `rodneyspeight3-glitch/CTPM`, branch `main`.
- Runtime: Node.js 24, one web service instance.
- Build: `npm ci --omit=dev`.
- Start: `npm start`.
- Health check: `/health`.
- `NODE_VERSION=24.22.1`, `NODE_ENV=production`.
- Existing persistent disk mounted at `/var/data`; `DATABASE_PATH=/var/data/ctpm/app.sqlite`.
- Render supplies `PORT`; the app listens on `0.0.0.0`.
- Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`.
- Optional `APP_ORIGIN`: exact HTTPS origin, no trailing slash. Leave unset to support same-origin browser access on Render and custom domains.
- Optional `PUBLIC_APP_URL`: canonical HTTPS origin; Render's `RENDER_EXTERNAL_URL` is the fallback.

`render.yaml` describes this app's service. For an already linked Blueprint, sync changes to the existing service. Do not create a duplicate Blueprint or change the hosting plan/disk for this release. Do not scale SQLite to multiple instances.

## First account

For an empty database only, set `ADMIN_EMAIL` and a unique 16–128 character `ADMIN_PASSWORD` privately in Render Environment. Existing accounts are never overwritten. Production startup rejects an empty database without valid bootstrap values. After first sign-in, generate recovery codes in My account and remove the bootstrap password. Administrators create agent/admin accounts; tenants may register themselves through the shared `/login` page.

No paid email is needed: use recovery codes, private application receipt links, management-confirmed resident identity, and in-app notifications. Admins confirm tenant identity in Manage accounts after following the management identity check. The confirmation is distinct from verified email ownership.

## This release

New applications use form version 4, with an applicant-entered address for `/apply`. The application property foreign key becomes nullable through a validated startup migration. Application IDs, documents, review events, indexes, contacts, statuses, accounts, sessions, leases, and financial records are preserved. Startup fails instead of committing a migration that breaks foreign keys or changes application counts. New media/workspace/recovery/audit tables and fields are additive. Asset version is 13.

The app keeps its existing database path and disk. It never resets production data. Property photos, lease PDFs, identity documents, and private receipts are in SQLite and included in backups. Showcase inventory remains illustrative and independently deletable from staff dashboards; deleted showcase homes are not reseeded.

The build uses the existing `stripe` and `pdf-lib` runtime packages. New email and fee-based checkout are disabled by default even if old provider keys exist. Signed webhooks can still reconcile an earlier transaction. Nothing in this release enables external spending. Do not add provider keys for the free handover.

## Release and verification

1. Run `npm test` with Node.js 24 and Chromium. Tests use isolated databases and synthetic records, including legacy migration and downloaded-backup restoration.
2. Commit/push the release to `main`. The linked Render service can deploy automatically from this branch. Keep the existing disk and `DATABASE_PATH` through redeploys.
3. Check `/health` reports `status: ok` and the **exact pushed commit** in `revision`. Confirm Render reports the same commit live.
4. Check public `/`, `/login`, `/agents`, `/apply`, `/application-status`, and `/api/access-status`. The latter should report `emailEnabled: false` and `freeMode: true` with the default configuration. Unauthenticated private APIs must return 401 and `/dashboard` must redirect to `/login`.
5. Complete owner setup in the administrator's **Handover** dashboard. Review contacts, payment instructions, real inventory/photos, agent profiles, recovery-code custody, a private backup, a restoration rehearsal, and staff training. Technical health is separate from these acknowledgments.

Use staging for write-based acceptance checks: full rental application and income/ID uploads, private receipt/claim, property/photo creation, maintenance, lease/signature, rent records, and expenses. Do not submit fabricated identity documents or fake payments to production for verification.

See [the handover guide](docs/HANDOVER.md) for daily workflows and the backup/restore procedure, and [the release index](docs/RELEASE-50.md) for all 50 improvements. Backup downloads contain sensitive data and require an active administrator's current password. Store them privately; the app does not create offsite backups automatically.
