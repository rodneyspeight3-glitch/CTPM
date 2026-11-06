# COME TOGETHER PROPERTY MANAGEMENT LLC

A responsive property management app with one login for tenants, agents, and administrators. Includes server-enforced account roles, an administrator account directory, account creation, password changes, hashed passwords, and persistent expiring sessions.

Agents and admins can add properties with rent, address, bedroom/bathroom counts, square footage, and an illustrative photo. Staff can mark each property available when adding it, and change availability later. The dashboard shows every available property and live portfolio, maintenance, and application totals. Tenants browse available properties alongside clearly marked sample listings. Tenants can submit maintenance requests saved to SQLite; agents and admins track requests and send resident-visible status updates.

## Develop

Requires Node.js 24. Install with `npm ci`, then run `npm start`. The server listens on port 3000, or `PORT` when set. No runtime packages are needed.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely in the process environment on the first start to create an administrator. Passwords must be 16–128 characters. No default or public demo account is created. `DATABASE_PATH` defaults to `.data/app.sqlite`; never commit this database. Production requires an initialized administrator or bootstrap values. The app does not automatically load `.env` files.

Open `/login`, select your assigned account type, and sign in. Only administrators can create users in **Manage accounts**. All users can change their password in **My account**; doing so revokes their sessions. Sign-out revokes the current session. Sessions expire after eight hours. Production cookies use Secure, HttpOnly, and SameSite=Lax attributes. Login attempts are rate limited.

## Properties and maintenance

Agents and administrators use **Find a home → Add property**. Administrators use **Manage accounts → Create agent** to create agent access; tenants and agents cannot create accounts. All agents and administrators share the property portfolio and maintenance queue.

Tenants use **Maintenance → New request** to provide their address/unit, category, priority, description, and optional property reference. Requests start as Submitted. Staff can mark them In progress or Completed and leave a resident-visible update. Tenants see only their own requests and can cancel while Submitted. Status filters and Refresh requests keep the queue easy to review. Updates are checked on navigation or refresh; email/push notifications and emergency dispatch are not configured.

New tables are created automatically in the existing SQLite database on startup without replacing accounts or sessions. Keep the same persistent `DATABASE_PATH` on Render. Older browser-local demo requests are not imported automatically; tenants should submit real requests through the new form. No permanent demo users or properties are seeded.

## Vacancy applications

All existing tenants, agents, and admins continue to sign in at `/login`. Prospective tenants can follow **Browse vacancies and apply** there or open `/vacancies` without an account. Only properties explicitly marked Available appear on the dashboard and public vacancies page. Staff see unavailable properties in their portfolio and can use **Mark available / Mark unavailable**. Existing properties migrate as Unavailable so staff can choose which addresses to publish.

Each available property has an application form for name, email, phone, preferred move-in date, household size, an optional message, and contact consent. Submissions are saved in SQLite. No fee, account, lease, or reservation is created, and no confirmation email is sent. Do not collect SSNs, bank details, or identity documents through the message field. The server rejects applications to unavailable properties, validates fields and origin, rate limits submissions, and treats repeat applications for the same property/email as the same submission without exposing or overwriting existing applicant details.

Agents and admins use **Applications** to privately review applicant contact details, filter by status, and save Submitted, Reviewing, Contacted, or Closed with a staff note. Tenants and unauthenticated visitors cannot read applications. Applications remain available to staff after a listing closes. Staff must contact applicants directly; status changes do not send notifications or create tenant accounts.

## Validate

`npm test` starts isolated servers with temporary databases and randomized credentials. It verifies API authorization, incorrect-role denial, admin account creation, persistence across restart, session revocation, password changes, login rate limiting, cross-origin rejection, browser login for all roles, property creation, tenant request isolation, validation, maintenance status updates/cancellation, image loading, vacancy filtering, anonymous application submission, staff review, legacy schema migration, stale-listing rejection, duplicate handling, rate limiting, and responsive layouts. Test-only inventory fixtures include four available homes and an occupied property; no fixtures are inserted into production. Test databases and test users do not touch the application database.

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium binary.

## Deployment

See [RENDER.md](RENDER.md) for deploying to an **existing** Render service with persistent storage. Deployment needs access to the target service and configuration of its disk and bootstrap credentials. Do not deploy with an ephemeral account database.

## Product scope and assets

Three sample listings remain clearly marked. Management-created properties and maintenance requests are stored on the server. Listing photos are illustrations. Payments, email password recovery, company contact information, lease documents, general inquiry delivery, and email/push notifications are not configured.

Property images come from the public Bedimcode responsive real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace them with company-owned photos before launch. Assets are served locally.
