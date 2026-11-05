# COME TOGETHER PROPERTY MANAGEMENT LLC

A responsive property management app with one login for tenants, agents, and administrators. Includes server-enforced account roles, an administrator account directory, account creation, password changes, hashed passwords, and persistent expiring sessions.

The resident experience includes searchable sample listings, property details, resources, and browser-local maintenance requests isolated by account.

## Develop

Requires Node.js 24. Install with `npm ci`, then run `npm start`. The server listens on port 3000, or `PORT` when set. No runtime packages are needed.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely in the process environment on the first start to create an administrator. Passwords must be 16–128 characters. No default or public demo account is created. `DATABASE_PATH` defaults to `.data/app.sqlite`; never commit this database. Production requires an initialized administrator or bootstrap values. The app does not automatically load `.env` files.

Open `/login`, select your assigned account type, and sign in. Only administrators can create users in **Manage accounts**. All users can change their password in **My account**; doing so revokes their sessions. Sign-out revokes the current session. Sessions expire after eight hours. Production cookies use Secure, HttpOnly, and SameSite=Lax attributes. Login attempts are rate limited.

## Validate

`npm test` starts isolated servers with temporary databases and randomized credentials. It verifies API authorization, incorrect-role denial, admin account creation, persistence across restart, session revocation, password changes, login rate limiting, cross-origin rejection, browser login for all roles, maintenance flows, image loading, and responsive layouts. Test databases and test users do not touch the application database.

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium binary.

## Deployment

See [RENDER.md](RENDER.md) for deploying to an **existing** Render service with persistent storage. Deployment needs access to the target service and configuration of its disk and bootstrap credentials. Do not deploy with an ephemeral account database.

## Product scope and assets

Listings, locations, and pricing are sample data. Maintenance remains local to the browser and is not delivered to management. Payments, email password recovery, company contact information, lease documents, and message delivery are not configured. Connect these services and replace sample inventory before offering those features to residents.

Property images come from the public Bedimcode responsive real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace them with company-owned photos before launch. Assets are served locally.
