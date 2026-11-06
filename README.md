# COME TOGETHER PROPERTY MANAGEMENT

A responsive property management app with one login for tenants, agents, and administrators. Includes server-enforced account roles, an administrator account directory, account creation, password changes, hashed passwords, and persistent expiring sessions.

Agents and admins can add properties with rent, address, bedroom/bathroom counts, square footage, and uploaded photos, a description, and amenity tags. Staff can mark each property available when adding it, and change availability later. The dashboard shows every available property and live portfolio, maintenance, and application totals. Tenants browse available properties, with showcase homes managed separately by staff. Tenants can submit maintenance requests saved to SQLite; agents and admins track requests and send resident-visible status updates.

## Public website and accounts

The public home page is `/` (also `/home`), with live vacancies, services, management contacts, and a dashboard-managed home collection. Only agents and administrators see **Add property**, inside their dashboard and portfolio. Public pages have no property-creation controls, and tenant requests to property-management APIs are rejected.

`/login` is one access page with **Sign in** and **Create tenant account** tabs, keyboard navigation, password visibility controls, and inline feedback. Existing `/signup` links redirect to `/login?mode=signup`; there is no second registration page. All roles sign in with email/password, and the server detects their role. Public registration always creates Tenant access, with password confirmation and acknowledgement of the displayed account data-use notice. Staff accounts remain administrator-created. Registration does not approve an application, reserve a home, or create a lease. Registered applicants can message management and apply for homes. Payment account details stay hidden for self-registered applicants until management assigns a lease. No email verification or automated email password recovery service is connected.

Successful sign-in opens `/dashboard`, with role-specific navigation and records. Existing root `/#page` bookmarks forward to `/dashboard#page`. Property applications remain available from the home page and `/vacancies` without an account.

## Manage the home collection

Six showcase homes are added to the actual property inventory once an administrator exists. Their names contain no demonstration labels. Agents and admins can see all of them in **Property**, filter the portfolio by Showcase homes, edit descriptions and amenities, upload photos, archive, or **Delete property**. Deletion has a confirmation dialog, removes an unlinked home's photo and public collection card, and survives restarts without reseeding. Properties with linked leases, applications, maintenance, or saved-home records must be archived to preserve history.

Showcase homes are display-only concepts with unconfirmed details and illustrative pricing. They cannot accept applications, be assigned leases, or be marked Available directly. To replace one with a real listing, edit it, enter the verified address and details, select **Verified property**, and set availability. Up to 12 amenities and a 3000-character description can be added to any listing. Properties already linked to active leases cannot become showcase homes.

The one-time migration `showcase-inventory-v1` prevents deleted homes returning after deployment. Existing properties and accounts are not overwritten; existing same-name properties are left untouched. `SEED_SHOWCASE_PROPERTIES=0` disables initial showcase insertion for clean installations; deleting existing collection homes is managed from the dashboard. Test fixtures normally disable seeding and dedicated collection tests explicitly enable it.

## Finding and saving homes

The home page, vacancies directory, and portal portfolio support bedroom and maximum-rent filters plus sorting by newest, rent, or property name. Clear filters resets the search. Each real available property has public details with its address, photograph, rent, room counts, application action, and a shareable `/vacancies?listing=<id>` link. Closed listings stop accepting applications and no longer load public details.

Tenants can use **Save home** on available portal listings and revisit **Saved homes** from their own dashboard. Shortlists are stored per account in SQLite. Saving twice does not duplicate a home. When a listing closes, the saved card is marked unavailable and keeps only the previously public snapshot; it does not reveal later private edits. Tenants can remove saved homes at any time. Staff use their management portfolio rather than a tenant shortlist.

## Daily workflow

