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

## Open applications and receipts

`/apply` accepts any applicant-entered street address, even if management has not uploaded the property. Listed homes also have their own application entry points. Required answers include rental-history answers and the applicant's message; **other income and all pet information are optional**. Rental-history and additional document uploads are optional. Proof of income and government-issued photo ID are required. Credit is self-reported; the app does not pull credit or decide eligibility.

The confirmation supplies a reference plus a private status link, with copy/download/print controls. Save it privately. A reference alone cannot open a record. The secret link expires after 90 days; the database stores only its hash. Repeating a submission cannot overwrite or claim an earlier application and supplies a separate generic acknowledgment, without disclosing an existing application. Contact management to resolve duplicates.

A tenant can claim a new receipt in **My applications** using an account with the same email. This permits continued status tracking and requested-document uploads after the receipt expires. Confirmed resident identities can also see matching-email applications. An unconfirmed account does not gain access from knowing an applicant's email. Application documents stay staff-only, except the applicant can upload a requested response. Applicants can withdraw an open application; records and review history remain.

Staff can match an address application to an existing verified property. The original requested address remains on record. Matching does not create an inventory listing, confirm vacancy, approve an application, or reserve a home. Priority and follow-up dates are private organization tools, separate from applicant-facing status. Calendar exports are downloaded snapshots, not live subscriptions.

## Residents and daily work

- **Identity:** administrators can record In person, Phone and documents, or Known resident confirmation after completing the normal management identity check. Do not put ID numbers in notes. This is recorded separately from email ownership verification. Confirmed tenants can request viewings, receive matching-home alerts, and sign assigned lease PDFs without an email provider.
- **Maintenance:** residents submit server-saved repairs and private photos. Staff update the resident-facing status, assign contractors, and retain private work notes. Work-order PDFs preserve the same privacy boundary. Search by issue/address/resident and filter by property. Scheduled dates do not dispatch emergency assistance or promise an arrival window.
- **Team workspace:** create assigned tasks and preventive plans. An active due plan creates one staff task and advances the due date beyond today; missed months do not create a backlog flood. Checks run at startup, when plans change, and hourly. Plans do not submit tenant requests or book contractors. Pause a plan to stop future tasks.
- **Community:** staff publish pinned notices to everyone signed in, residents, staff, or a specific resident. Expired/archived notices are hidden from residents. These are dashboard notices, not public announcements or sent email.
- **Documents and signing:** residents see only their assigned lease PDFs. Read the original before typing the exact account name and consenting to sign. The original PDF hash, account identity basis, name, time, and consent are retained. Download the original and resident-signed PDF. Management signatures must already be in the original agreement. This is an electronic resident signature, not contract drafting or a certificate-based signature.
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

The owner selected mail.com SMTP for welcome and application-progress email. Follow [SMTP.md](SMTP.md) to configure the dedicated company mailbox. The company sender is visible; a personal mailbox is not concealed behind a display name or alias. This feature requires the mailbox's existing SMTP access and private password; the app does not buy a mail.com plan. Core in-app updates and recovery codes remain available without it.
