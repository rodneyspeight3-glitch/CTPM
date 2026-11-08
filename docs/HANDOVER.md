# Come Together: operating and handover guide

The app runs on the existing Render service at https://ctpm.onrender.com. Keep its current persistent disk and database path. No paid email, checkout, map, signing, or storage add-on is required. Render hosting and its disk remain the existing subscription; they are separate from app integrations.

## Start here

1. Sign in at `/login`. Tenants register on the same page. Agent and administrator accounts are created only by an administrator in **Manage accounts**.
2. Open **Management settings** and enter real management contacts and approved payment instructions. Confirm changed bank details directly with residents through your normal process.
3. In **My account**, generate and privately store recovery codes. Each code works once; using one to reset a password invalidates the entire set. Generate another set after resetting/changing a password. Administrators can assist other accounts through **Manage accounts** if no code is available.
4. Review **Agent profiles** before publishing public portraits, display names, and contact details. The login email is not automatically public.
5. Review **Property**. Existing illustrative homes can be edited or deleted. Properties with linked application, resident, or operational history must be archived. Deleted illustrative homes do not return on restart.
6. Use **Handover** to review database health, file storage, retention candidates, activity, and the owner acknowledgments. A passed database check does not mean the owner's contacts, policies, inventory, or training are complete.

## Properties and photos

Staff create a property with confirmed address, rent, rooms, size, description, and amenities. Choose **Verified property** and **Available** to publish it on the home page/dashboard/vacancies and accept applications. Showcase homes remain clearly illustrative and cannot take applications.

The editor accepts up to nine JPEG/PNG photos, 10 MB per source file. The browser resizes to at most 1600 pixels and compresses each upload below 1 MB. Choose a cover, caption, preview, reorder, or remove photos before saving. Metadata and the photos save in one database transaction; a failed photo cannot leave a half-created listing. Existing galleries retain at most eight images. **Gallery & video** supports additional uploads up to 2 MB each, ordering, cover promotion, and external YouTube/Vimeo links. Media follows the existing listing/resident access permissions.

The completeness indicator checks supplied fields and a real uploaded photograph; it is not an address verification or quality guarantee. Staff confirm listing accuracy themselves. Map links open OpenStreetMap only after a click, with no API key or background map requests.

**Agents in charge:** homes created by an agent automatically assign that agent. Administrators choose or change the assigned team in Add/Edit property, including multiple agents. Editing another agent's home preserves its assignments; regular agents cannot reassign homes. These assignments identify public responsibility while retaining the shared staff portfolio's existing access permissions. Agent names, portraits and contact links use only the admin-managed public profile, never the account's private login email or phone. Add public contact details in **Agent profiles** when appropriate.

Existing homes are assigned once using the recorded creator when that account is an agent. Admin-created homes and homes without a known agent creator show **Managed by the property team** until an administrator assigns them. The migration never restores assignments removed by an administrator. Inactive or role-changed agent accounts are hidden publicly and flagged in the staff editor; an administrator can remove them or choose an active replacement. Saving metadata, photos and agent selections is atomic. A failure to load agent options prevents the editor from saving an empty replacement team.

## Built-in property help

The **Property help** button opens curated site guidance and searches current public vacancies by bedroom count, rent ceiling, neighborhood, home name or assigned agent. It is not a generative AI service, a staff conversation or a private record lookup. Its quick topics cover required application documents, receipt tracking, sign-in, maintenance, payments and management contacts. It cannot approve an application, take a payment, send a message or dispatch emergency assistance. Use portal **Messages** for a management response.

Help fetches only the public listings and company contact settings. Questions are processed in the browser, stay in page memory and disappear on Clear chat or reload. There is no chat database, external AI provider, API key or subscription. Keep private details in the authorized forms. Detection removes obvious receipt secrets and passwords from displayed questions, but it is not a substitute for avoiding sensitive information in help. When listings cannot load, the guide offers navigation without inventing vacancy details. Keyboard close/focus, mobile layouts and the current day/night palette are supported.

## Open applications and receipts

`/apply` accepts any applicant-entered street address, even if management has not uploaded the property. Listed homes also have their own application entry points. Required answers include rental-history answers and the applicant's message; **other income and all pet information are optional**. Rental-history and additional document uploads are optional. Proof of income and government-issued photo ID are required. Credit is self-reported; the app does not pull credit or decide eligibility.

The confirmation supplies a reference plus a private status link, with copy/download/print controls. Save it privately. A reference alone cannot open a record. The secret link expires after 90 days; the database stores only its hash. Repeating a submission cannot overwrite or claim an earlier application and supplies a separate generic acknowledgment, without disclosing an existing application. Contact management to resolve duplicates.

