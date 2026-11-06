# COME TOGETHER PROPERTY MANAGEMENT

A responsive property management app with one login for tenants, agents, and administrators. Includes server-enforced account roles, an administrator account directory, account creation, password changes, hashed passwords, and persistent expiring sessions.

Agents and admins can add properties with rent, address, bedroom/bathroom counts, square footage, and uploaded photos, a description, and amenity tags. Staff can mark each property available when adding it, and change availability later. The dashboard shows every available property and live portfolio, maintenance, and application totals. Tenants browse available properties, with showcase homes managed separately by staff. Tenants can submit maintenance requests saved to SQLite; agents and admins track requests and send resident-visible status updates.

## Public website and accounts

The public home page is `/` (also `/home`), with live vacancies, services, management contacts, and a dashboard-managed home collection. Only agents and administrators see **Add property**, inside their dashboard and portfolio. Public pages have no property-creation controls, and tenant requests to property-management APIs are rejected.

`/login` is one access page with **Sign in** and **Create tenant account** tabs, keyboard navigation, password visibility controls, and inline feedback. Existing `/signup` links redirect to `/login?mode=signup`; there is no second registration page. All roles sign in with email/password, and the server detects their role. Public registration always creates Tenant access, with password confirmation and acknowledgement of the displayed account data-use notice. Staff accounts remain administrator-created. Registration does not approve an application, reserve a home, or create a lease. Registered applicants can message management and apply for homes. Payment account details stay hidden for self-registered applicants until management assigns a lease. Resend-backed email verification and password recovery are available after the environment variables below are configured. Private applicant tracking, viewing bookings, rent checkout, and resident signing require a verified email. Existing accounts can continue to sign in and use their current records.

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
3. Review vacancy applications, then create the selected resident's account. In **Leases**, assign that tenant to a property with dates, rent, deposit, and resident-visible notes. Each property represents one rental home/unit and supports one active lease; each tenant account has one active lease. An active lease automatically removes its property from public vacancies. Upload existing signed agreements as private PDFs up to 5 MB; staff and the assigned tenant can download all uploaded versions. Use **Lease signing** to request an assigned resident’s electronic signature on an uploaded PDF. The original and resident-signed PDF are retained. The app does not draft legal contracts; include any required management signature in the original agreement.
4. In **Rent ledger**, staff add one rent charge per lease/month and record payments already received externally. Amounts use integer cents, including partial payments. Overpayments, duplicate monthly charges, and duplicate nonempty payment references are rejected. Voiding a mistaken recording requires a reason, preserves its history, and restores the balance; it does not refund money. Tenants see only their own ledger, can print a statement, download payment receipts, and use Stripe Checkout after provider setup. Pending online checkouts reserve the charge against duplicate manual entry. Unpaid checkouts can be cancelled after checking Stripe; processing bank payments remain pending until confirmation. Confirmed refunds and final lost chargebacks update the ledger. Overpayment or unresolved dispute events are flagged for review. Due dates and partial-month amounts follow the signed agreement; automatic recurring billing and proration are not enabled.
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

Each available property has the full rental application: contact details, current address, expected lease duration, move-in date, self-reported credit score, possible rent interruptions, household size, employment and income, landlord contacts and reason for leaving, eviction/bankruptcy history, pets, smoking, a management message, and accuracy/review/contact consent. All answers are required except **other income and pet information**. Only the rental-history and additional-document uploads are optional; the written rental-history answers remain required. New applications require a numeric self-reported credit score between 300 and 850. The form no longer offers an unknown-score option or suggests “None” or “N/A.” Earlier submissions retain their original answers. Credit scores are self-reported; the app does not obtain credit reports or make eligibility decisions.

A six-section completion guide tracks required answers, offers section shortcuts, and shows selected filenames and upload totals. Applicants can preview their answers before submitting. No application draft or supporting document is saved to browser storage.

Proof of income and government-issued photo ID must be uploaded through the dedicated document fields. Rental-history and additional documents are optional; landlord contact details are collected in the form. Files must be PDF, JPEG, or PNG, up to 2 MB each and five files total. The server checks type signatures, size, categories, required fields, origin, and submission rate before saving the application and files together. Files are not publicly served and are downloaded as attachments with private/no-store headers. Do not submit SSNs, bank/card details, or passwords; redact unrelated sensitive numbers where possible. No sensitive application draft is saved in browser storage.

Submissions and documents are stored in the existing persistent SQLite database. No fee, account, lease, reservation, or credit check is created. In-app status notifications are available to verified matching accounts; optional email updates follow provider configuration and the user’s preference. Unavailable properties reject submissions. Repeat submissions for the same property/email return the same acknowledgement without exposing or overwriting existing applicant details or adding documents. Earlier applications remain available and are identified as predating the expanded form.