1. Sign in through the shared email/password login; the stored role selects your dashboard. Admins create resident and agent accounts in **Manage accounts** and can edit names, emails, roles, reset temporary passwords, or disable accounts. Account changes that affect access revoke existing sessions. The current administrator cannot remove their own administrator access; residents with active leases must have those leases ended before disabling or changing their role.
2. Agents/admins add or edit properties in **Property**, upload a JPEG/PNG photo (up to 1 MB), and mark vacant homes Available. Vacancies appear on the dashboard and public application page. Archive/restore keeps property history without deleting applications or financial records. Archived properties and actively leased properties cannot be published as vacancies. Showcase homes are display-only and never accept applications.
3. Review vacancy applications, then create the selected resident's account. In **Leases**, assign that tenant to a property with dates, rent, deposit, and resident-visible notes. Each property represents one rental home/unit and supports one active lease; each tenant account has one active lease. An active lease automatically removes its property from public vacancies. Upload existing signed agreements as private PDFs up to 5 MB; staff and the assigned tenant can download all uploaded versions. The app records agreements but does not generate legal contracts or provide electronic signatures.
4. In **Rent ledger**, staff add one rent charge per lease/month and record payments already received externally. Amounts use integer cents, including partial payments. Overpayments, duplicate monthly charges, and duplicate nonempty payment references are rejected. Voiding a mistaken recording requires a reason, preserves its history, and restores the balance; it does not refund money. Tenants see only their own ledger and can print a statement. Due dates and partial-month amounts follow the signed agreement; automatic recurring billing and proration are not enabled.
5. Residents submit maintenance and send private **Messages**. Staff can start a conversation with an active resident, reply, and close conversations. A new reply reopens the thread. Messages and updates stay in the portal; no external email or text is sent. The tenant dashboard shows the assigned home, lease, and outstanding rent.
6. Keep company contacts and approved payment instructions current in **Management settings**. End a lease when appropriate; balances and documents remain available. Ending a lease does not automatically relist the home—staff choose when to make it Available again.

All operational records, uploaded photos, and lease PDFs are stored in the same persistent SQLite database. Existing users, properties, applications, and requests are preserved by additive migrations.

## Develop

Requires Node.js 24. Install with `npm ci`, then run `npm start`. The server listens on port 3000, or `PORT` when set. No runtime packages are needed.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely in the process environment on the first start to create an administrator. Passwords must be 16–128 characters. No default or public demo account is created. Prospective tenants register through the Create tenant account tab on `/login`; staff access is never granted by public registration. `DATABASE_PATH` defaults to `.data/app.sqlite`; never commit this database. Production requires an initialized administrator or bootstrap values. The app does not automatically load `.env` files.

Open `/login` and sign in with your email and password. Only administrators can create users in **Manage accounts**. All users can change their password in **My account**; doing so revokes their sessions. Sign-out revokes the current session. Sessions expire after eight hours. Production cookies use Secure, HttpOnly, and SameSite=Lax attributes. Login attempts are rate limited.

## Properties and maintenance

Agents and administrators use **Property → Add property**. Administrators use **Manage accounts → Create agent** to create agent access; tenants and agents cannot create accounts. All agents and administrators share the property portfolio, leasing, ledger, messaging, and maintenance workspaces.

Tenants use **Maintenance → New request** to provide their address/unit, category, priority, description, and optional property reference. Requests start as Submitted. Staff can mark them In progress or Completed and leave a resident-visible update. Tenants see only their own requests and can cancel while Submitted. Status filters and Refresh requests keep the queue easy to review. Updates are checked on navigation or refresh; email/push notifications and emergency dispatch are not configured.

New tables are created automatically in the existing SQLite database on startup without replacing accounts or sessions. Keep the same persistent `DATABASE_PATH` on Render. Older browser-local demo requests are not imported automatically; tenants should submit real requests through the new form. No permanent demonstration accounts are created. Showcase inventory is initialized once and is managed by staff.

## Vacancy applications

All existing tenants, agents, and admins continue to sign in at `/login`. Prospective tenants can follow **Browse vacancies and apply** there or open `/vacancies` without an account. Only properties explicitly marked Available appear on the dashboard and public vacancies page. Staff see unavailable properties in their portfolio and can use **Mark available / Mark unavailable**. Existing properties migrate as Unavailable so staff can choose which addresses to publish.

Each available property has the full rental application: contact details, current address, expected lease duration, move-in date, self-reported credit score (or unknown), possible rent interruptions, household size, employment and income, landlord contacts and reason for leaving, eviction/bankruptcy history, pets, smoking, an optional message, and accuracy/review/contact consent. Employment and rental-history fields accept N/A when not applicable. Credit scores are self-reported; the app does not obtain credit reports or make eligibility decisions.

