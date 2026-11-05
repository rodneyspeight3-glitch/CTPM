# Deploy to an existing Render web service

This app requires **Node.js 24**, one web service instance, and a persistent disk for the SQLite account/session database. Adding a persistent disk requires a paid Render service. Confirm the existing service and disk before changing settings; do not replace an unrelated app or its database. This repository intentionally does not include a Blueprint that would create a second service.

## Existing service settings

- Repository: `rodneyspeight3-glitch/main`, branch `main`.
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

## Release and verify

Only deploy after the persistent disk and environment variables are configured. Deploy the latest commit from the existing service's dashboard. Check `/health`, open `/login`, and sign in using the administrator account. Create a tenant and an agent, verify their role-specific landing pages, confirm neither can access `/api/admin/users`, and sign out. Requests to `/` without a session must redirect to `/login`.

Do not scale to multiple instances with this SQLite configuration. A shared managed database is needed for horizontal scaling. Do not point `DATABASE_PATH` at a pre-existing unrelated database. Redeploys must retain the same disk path.

## Remaining product integrations

Authentication and account management are real. Property inventory and pricing remain illustrative. Maintenance requests remain browser-local and are isolated by account; they are not sent to a management team. Payments, email password recovery, lease documents, and management messaging are not connected.