Agents and admins use **Applications** to privately review the complete form, download supporting documents, search by name/email/phone/property, filter by status and property, sort by date, and save Submitted, Reviewing, Contacted, or Closed with a staff note. Pipeline cards show actual status totals. A private review timeline retains status/note changes and the staff account/time; the review form rejects stale saves when another staff member has changed the application. Earlier records begin tracking history with their next update. Tenants and unauthenticated visitors cannot read full staff application records or download their supporting documents. Verified tenants can view only matching-email application statuses and follow-up requests through My applications. Applications remain available to staff after a listing closes. Staff can permanently remove documents with a required reason; an audit record retains the category, staff account, reason, and time. Configure an appropriate document-retention policy and protect database backups because they also contain uploaded documents. Status changes and document requests produce in-app updates for verified matching accounts, with optional email delivery. Private staff-note changes do not notify applicants. Staff can still contact applicants directly; status changes never create tenant accounts.

## Management contact and payment details

Agents and administrators can update **Management settings** at any time. Save the company name, contact email/phone, payment heading, HTTPS payment portal link, account holder, bank/provider, account/reference details, and instructions. Contact information is public on the vacancies page. Payment details are shown only to signed-in users through **Rent & payments**. These fields store approved payment instructions. Integrated Stripe Checkout and private receipt downloads are separately available in Rent ledger when configured. Never store provider login passwords, card data, or API keys in these fields.

Changes are persistent in SQLite and recorded with the editing staff account and time. Settings controls wait for the latest load to finish, and delayed responses do not replace in-progress edits. A stale edit is rejected instead of overwriting another staff member's update; use **Reload saved settings** to load the current version. The **Contact management** buttons open saved email/phone links. Before contact or payment information has been saved, the app explains what is missing.

All portal pages have `/dashboard#page` links that survive reload and browser back/forward navigation. Staff-only pages are guarded in the UI and API. Notifications show current maintenance/application totals with links to the relevant pages. Resources contain expandable guidance. Signed lease PDFs are privately downloadable from Leases. Resend recovery and Stripe Checkout are configured through Render Environment; administrators can also reset access through Manage accounts.

## Brand and daily priorities

The shared visual design uses forest green, warm ivory, lime, and coral, with responsive cards, accessible focus indicators, and reduced-motion support. The original house-and-community logo is stored at `public/brand/come-together-mark.png` and used on the public home, login, listings, dashboards, and browser favicon. Shared styles live in `public/brand.css`.

Dashboard priorities use the current signed-in user’s records: urgent open maintenance, outstanding overdue charges, active leases ending in the next 60 days or already past their end date, and staff-only submitted applications. Each reminder opens the relevant page; these are in-app reminders, not automated email or renewal notices. The public home includes an expandable FAQ explaining applications, document privacy, accounts, and resident support.

## Validate

`npm test` starts isolated servers with temporary databases and randomized credentials. It verifies API authorization, incorrect-role denial, admin account creation, persistence across restart, session revocation, password changes, login rate limiting, cross-origin rejection, browser login for all roles, property creation, tenant request isolation, validation, maintenance status updates/cancellation, image loading, vacancy filtering, anonymous application submission, staff review, legacy schema migration, stale-listing rejection, duplicate handling, rate limiting, production startup/secure cookies, staff-managed payment settings, every page navigation/reload, leasing, private document/photo access, exact rent balances, partial payments and voids, account disabling/reset, private messaging, required/optional application rules, completion and answer preview, upload validation, private review history and stale-save protection, staff inbox filters, dashboard priorities, brand assets, FAQs, and responsive layouts. Test-only inventory fixtures include four available homes and an occupied property; no fixtures are inserted into production. Test databases and test users do not touch the application database.

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium binary.

## Deployment

See [RENDER.md](RENDER.md) for deploying to an **existing** Render service with persistent storage. Deployment needs access to the target service and configuration of its disk and bootstrap credentials. Do not deploy with an ephemeral account database.

## Product scope and assets

Dashboard-managed showcase homes remain separate from verified vacancies. Agents/admins manage real properties and resident records; public agent profiles and portraits are admin-managed. Resend email delivery and Stripe hosted payments require environment configuration. Automatic recurring billing, electronic contract drafting, SMS/push delivery, and emergency dispatch are not enabled. In-app resident signing applies to the uploaded agreement and retains original records.

Property images come from the public Bedimcode responsive real estate example: https://github.com/bedimcode/responsive-real-state-website/tree/main/assets/img. Replace them with company-owned photos before launch. Assets are served locally.

Agents and administrators use the **Property** navigation and breadcrumb; tenant navigation remains **Find a home**. Brand displays use Come Together Property Management. The old default company name is normalized on startup without changing saved contacts or payment details; custom company names are preserved.

## Resident and management services