Proof of income and government-issued photo ID must be uploaded through the dedicated document fields. Rental-history and additional documents are optional; landlord contact details are collected in the form. Files must be PDF, JPEG, or PNG, up to 2 MB each and five files total. The server checks type signatures, size, categories, required fields, origin, and submission rate before saving the application and files together. Files are not publicly served and are downloaded as attachments with private/no-store headers. Do not submit SSNs, bank/card details, or passwords; redact unrelated sensitive numbers where possible. No sensitive application draft is saved in browser storage.

Submissions and documents are stored in the existing persistent SQLite database. No fee, account, lease, reservation, credit check, or confirmation email is created. Unavailable properties reject submissions. Repeat submissions for the same property/email return the same acknowledgement without exposing or overwriting existing applicant details or adding documents. Earlier applications remain available and are identified as predating the expanded form.

Agents and admins use **Applications** to privately review the complete form, download supporting documents, filter by status, and save Submitted, Reviewing, Contacted, or Closed with a staff note. Tenants and unauthenticated visitors cannot read applications or download their documents. Applications remain available to staff after a listing closes. Staff can permanently remove documents with a required reason; an audit record retains the category, staff account, reason, and time. Configure an appropriate document-retention policy and protect database backups because they also contain uploaded documents. Staff must contact applicants directly; status changes do not send notifications or create tenant accounts.

## Management contact and payment details

Agents and administrators can update **Management settings** at any time. Save the company name, contact email/phone, payment heading, HTTPS payment portal link, account holder, bank/provider, account/reference details, and instructions. Contact information is public on the vacancies page. Payment details are shown only to signed-in users through **Rent & payments**. This stores and displays instructions; payments and receipts remain with the linked provider. Never store provider login passwords, card data, or API keys in these fields.

Changes are persistent in SQLite and recorded with the editing staff account and time. Settings controls wait for the latest load to finish, and delayed responses do not replace in-progress edits. A stale edit is rejected instead of overwriting another staff member's update; use **Reload saved settings** to load the current version. The **Contact management** buttons open saved email/phone links. Before contact or payment information has been saved, the app explains what is missing.

All portal pages have `/dashboard#page` links that survive reload and browser back/forward navigation. Staff-only pages are guarded in the UI and API. Notifications show current maintenance/application totals with links to the relevant pages. Resources contain expandable guidance. Signed lease PDFs are privately downloadable from Leases. Email recovery and external payment processing remain separate integrations; administrators can reset access through Manage accounts.

## Validate

`npm test` starts isolated servers with temporary databases and randomized credentials. It verifies API authorization, incorrect-role denial, admin account creation, persistence across restart, session revocation, password changes, login rate limiting, cross-origin rejection, browser login for all roles, property creation, tenant request isolation, validation, maintenance status updates/cancellation, image loading, vacancy filtering, anonymous application submission, staff review, legacy schema migration, stale-listing rejection, duplicate handling, rate limiting, production startup/secure cookies, staff-managed payment settings, every page navigation/reload, leasing, private document/photo access, exact rent balances, partial payments and voids, account disabling/reset, private messaging, and responsive layouts. Test-only inventory fixtures include four available homes and an occupied property; no fixtures are inserted into production. Test databases and test users do not touch the application database.

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium binary.

## Deployment

See [RENDER.md](RENDER.md) for deploying to an **existing** Render service with persistent storage. Deployment needs access to the target service and configuration of its disk and bootstrap credentials. Do not deploy with an ephemeral account database.

## Product scope and assets

Dashboard-managed showcase homes are displayed separately from available vacancies and can be edited or deleted by staff. Management-created properties and maintenance requests are stored on the server. Staff can upload actual property photos; otherwise illustrations are used. Agents/admins configure contact and payment instructions in Management settings. Payment processing and receipts are handled by the linked provider. Email password recovery, electronic signatures, automatic recurring billing, and email/push notifications are not configured. Resident messaging works inside the portal.

Property images come from the public Bedimcode responsive real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace them with company-owned photos before launch. Assets are served locally.

Agents and administrators use the **Property** navigation and breadcrumb; tenant navigation remains **Find a home**. Brand displays use Come Together Property Management. The old default company name is normalized on startup without changing saved contacts or payment details; custom company names are preserved.