A tenant can claim a new receipt in **My applications** using an account with the same email. This permits continued status tracking and requested-document uploads after the receipt expires. Confirmed resident identities can also see matching-email applications. An unconfirmed account does not gain access from knowing an applicant's email. Application documents stay staff-only, except the applicant can upload a requested response. Applicants can withdraw an open application; records and review history remain.

Staff can match an address application to an existing verified property. The original requested address remains on record. Matching does not create an inventory listing, confirm vacancy, approve an application, or reserve a home. Priority and follow-up dates are private organization tools, separate from applicant-facing status. Calendar exports are downloaded snapshots, not live subscriptions.

**Approve or reject:** both agents and administrators have **Approve** and **Reject** actions in Applications and inside the full review. Review the applicant's answers/documents, choose the decision, tick its confirmation and use **Confirm approval** or **Confirm rejection**. A stale review cannot overwrite newer staff work. Approval records management's decision and prepares a private lease draft; it does not create an account, active lease, charge or reservation or change property availability. In-app notices, My applications and the private receipt show the outcome; configured email sends the actual decision only to opted-in applicants. Staff notes, reviewer names and detailed review history remain staff-only.

Approved and Rejected have separate filters and leave the open-review total. Applicants cannot overwrite a completed decision by withdrawing it. To correct a completed, closed or withdrawn review, staff first save **Reviewing**, reopen the current record and then confirm the new decision. Prior decisions, staff accounts and timestamps remain in review history. Legacy **Closed** records retain that status and do not become approvals or rejections automatically. Email configuration and delivery pauses are preserved by this release.

## From approval to lease signing

1. Approval creates one private **Lease preparation** draft. Use **Continue to lease** after approving, **Prepare lease** on the application, or its card in **Leases**. Existing approvals receive private drafts on upgrade; existing lease records and signed documents are preserved.
2. Confirm the tenant account, verified property, address, dates, monthly rent and deposit. The account must use the application email. An open-address application needs an actual property selected before sending. A deposit is never inferred. Proposed dates come from the requested move-in and a recognizable month/year term; review them. No account or password is created automatically. Applicants can use tenant sign-up; administrators can create accounts through Manage accounts.
3. Choose **Generate from editable template** or **Upload my agreement PDF**. Company templates retain version history, and existing drafts keep their saved wording until staff load the latest template. Review the starter wording for the property's terms and local requirements. Only the listed placeholders are substituted. Applicant credit, income answers, supporting IDs and private staff notes are never copied into a lease automatically. Uploaded PDFs must be readable, unencrypted and at most 5 MB; their bytes and existing signatures are retained unchanged.
4. **Save draft** retains progress privately. **Preview saved agreement** downloads the saved version; generated previews are marked DRAFT. Review the saved terms/PDF and confirm that the recipient and lease details are correct, then use **Send lease & assign home**. This creates the lease record, removes the home from public vacancies, stores the agreement and creates one resident-signature request in one transaction. Repeated sends return the existing result. Failures leave no half-created lease, document or signing request. No rent charge or payment is created.
5. The tenant sees the lease in **Leases** and the request in **Lease signing**. Email ownership verification or an administrator's identity confirmation is required to e-sign. The original agreement, resident-signed PDF and signing evidence remain available under existing access controls. Management signatures are supplied separately; the app records the resident signature. Staff progress cards reflect signing, declining or withdrawing the request.

Once an agreement has been sent, its preparation is read-only. Manage additional PDFs, signing requests and the lease record through their existing pages. Changing an application decision does not cancel an already-sent agreement, void a signature or end a lease. An occupied home or an already-assigned tenant blocks another active lease. Draft terms and uploaded agreements stay in SQLite and are included in private backups; they are never placed in browser storage. No paid template, document or signing service is required.

## Residents and daily work

- **Identity:** administrators can record In person, Phone and documents, or Known resident confirmation after completing the normal management identity check. Do not put ID numbers in notes. This is recorded separately from email ownership verification. Confirmed tenants can request viewings, receive matching-home alerts, and sign assigned lease PDFs without an email provider.
- **Maintenance:** residents submit server-saved repairs and private photos. Staff update the resident-facing status, assign contractors, and retain private work notes. Work-order PDFs preserve the same privacy boundary. Search by issue/address/resident and filter by property. Scheduled dates do not dispatch emergency assistance or promise an arrival window.
- **Team workspace:** create assigned tasks and preventive plans. An active due plan creates one staff task and advances the due date beyond today; missed months do not create a backlog flood. Checks run at startup, when plans change, and hourly. Plans do not submit tenant requests or book contractors. Pause a plan to stop future tasks.
- **Community:** staff publish pinned notices to everyone signed in, residents, staff, or a specific resident. Expired/archived notices are hidden from residents. These are dashboard notices, not public announcements or sent email.
- **Documents and signing:** residents see only their assigned lease PDFs. Read the original before typing the exact account name and consenting to sign. The original PDF hash, account identity basis, name, time, and consent are retained. Download the original and resident-signed PDF. Generated PDFs use staff-reviewed company wording. Management signatures must be supplied separately or included in an uploaded agreement. The signing record identifies the resident's electronic signature.
- **Notifications:** category filters and Mark all read affect the current account only. Recovery, receipt tracking, signing, calendar exports, and notifications run without external providers.
- **Navigation:** Ctrl/Cmd+K searches authorized pages and loaded properties. Appearance in **My account** offers palettes, light/dark/system theme, reduced motion, and compact spacing. Only display preferences are stored in browser local storage. Help guides are searchable and role-specific.