- **Agents** on the home page and `/agents` lists every active agent. Admins alone manage public display names, titles, biographies, service areas, public contact details, and JPEG/PNG portraits up to 2 MB in **Agent profiles**. Account email addresses are not automatically public. Disabled agents disappear; an agent without a portrait uses initials.
- **Gallery & video** supports eight JPEG/PNG gallery photos per home (2 MB each), captions, and YouTube/Vimeo tour links. Public media follows listing availability; staff and assigned residents retain authorized access. **Compare** places up to three available properties side by side without storing sensitive application data.
- **Property viewings** lets staff create non-overlapping 15–120 minute slots. A verified tenant requests a slot; staff confirm, decline, complete, or cancel. Active slots cannot be double-booked. Confirmed appointments export to a private calendar file. Times display in the browser’s local time zone.
- **My applications** matches a verified tenant email to applications. Staff can request a follow-up document with instructions and an optional due date; only that applicant can upload a response. Requested files are PDF/JPEG/PNG up to 2 MB; a maximum of ten retained files per application includes follow-ups. Staff can remove old documents through the existing audited retention controls.
- **Contractors** stores private contacts, specialties, and workload summaries. **Maintenance → Photos & work details** supports five private JPEG/PNG photos per request (2 MB each), contractor assignments, scheduled-day calendar exports, and resident-visible status history. Residents see the company/trade/day, while private work notes and contractor contacts stay with staff.
- **Saved searches** retains ten private searches per tenant. Verified accounts can opt into matching-home alerts. Matching notifications run when property availability changes and during hourly checks. Email follows the account preference; alerts are deduplicated per search/property.
- **Financial reports** provides dated gross receipts, refunds/reversals, paid expenses, monthly cash movement, current outstanding/overdue balances, occupancy, and active rent roll, with CSV and PDF exports. Provider fees and taxes are not imported automatically; record them as paid expenses to include them. Paid expenses can be voided with a reason, never silently deleted. Monthly property budgets show spending and flag overruns.
- **My account** controls email verification, notification preferences, and active-session revocation. Changing a password revokes sessions; reset links expire in 30 minutes and verification links in 24 hours. Tokens are hashed in the token table, are single-use, and are invalidated by relevant account changes. Link tokens use URL fragments and are removed from the address bar by the access page.

## Connect Resend and Stripe

Use the existing Render service’s **Environment** settings. Do not put secret values in source control, chat, Management settings, or public agent profiles. **Service connections** is admin-only and reports configuration presence and delivery counts without exposing keys.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_APP_URL` | Exact canonical HTTPS origin, e.g. `https://ctpm.onrender.com`, without a path. Render’s `RENDER_EXTERNAL_URL` is the fallback. |
| `RESEND_API_KEY` | Resend API key for the verified sending domain. |
| `EMAIL_FROM` | Approved sender on that verified domain. |
| `STRIPE_SECRET_KEY` | Stripe secret key; use test-mode keys in staging first. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe endpoint below, matching the same Stripe mode/account. |

Create a Stripe webhook at `https://<your-app>/api/webhooks/stripe`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`. Stripe receives the original request bytes for signature verification. Unsigned/modified webhooks are rejected; duplicate and out-of-order events do not create duplicate rent payments or erase terminal payment state. Card and US bank payments use hosted Checkout in USD; the app never collects card or bank credentials. Return URL parameters cannot mark a bill paid. Refunds and dispute handling remain in Stripe, while confirmed reversals update the app records. Receipts and reports describe recorded payments, not automatic debits.

Delivery uses a persistent outbox checked every five seconds, with idempotency keys and retries. Verification/recovery links expire before delivery if delayed too long. Notification email is off by default and requires both verification and opt-in. Rent reminders (upcoming three days or overdue), lease end reminders (30 days), and budget/listing checks run hourly while the single service instance is running. In-app notifications are private to the user. Inbox conversations remain in the app; no SMS or push delivery is configured.

## Resident signature records

Staff select a readable, unencrypted PDF from an active lease. Signing snapshots the exact original, records its SHA-256 fingerprint, and binds the request to the assigned resident. The resident must verify email, review the document, type the account name, and explicitly consent to electronic signing. The server retains the original, signer name/email/time, consent version, and private connection/browser evidence, and appends a signature record to a downloadable resident-signed PDF. Only the assigned resident can sign; staff can withdraw requests and residents can decline. Duplicate or concurrently withdrawn requests cannot be signed twice. This records the resident signature only; it does not create a certificate-based digital signature or draft the agreement.

## Release validation

`npm test` includes isolated-provider tests for one-use/expired links, reset session revocation, notification opt-in/retries, signed Stripe events, delayed payment failure, refunds/chargebacks, checkout cancellation, and exact-document signing. The browser suite covers admin-managed Agents profiles and portraits, galleries/video/comparison, guest viewing links through login, bookings, follow-up uploads, maintenance photos/assignments/calendars, searches, reports/budgets/exports, resident signing, preferences, and responsive layouts. Provider tests use local doubles and artificial records; they do not charge cards or email real users. Live-provider setup still requires a test-mode verification in the owner’s Resend/Stripe accounts.