## Rent, expenses, and reports

The app does not collect money in the default configuration. Residents follow approved **Rent & payments** instructions. Staff record payments after checking actual receipt outside the app. Ledger balances and downloadable receipts reflect entered and confirmed records, not automatic bank reconciliation. CSV exports and balance-summary PDFs follow the current user's permissions. Balance summaries are not legal notices or automatic debits.

Staff record paid expenses and attach up to five private PDF/JPEG/PNG receipts of 2 MB each. Attachment removal requires a reason and retains an audit record. Expense voids retain the original record. Reports filter dates/property, search expense text/category, compare monthly receipts/expenses, and export CSV/PDF. Refunds are separate from expenses; taxes, fees, and other costs must be recorded to appear. Review figures against bank statements before accounting use.

`ALLOW_PAID_INTEGRATIONS` defaults off, even when old provider keys exist. Keep it unset or `false` for this handover. Optional legacy Stripe/Resend code is retained to preserve history; it is not required or newly activated. Existing signed payment webhooks can reconcile previously created transactions. There is no paid geocoding, file host, electronic-signature service, SMS, or push service.

## Backup and restore

**Handover → Download consistent backup** requires the current active administrator's password. It uses Node SQLite's online backup API, then streams a private snapshot and removes its temporary server copy. The download contains accounts, identity documents, private photos, leases, signatures, conversations, and financial records. Store it privately in encrypted storage under the owner's access/retention policy. The app does not make offsite backups automatically.

Test restoration in a separate local/staging directory using Node.js 24:

1. Copy the downloaded snapshot to a private staging location. Do not use the production path or reuse production webhook/email credentials.
2. Open it with `node:sqlite` and run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`. Expect `ok` and no foreign-key rows. Confirm representative account/listing/file counts and a retained document.
3. Start the app with `NODE_ENV=test`, `PORT=3001`, `SEED_SHOWCASE_PROPERTIES=0`, `ALLOW_PAID_INTEGRATIONS=false`, `SMTP_ENABLED=false`, and `DATABASE_PATH` pointing to that staging copy. Keep it bound to a private test environment. Use existing test account credentials from that snapshot, not passwords in source control.
4. Check login, properties, an application and private file, a lease, and rent records. The backup is a point-in-time copy; new production edits are not in it.
5. Document who holds the backup and when restoration was tested. A production restore requires a maintenance window, a fresh backup of the current disk, a stopped app, and restoring the chosen SQLite file at the same path without stale `-wal`/`-shm` sidecars. Reopen and verify before resuming use. Never overwrite an unrelated database.

The automated restoration test opens a downloaded snapshot in a separate temporary directory and checks integrity, foreign keys, accounts, and retained attachment bytes. It does not replace the owner's recovery rehearsal.

## Release verification

Run `npm ci` and `npm test` with Node.js 24 and Chromium (`CHROMIUM_PATH` when needed). Tests use temporary databases, synthetic identities/documents, and local provider doubles. Production checks are read-only: `/health` must report the exact deployed Git revision; public home, shared login, Apply, Agents, and private-route protection must respond correctly. Never submit synthetic IDs, applications, payments, or accounts to production just to test a release.

See [RELEASE-50.md](RELEASE-50.md) for the feature index. Owner tasks still include accurate inventory/photos, contacts/payment instructions, approved lease/application and retention policies, recovery-code custody, backup custody/testing, and staff training. The app cannot supply these business decisions or real records automatically.

## Company SMTP update

Welcome and application-progress email supports personal Gmail with a Google app password, or an existing mail.com Premium mailbox. Follow [SMTP.md](SMTP.md). Keep delivery paused while changing providers or credentials. The selected sender address is visible; a display name does not conceal a personal mailbox. Gmail's outbox budget is 400 emails per rolling 24 hours, with pending messages retained when it is reached. No paid email plan is purchased. Core in-app updates and recovery codes remain available without it.
