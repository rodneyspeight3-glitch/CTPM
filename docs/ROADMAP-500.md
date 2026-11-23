# Prioritized 500-feature roadmap

Prepared November 23, 2026 for the existing Come Together Property Management app.

**Status: proposal, not 500 shipped features.** The owner requested a roadmap first. Every item below is a proposed, separately reviewable outcome. No roadmap entry enables a service, changes production data or promises legal compliance. Existing functionality is the baseline, not counted as a new addition: merged sign-in/signup, applications and receipts, staff decisions, editable/uploaded leases, private applicant signing, property/agent management, maintenance, ledger, messaging, local-time themes, private organizers, staff workflow boards, help chat, combined PDFs and first-open lease alerts already exist.

Items extend those workflows or introduce a new workflow. Confirm the exact gap against current code and tests before implementation; merge overlapping proposals if that review finds an existing equivalent. The Spacemail preset delivered alongside this document is separate from this future inventory.

## Delivery order

| Priority | IDs | Outcomes | Release approach |
|---|---|---|---|
| P0 | F001–F080 | Trust, access, recovery and email operations | Resolve verified issues first; pilot recovery and security changes in isolation. |
| P1 | F081–F260 | Applications, leases, properties, maintenance, money records and communications | Ship one tested vertical workflow at a time. |
| P2 | F261–F440 | Media, viewings, moving, staff tools, accessibility, visual polish, languages and reporting | Group related changes into small reviewed releases. |
| P3 | F441–F500 | Owner oversight, mobile capability and scale preparation | Reassess demand and architecture before starting. |

The IDs express priority groups, not estimates or a promise that all 500 are approved for immediate development. Within a group, dependencies can change the order. Suggested first slice: F001–F005 and F061–F064 after the reported SSL warning is understood; then F081, F092, F124 and F145 for the leasing workflow. Start visual work with F381–F383 once the operational slice is stable.

## Boundaries and acceptance

Keep the existing Render service and persistent disk. Do not buy external add-ons, start trials or provision another service. Prefer built-in browser/server capabilities and open-source libraries with reviewed licenses. Existing Spacemail access still depends on the owner's mailbox plan. No paid payment gateway, commercial AI, SMS, map or background-check dependency is assumed. Financial proposals record or prepare management actions; they do not move money. Operational checks are not compliance certifications. Lease wording, decisions and notices require qualified company review.

All roles and owner access shown below are intended audiences, not new permissions already granted. Owner access is a future, explicitly scoped role. Tenant dashboards continue to exclude vacancy browsing. Private applicant links, distinct applicants at one address, document access rules, current statuses, optional application fields, reduced-motion choices and verified contrast must remain intact.

For each implemented item: define its data and permission boundary; deliver the complete user action with useful empty/error states; test the behavior and unauthorized access where relevant; check mobile, keyboard, day/night and reduced-motion use; document migration and recovery effects; verify the deployed revision. No fabricated reviews, unverified listings or invented completion metrics. Sensitive offline storage, external delivery and new role access need explicit review of the concrete implementation before activation. Do not count a button, color or duplicated export format as a separate completed feature merely to reach a number.

The CSV companion contains the same 500 IDs for filtering and planning. All entries begin as **Proposed**; only mark an item delivered with a release reference and acceptance evidence.


## Security and domain trust · P0

Audience: Admin.


- **F001 — TLS expiry watch:** show certificate renewal risk with the checked hostname and timestamp.

- **F002 — DNS drift watch:** flag website records that stop pointing to the approved Render service.

- **F003 — Domain alias inventory:** track every approved host and its intended redirect destination.

- **F004 — Canonical-link audit:** find email and PDF links that still use a retired website address.

- **F005 — Security-header report:** explain missing headers on each public entry route.

- **F006 — Content-policy diagnostics:** summarize blocked resources without collecting private page content.

- **F007 — Dependency review inbox:** track affected packages, mitigations and completed upgrades.

- **F008 — Security contact publication:** maintain a company-approved security.txt contact and policy.

- **F009 — Public incident banner:** publish verified service incidents with an expiry and resolution update.

- **F010 — Account freeze control:** suspend a compromised account and invalidate its outstanding capabilities together.

- **F011 — Sensitive-action timeline:** review credential, permission and document-access events in one filtered view.

- **F012 — Incident casebook:** record investigation ownership, evidence references and recovery steps.

- **F013 — Security review sign-off:** require dated reviewer confirmation before a release is marked ready.

- **F014 — Approved-link inventory:** let staff review externally linked company resources before publication.

- **F015 — Upload quarantine workflow:** hold suspicious file types for staff review instead of publishing them.

- **F016 — Content-type mismatch report:** expose rejected upload reasons without retaining malicious payloads.

- **F017 — Rate-limit tuning console:** adjust bounded endpoint limits with preview and an audit trail.

- **F018 — Security configuration history:** compare public security settings before and after an authorized change.

- **F019 — Domain cutover rehearsal:** generate a checklist from the current website and email DNS inventory.

- **F020 — Trust troubleshooting report:** download redacted browser, hostname and connection diagnostics for support.



## Account access and privacy · P0

Audience: All roles.


- **F021 — Authenticator-based two-factor login:** enroll TOTP with recovery and a verified setup challenge.

- **F022 — Passkey enrollment:** register and remove device passkeys with clear account recovery options.

- **F023 — New-device approval:** require an existing trusted session to approve a new device when enabled.

- **F024 — Session security digest:** summarize unfamiliar sign-ins without exposing session tokens.

- **F025 — Trusted-device expiry:** automatically retire remembered devices under an administrator-defined maximum.

- **F026 — Step-up authentication:** challenge before downloading sensitive applicant identity documents.

- **F027 — Temporary staff access:** grant permissions that expire at an explicit time.

- **F028 — Role permission editor:** define bounded staff capabilities beyond the three default roles.

- **F029 — Property-scoped permissions:** restrict selected staff to explicitly assigned properties.

- **F030 — Permission preview:** show which records a proposed staff role can access before saving.

- **F031 — Two-person role escalation:** require a second administrator to approve high-privilege changes.

- **F032 — Dormant staff review:** flag inactive staff accounts for an administrator's decision.

- **F033 — Account closure workflow:** let residents request closure and track management's response.

- **F034 — Personal-data correction queue:** route resident correction requests to the responsible staff member.

- **F035 — Privacy request tracker:** assign deadlines and record completion of access or deletion requests.

- **F036 — Purpose-based document access:** require a reason for exceptional access to identity attachments.

- **F037 — Document access receipts:** show authorized staff who opened or downloaded each protected document.

- **F038 — Privacy delegation register:** record an applicant's time-limited authorization for a representative.

- **F039 — Consent wording versions:** retain the exact approved notice accepted at submission.

- **F040 — Shared-device sign-out mode:** clear account-specific browser drafts and temporary previews on logout.



## Backup and data recovery · P0

Audience: Admin.


- **F041 — Restore rehearsal wizard:** restore a backup into an isolated validation database.

- **F042 — Backup completeness manifest:** list database and key-file requirements without including key material.

- **F043 — Restore compatibility report:** compare backup schema and application version before importing.

- **F044 — Recovery drill history:** record test restores, reviewer findings and recovery duration.

- **F045 — Backup age reminders:** flag when the owner has not confirmed a recent protected backup.

- **F046 — Backup checksum verification:** compare downloaded and restored database digests.

- **F047 — Disk capacity forecast:** estimate remaining space using actual upload growth.

- **F048 — Storage allocation policies:** set per-category limits with alerts before uploads are blocked.

- **F049 — Application retention rules:** stage eligible records for review under an owner-approved policy.

- **F050 — Retention exception holds:** exclude named records from deletion while a hold remains active.

- **F051 — Deletion impact preview:** list related records affected before a retention action is approved.

- **F052 — Two-person bulk deletion:** require independent approval for sensitive retention batches.

- **F053 — Deleted-record evidence ledger:** retain minimal deletion metadata without keeping deleted documents.

- **F054 — Migration rehearsal reports:** exercise pending schema changes against a copy before release.

- **F055 — Schema downgrade readiness:** document which releases can safely read the current backup.

- **F056 — Read-only recovery mode:** allow authorized review while writes are deliberately paused.

- **F057 — Corruption response guide:** generate recovery steps from the detected database error class.

- **F058 — Storage cleanup preview:** identify orphaned media references before a reviewed cleanup.

- **F059 — Document integrity sweeps:** flag missing or altered blobs using stored checksums.

- **F060 — Recovery contact rotation:** remind owners to review authorized recovery contacts and custody.



## SMTP and delivery operations · P0

Audience: Admin.


- **F061 — Per-message delivery timeline:** show queue, retry and provider acceptance events together.

- **F062 — Sender configuration checklist:** track mailbox access, authorized sender and DNS checks separately.

- **F063 — Domain authentication diagnostics:** check SPF, DKIM selector and DMARC with dated results.

- **F064 — Provider quota controls:** set a conservative rolling budget for any SMTP provider.

- **F065 — Outbound preview mailbox:** render redacted templates before enabling delivery.

- **F066 — Scheduled delivery windows:** hold routine notices outside recipient-preferred hours.

- **F067 — Email template versioning:** review and restore approved transactional wording.

- **F068 — Template test-data preview:** substitute synthetic values without sending an external email.

- **F069 — Sender change approval:** require confirmation of the visible address before activating new credentials.

- **F070 — Credential rotation reminders:** track the owner's last confirmed SMTP password rotation date.

- **F071 — Provider migration rehearsal:** verify new login separately before replacing the active configuration.

- **F072 — Outbox batch impact preview:** count eligible pending messages before email is enabled.

- **F073 — Recipient suppression manager:** review suppression reasons without exposing message bodies.

- **F074 — Recipient correction workflow:** reverify a corrected mailbox before resuming private notifications.

- **F075 — Email locale routing:** choose an approved template using the recipient's saved language.

- **F076 — Configurable digest delivery:** combine eligible routine notifications into one opted-in summary.

- **F077 — Delivery incident worksheet:** collect sanitized provider error classes for support.

- **F078 — Mailbox ownership verification:** confirm a sender mailbox through a one-time owner-approved challenge.

- **F079 — Unsubscribe preference center:** separate optional reminder types while preserving transactional necessities.

- **F080 — Delivery export redaction:** export aggregate acceptance and failure counts without recipient addresses.



## Application workspace · P1

Audience: Applicant and staff.


- **F081 — Multi-person application groups:** link co-applicants while keeping each person's private answers separate.

- **F082 — Household invitation controls:** let an applicant revoke an unused co-applicant invitation.

- **F083 — Application draft resume links:** resume a server-saved draft without exposing answers in the URL.

- **F084 — Draft expiry warnings:** notify applicants before an abandoned draft is removed.

- **F085 — Cross-device draft recovery:** continue an authenticated draft from another device.

- **F086 — Field-level revision history:** show staff which answers changed after a correction request.

- **F087 — Applicant correction rounds:** reopen only requested fields while preserving the original submission.

- **F088 — Address normalization review:** propose a standardized address without silently replacing applicant input.

- **F089 — Unlisted-address triage:** assign an open-address application to the correct staff queue.

- **F090 — Unit clarification requests:** ask an applicant to resolve an ambiguous unit number privately.

- **F091 — Duplicate household review:** flag likely duplicates without automatically rejecting anyone.

- **F092 — Submission readiness summary:** show missing answers and documents in one linked review panel.

- **F093 — Save-before-upload recovery:** preserve typed answers when a document transfer fails.

- **F094 — Application transfer wizard:** move a request to another available property with applicant consent.

- **F095 — Application intake windows:** display and enforce owner-defined opening and closing times.

- **F096 — Withdraw-and-reapply links:** start a new request while retaining the withdrawn record's history.

- **F097 — Applicant representative contacts:** record an authorized helper without granting full account access.

- **F098 — Conditional question editor:** configure reviewed follow-up questions using non-discriminatory criteria.

- **F099 — Application receipt reissue:** replace a lost private receipt while invalidating its old token.

- **F100 — Intake exception log:** record staff-approved deviations without changing required fields globally.



## Applicant documents · P1

Audience: Applicant and staff.


- **F101 — Multipart resumable uploads:** continue a large permitted document after a connection interruption.

- **F102 — Upload progress estimates:** show bytes sent and an accessible completion state.

- **F103 — Phone document capture:** capture a document with an alignment guide before upload.

- **F104 — Local image cropping:** let applicants crop document margins before private submission.

- **F105 — Client-side size reduction:** shrink document photographs while showing a readable preview.

- **F106 — Page-order editor:** arrange uploaded pages before creating a document bundle.

- **F107 — Attachment category reassignment:** correct a mistaken document label with an audit note.

- **F108 — Versioned replacements:** retain the submitted original when a replacement is requested.

- **F109 — Expiry-date tracking:** flag documents whose recorded validity needs staff review.

- **F110 — Document completeness checklist:** review required pages independently from file presence.

- **F111 — Redacted review copies:** create staff-approved copies with selected sensitive areas obscured.

- **F112 — Redaction verification view:** confirm hidden data is removed from the exported copy.

- **F113 — Applicant download inventory:** list which of their own submitted files remain available.

- **F114 — Document request bundles:** request several missing categories in one clear checklist.

- **F115 — Document deadline extensions:** record and communicate an approved extension per request.

- **F116 — Protected zip export:** create a password-protected handover archive with separately shared credentials.

- **F117 — PDF page bookmarks:** navigate directly to each supporting document in the combined application PDF.

- **F118 — PDF attachment cover sheets:** explain omitted or embedded-only pages in the combined export.

- **F119 — Document checksum receipt:** provide a digest confirming the exact submitted file version.

- **F120 — External document import review:** let staff attach an applicant-authorized file with its provenance.



## Application review and decisions · P1

Audience: Agent and admin.


- **F121 — Custom review stages:** configure staff-approved intermediate stages without changing public decision meanings.

- **F122 — Reviewer assignment rules:** route intake by property responsibility and current workload.

- **F123 — Second-review requests:** assign another staff member before a final decision.

- **F124 — Decision sign-off chains:** require an administrator for selected decision categories.

- **F125 — Review deadline policies:** calculate follow-up targets from received and corrected dates.

- **F126 — Queue aging board:** group applications by time since their last meaningful review.

- **F127 — Missing-information blockers:** distinguish waiting for staff from waiting for the applicant.

- **F128 — Structured review checklists:** use a versioned company checklist for consistent evaluations.

- **F129 — Decision reason library:** maintain reviewed reason wording without automated eligibility scoring.

- **F130 — Applicant-visible reason preview:** approve the wording that will appear in the decision notice.

- **F131 — Adverse-action preparation worksheet:** collect required review information for qualified staff approval.

- **F132 — Review conflict declarations:** let staff record a conflict and transfer responsibility.

- **F133 — Decision reconsideration intake:** let applicants request a documented management review.

- **F134 — Appeal review assignments:** separate the reconsideration reviewer from the original reviewer.

- **F135 — Decision correction workflow:** record why a mistaken outcome was changed.

- **F136 — Approval expiry rules:** show a clear expiration only when management has explicitly set one.

- **F137 — Offer acceptance tracking:** record whether an applicant accepted management's offer before leasing.

- **F138 — Review handoff notes:** summarize pending actions for the next authorized reviewer.

- **F139 — Fairness audit exports:** compare process timing using permitted operational data without protected-trait scoring.

- **F140 — Bulk follow-up preparation:** draft individualized requests for staff review without bulk approving applications.



## Lease drafting and negotiation · P1

Audience: Agent and admin.


- **F141 — Clause library versioning:** maintain approved reusable clauses with author and review date.

- **F142 — Jurisdiction review register:** record company review of wording for each supported state.

- **F143 — Local addendum catalog:** attach reviewed city or county addenda separately from state wording.

- **F144 — Lease variable validator:** catch unresolved placeholders before PDF generation.

- **F145 — Draft comparison view:** highlight changes between two saved lease versions.

- **F146 — Per-clause comments:** discuss a draft privately before it is sent.

- **F147 — Approval-required clauses:** route changes to sensitive wording to an administrator.

- **F148 — Tenant-name reconciliation:** compare lease parties with the chosen application record.

- **F149 — Property-address reconciliation:** highlight discrepancies without replacing approved terms automatically.

- **F150 — Rent schedule builder:** model dated rent changes for staff approval.

- **F151 — Proration worksheet:** calculate a transparent proposed partial-month amount.

- **F152 — Deposit schedule builder:** list approved deposit installments separately from rent.

- **F153 — Utility responsibility matrix:** show which party is responsible for each service.

- **F154 — Included-item schedule:** attach a reviewed inventory of furnishings and equipment.

- **F155 — Pet addendum preparation:** generate a reviewed draft from explicitly supplied pet details.

- **F156 — Parking addendum preparation:** describe the assigned space and approved terms.

- **F157 — Lease renewal comparison:** compare current and proposed terms before sending a renewal.

- **F158 — Lease amendment workflow:** preserve the signed original while preparing an amendment.

- **F159 — Negotiation response tracker:** record requested changes without altering a sent document silently.

- **F160 — Draft readiness gate:** require a named staff reviewer before publishing an invitation.



## Lease invitations and signing · P1

Audience: Applicant and staff.


- **F161 — Multiple signer sequencing:** invite co-signers in a staff-defined order.

- **F162 — Co-signer private access:** expose only the agreement and information each signer is authorized to see.

- **F163 — Management countersigning:** let an authorized manager countersign in the app.

- **F164 — Signature field placement:** position named signature and initial fields on uploaded PDFs.

- **F165 — Per-page initials:** require explicitly configured initials with keyboard-accessible alternatives.

- **F166 — Signer role labels:** distinguish tenant, guarantor and authorized management signatures.

- **F167 — Signer progress matrix:** show staff which named signatures remain outstanding.

- **F168 — Invitation resend preview:** explain whether a resend preserves or replaces the private link.

- **F169 — Invitation expiry editor:** allow bounded expiry dates before the agreement is sent.

- **F170 — Invitation access limits:** pause an invitation after repeated invalid confirmation attempts.

- **F171 — Signer correction requests:** let recipients flag incorrect names or terms before signing.

- **F172 — Signing deferral notes:** let a recipient request more review time without accepting terms.

- **F173 — Accessible agreement text:** attach a staff-reviewed text version alongside the exact PDF.

- **F174 — Signature drawing option:** offer an accessible optional drawing pad alongside typed signatures.

- **F175 — Signing consent versions:** retain the exact electronic-signing disclosure accepted.

- **F176 — Agreement checksum display:** show the document digest in the signing evidence summary.

- **F177 — Completed agreement notification:** inform each authorized signer once all required parties finish.

- **F178 — Signing package export:** bundle the final PDF, consent and event evidence for staff.

- **F179 — Superseded invitation warnings:** explain why an older draft link can no longer be signed.

- **F180 — Applicant link-access history:** show staff repeated opens without exposing other applicants' activity.



## Property inventory operations · P1

Audience: Agent and admin.


- **F181 — Bulk property import preview:** validate spreadsheet rows before creating listings.

- **F182 — Import error downloads:** return rejected rows with precise correction guidance.

- **F183 — Duplicate property resolution:** merge approved duplicates without losing their application references.

- **F184 — Building-and-unit hierarchy:** group units under a shared building record.

- **F185 — Availability scheduling:** publish a vacancy at a staff-selected date and time.

- **F186 — Listing expiry reminders:** request a review before stale inventory remains public.

- **F187 — Publish review workflow:** let agents draft listings for administrator approval.

- **F188 — Listing change comparison:** preview public-facing changes before publishing.

- **F189 — Per-property publication history:** record who changed a listing and when.

- **F190 — Property-specific contact routing:** choose the responsible contact for each listing.

- **F191 — Temporary agent coverage:** assign a backup agent for an explicit date range.

- **F192 — Agent reassignment batches:** transfer selected properties with an impact preview.

- **F193 — Availability conflict warnings:** flag conflicting listing and active-lease dates for review.

- **F194 — Unit readiness gates:** keep a listing unpublished until approved preparation tasks are complete.

- **F195 — Verified-fact review dates:** remind staff to reconfirm factual listing attributes after defined review periods.

- **F196 — Property amenity dictionaries:** maintain consistent approved amenity names and filters.

- **F197 — Accessibility attribute review:** publish measured accessibility facts with a last-reviewed date.

- **F198 — Listing disclaimer versions:** retain the approved wording shown with each public listing.

- **F199 — Archived property restoration preview:** show dependencies before a property is restored.

- **F200 — Property activity timeline:** connect listing, assignment and lease changes in a dated staff-only history.



## Maintenance coordination · P1

Audience: Resident and staff.


- **F201 — Multi-issue request splitting:** divide one submission into separately assigned work orders.

- **F202 — Related-issue linking:** group recurring problems while preserving each resident's private request.

- **F203 — Resident availability proposals:** offer several access windows to management.

- **F204 — Access permission expiry:** record time-limited entry consent and its revocation.

- **F205 — Appointment rescheduling proposals:** request a new time without overwriting a confirmed visit.

- **F206 — Maintenance priority review:** require staff confirmation before priority escalations change scheduling.

- **F207 — Response target policies:** set operational targets by category with visible overdue reasons.

- **F208 — Out-of-hours guidance editor:** publish reviewed non-emergency instructions by property.

- **F209 — Resident satisfaction follow-up:** collect private feedback after a completed repair.

- **F210 — Repair verification checklist:** require recorded completion checks before closing selected work orders.

- **F211 — Reopen-with-reason workflow:** preserve the original closure when a problem returns.

- **F212 — Material requirements list:** track needed supplies per approved job.

- **F213 — Labor time entries:** record technician time against a work order.

- **F214 — Repair cost estimates:** compare an approved estimate with recorded actual costs.

- **F215 — Maintenance warranty follow-up:** flag repairs that return within a recorded warranty window.

- **F216 — Recurring request patterns:** summarize repeated equipment issues for staff review.

- **F217 — Resident update commitments:** show the next promised management update time.

- **F218 — Blocked work reasons:** distinguish access, parts, approval and contractor delays.

- **F219 — Scheduled resident notices:** prepare reviewed disruption notices for affected households.

- **F220 — Work-order completion packet:** export authorized photos, findings, costs and sign-off together.



## Rent records and reconciliation · P1

Audience: Resident and staff.


- **F221 — Opening balance import:** preview historical balances before posting a controlled adjustment.

- **F222 — Payment allocation editor:** apply a received payment across selected eligible charges.

- **F223 — Overpayment credit ledger:** record unapplied funds without inventing a refund.

- **F224 — Credit allocation history:** show when existing credit was applied to a charge.

- **F225 — Reconciliation worksheets:** compare bank references with recorded receipts manually.

- **F226 — Bank statement import review:** match uploaded rows without connecting to a paid banking service.

- **F227 — Possible duplicate receipts:** warn staff about matching amount, date and reference combinations.

- **F228 — Charge correction proposals:** require a reason before correcting a posted charge.

- **F229 — Adjustment approval thresholds:** require administrator review above a configured amount.

- **F230 — Recorded refund workflow:** document an actual refund and its supporting reference.

- **F231 — Payment plan drafts:** propose installments for explicit staff and resident review.

- **F232 — Installment progress tracking:** compare recorded receipts against an agreed payment plan.

- **F233 — Resident balance disputes:** open a private review tied to a specific ledger entry.

- **F234 — Dispute resolution evidence:** record the decision and approved ledger correction separately.

- **F235 — Security deposit subledger:** distinguish deposit custody from rent income.

- **F236 — Deposit deduction worksheet:** prepare itemized proposals for qualified management review.

- **F237 — Deposit return tracking:** record actual return dates and payment references.

- **F238 — Late-fee policy review:** preview a reviewed policy's effects before any charge is posted.

- **F239 — Financial period locking:** prevent ordinary edits to an administrator-closed period.

- **F240 — Reopened-period audit:** require a reason and record every change after a period is reopened.



## Resident and applicant communications · P1

Audience: All roles.


- **F241 — Message assignment queues:** route incoming conversations to the responsible staff member.

- **F242 — Conversation handoff summaries:** preserve context when responsibility changes.

- **F243 — Read receipts with privacy controls:** show appropriate receipt status for authorized participants.

- **F244 — Scheduled message drafts:** hold a reviewed portal message until its chosen release time.

- **F245 — Reusable reply snippets:** maintain administrator-approved answers with editable personalization.

- **F246 — Sensitive text warnings:** flag likely passwords or ID numbers before a user sends a message.

- **F247 — Document request conversation links:** connect a request to its authorized discussion thread.

- **F248 — Conversation topic tags:** organize cases without publishing internal labels to applicants.

- **F249 — Escalation routing:** let a resident request another management review of a conversation.

- **F250 — Staff absence routing:** send incoming work to a named backup during an absence.

- **F251 — Message translation drafts:** allow a human-reviewed parallel translation without paid translation APIs.

- **F252 — Announcement targeting preview:** show the exact audience before a notice is published.

- **F253 — Announcement expiry dates:** remove outdated notices automatically while retaining staff history.

- **F254 — Acknowledgement-required notices:** track who explicitly acknowledged an operational notice.

- **F255 — Urgent notice distinction:** explain that portal notices are not emergency dispatch.

- **F256 — Notification quiet hours:** defer optional alerts according to each account's preferences.

- **F257 — Weekly portal digest:** show a consolidated in-app summary of permitted updates.

- **F258 — Notification category controls:** let residents mute optional topics while preserving required records.

- **F259 — Notification delivery history:** explain whether an update stayed in-app or entered the email queue.

- **F260 — Conversation closure reasons:** record why a thread closed and how to reopen the issue.



## Property photography and media · P2

Audience: Agent and admin.


- **F261 — Drag-and-drop batch photos:** upload several images with individual progress and failure handling.

- **F262 — Bulk caption review:** revise and approve captions across existing gallery images before publication.

- **F263 — Photo alt-text review:** require meaningful descriptions for informative listing images.

- **F264 — Room-based galleries:** organize photographs by named rooms or property areas.

- **F265 — Image focal-point controls:** choose the visible subject when card crops are generated.

- **F266 — Automatic image variants:** serve appropriate dimensions for mobile cards and desktop galleries.

- **F267 — Photo privacy review:** flag visible personal details for manual cropping or blurring before publication.

- **F268 — Original-photo provenance:** retain a private upload attribution and rights confirmation.

- **F269 — Image replacement history:** restore a prior listing image without reuploading it.

- **F270 — Scheduled gallery releases:** publish a reviewed gallery revision at a selected time.

- **F271 — Photo duplicate detection:** flag identical images within a property gallery.

- **F272 — Cross-property photo warnings:** prompt staff when the same image appears on unrelated listings.

- **F273 — Image quality checks:** flag unusually small or unreadable listing photographs.

- **F274 — Floor-plan media category:** distinguish a supplied floor plan from property photographs.

- **F275 — Floor-plan text alternative:** describe the layout for visitors who cannot view the image.

- **F276 — Accessible gallery keyboard map:** support named room navigation and clear position announcements.

- **F277 — Side-by-side media review:** compare a proposed photograph with the current published version.

- **F278 — Media usage inventory:** identify which active pages use an uploaded photograph.

- **F279 — Public image attribution:** publish required credits without exposing private uploader information.

- **F280 — Media storage planner:** estimate gallery storage before a large upload batch is accepted.



## Property viewings · P2

Audience: Applicant and staff.


- **F281 — Recurring viewing availability:** generate bounded time slots from a weekly staff schedule.

- **F282 — Viewing buffer rules:** leave configurable travel and preparation time between appointments.

- **F283 — Agent schedule conflict detection:** reject overlapping confirmed viewing assignments.

- **F284 — Property blackout dates:** prevent appointments during owner-defined unavailable periods.

- **F285 — Waitlist for full viewings:** offer an explicit place when a slot reaches capacity.

- **F286 — Waitlist promotion offers:** give the next eligible visitor a time-limited opening.

- **F287 — Guest viewing registration:** allow a verified private invitation without requiring a tenant account.

- **F288 — Household attendee lists:** add approved attendees without exposing another household's details.

- **F289 — Viewing reconfirmation requests:** let staff ask whether a visitor still plans to attend.

- **F290 — Self-service rescheduling:** move a booking within the property's published rules.

- **F291 — Cancellation reason tracking:** collect an optional reason without preventing cancellation.

- **F292 — No-show review queue:** distinguish an unconfirmed absence from an actual recorded no-show.

- **F293 — Viewing check-in codes:** confirm attendance using a short-lived booking-specific code.

- **F294 — Accessible viewing requirements:** let a visitor privately request an accommodation.

- **F295 — Viewing preparation packets:** share approved access, parking and meeting information privately.

- **F296 — Post-viewing feedback forms:** collect factual visitor feedback for authorized staff.

- **F297 — Agent viewing notes:** keep staff observations separate from applicant-visible feedback.

- **F298 — Viewing conversion reports:** compare attended appointments with subsequent applications.

- **F299 — Multi-property tour plans:** prepare a visitor-approved sequence with individual confirmations.

- **F300 — Calendar cancellation updates:** export cancelled-event updates with stable calendar identifiers.



## Move-in and move-out experience · P2

Audience: Resident and staff.


- **F301 — Resident move-in checklist:** publish a staff-approved checklist tied to the actual lease.

- **F302 — Household task sharing:** let authorized household members divide non-sensitive move-in tasks.

- **F303 — Key handover acknowledgements:** capture who received each recorded access item.

- **F304 — Move-in condition photos:** collect resident observations tied to rooms and dates.

- **F305 — Condition disagreement workflow:** record management and resident responses without overwriting either.

- **F306 — Utility activation confirmations:** let residents record completed arrangements without storing credentials.

- **F307 — Move-day arrival windows:** coordinate a confirmed arrival time with staff capacity.

- **F308 — Elevator booking requests:** manage available move-day reservations for configured buildings.

- **F309 — Loading-area reservations:** request a defined loading slot with management approval.

- **F310 — Welcome packet assembly:** combine property-specific approved resources for a new household.

- **F311 — Emergency contact review:** ask residents to confirm their private contact details periodically.

- **F312 — Resident orientation acknowledgements:** record that approved operational instructions were viewed.

- **F313 — Address-change checklist:** guide a departing resident through optional practical tasks.

- **F314 — Notice-to-vacate intake:** record a resident's submitted notice for management review.

- **F315 — Move-out appointment selection:** propose walkthrough windows separately from the final lease date.

- **F316 — Pre-move-out condition review:** document optional preparation findings without automatic charges.

- **F317 — Forwarding address collection:** store a departing resident's address with restricted access.

- **F318 — Key return evidence:** record item counts and a receipt for the returning household.

- **F319 — Move-out completion summary:** provide a private checklist of resolved and outstanding actions.

- **F320 — Post-move-out follow-up:** collect optional private feedback after the tenancy closes.



## Contractors and purchasing · P2

Audience: Agent and admin.


- **F321 — Contractor insurance expiry:** track a supplied policy's dates and pending staff review.

- **F322 — Contractor document vault:** retain authorized compliance paperwork with restricted access.

- **F323 — Vendor approval workflow:** require an administrator before a new contractor becomes assignable.

- **F324 — Vendor service coverage:** record service types and explicit geographic coverage.

- **F325 — Contractor availability calendar:** store staff-confirmed availability without external booking software.

- **F326 — Job bid invitations:** prepare scoped requests for selected approved contractors.

- **F327 — Bid comparison worksheets:** compare itemized quotes using consistent quantities and tax treatment.

- **F328 — Purchase request attachments:** attach supporting quotes to the approval record.

- **F329 — Purchase change orders:** review material scope or cost changes after approval.

- **F330 — Receiving discrepancy reports:** record missing or damaged items against an approved request.

- **F331 — Supplier return records:** track an actual return and its expected credit.

- **F332 — Contractor work acceptance:** record staff approval separately from the contractor's completion claim.

- **F333 — Vendor performance notes:** summarize factual outcomes without publishing unverified reviews.

- **F334 — Conflict-of-interest declarations:** record a staff relationship before approving a vendor.

- **F335 — Contractor contact change review:** require verification before altering sensitive payment instructions.

- **F336 — Purchase approval delegation:** nominate a time-limited alternate administrator approver.

- **F337 — Spend commitment report:** total approved unreceived requests separately from actual expenses.

- **F338 — Work authorization PDFs:** generate a reviewed scope document without sending an order automatically.

- **F339 — Vendor offboarding checklist:** resolve outstanding work before a contractor is deactivated.

- **F340 — Supplier catalog references:** maintain approved supply descriptions without storing payment credentials.



## Staff coordination · P2

Audience: Agent and admin.


- **F341 — Team availability board:** show declared working hours and temporary absence coverage.

- **F342 — Handoff checklist templates:** define the information required when transferring a staff case.

- **F343 — Cross-workflow dependencies:** block a task until its named prerequisite is completed.

- **F344 — Workload capacity planning:** compare assigned deadlines with declared staff availability.

- **F345 — Saved staff queue views:** share approved filters within a permitted team.

- **F346 — Pinned operational dashboards:** arrange selected live workflow summaries per staff account.

- **F347 — Multi-record assignment preview:** show affected records before a bulk handoff.

- **F348 — Daily stand-up summaries:** collect staff-entered priorities and blockers in one private view.

- **F349 — Meeting action capture:** turn approved meeting notes into assigned operational tasks.

- **F350 — Decision register:** record management decisions with rationale and related records.

- **F351 — Staff onboarding plans:** assign a role-specific training path without granting extra permissions.

- **F352 — Training acknowledgement history:** record completion against the exact resource version.

- **F353 — Staff offboarding preview:** identify properties and open cases requiring reassignment.

- **F354 — Temporary responsibility cover:** route new work during a declared absence and restore routing afterward.

- **F355 — Internal escalation policies:** define bounded follow-up steps for overdue staff work.

- **F356 — Review workload balancing:** suggest reassignment without moving records automatically.

- **F357 — Workspace terminology editor:** set approved labels without changing API status semantics.

- **F358 — Team operating procedures:** maintain versioned internal guides linked to workflows.

- **F359 — Procedure review reminders:** flag guides that have passed their next owner review date.

- **F360 — Operational handover packets:** export selected authorized tasks and pending actions for a replacement manager.



## Accessibility and inclusive use · P2

Audience: All roles.


- **F361 — Accessible form error summary:** link every failed field from one announced submission summary.

- **F362 — Screen-reader workflow audits:** record keyboard and announcement results for critical journeys.

- **F363 — Persistent caption preferences:** show text alternatives for all instructional media when provided.

- **F364 — Dyslexia-friendly reading profile:** offer a reviewed typography preset with no paid fonts.

- **F365 — Reduced cognitive-load mode:** simplify secondary actions without hiding required information.

- **F366 — Keyboard-only gallery controls:** expose all image functions without hover or dragging.

- **F367 — Accessible PDF tagging review:** track whether exported documents contain a logical reading order.

- **F368 — Form instruction audio:** provide optional browser-generated reading of selected instructions.

- **F369 — Plain-language glossary editor:** let management approve explanations for leasing terminology.

- **F370 — Accommodation request routing:** privately assign and track access-related support requests.

- **F371 — Accessible appointment alternatives:** provide a clearly labeled way to request another booking method.

- **F372 — Forced-color compatibility:** preserve meaningful boundaries in operating-system high-contrast modes.

- **F373 — Text-spacing resilience:** keep forms usable with user-defined spacing overrides.

- **F374 — Touch-target audit overlay:** identify controls below the chosen accessibility target size.

- **F375 — Zoom reflow checks:** verify essential workflows at large text and browser zoom levels.

- **F376 — Focus restoration safeguards:** return focus to the initiating control after dynamic panels close.

- **F377 — Accessible drag alternatives:** provide move-up and move-down actions wherever drag ordering is offered.

- **F378 — Error wording library:** maintain specific instructions instead of color-only error states.

- **F379 — Accessibility feedback intake:** let visitors report an issue and receive a private reference.

- **F380 — Public accessibility statement:** publish verified capabilities, known limitations and a contact route.



## Visual polish and joyful interactions · P2

Audience: All roles.


- **F381 — Seasonal accent themes:** offer optional professionally reviewed palettes without changing contrast guarantees.

- **F382 — Company brand palette editor:** preview and publish approved company colors with enforced contrast checks.

- **F383 — Interactive scene details:** reveal optional illustration details through both pointer and keyboard controls.

- **F384 — Welcome postcard builder:** create an optional personalized printable greeting with locally bundled artwork.

- **F385 — Neighborhood illustration packs:** use locally bundled scenes unrelated to actual listing availability.

- **F386 — Weather-neutral scene rotation:** vary decorative skies by local time without location tracking.

- **F387 — Room inspiration moodboards:** save local design ideas without treating them as property photographs.

- **F388 — Home-care learning challenges:** offer optional seasonal quizzes with reviewed practical explanations.

- **F389 — Resident welcome customization:** display a person's chosen greeting rather than assuming their name preference.

- **F390 — Dashboard widget arrangement:** reorder nonessential panels with a keyboard-friendly editor.

- **F391 — Compact dashboard mode:** reduce decorative spacing while retaining readable forms.

- **F392 — First-visit guided tours:** explain role-permitted controls with skip, restart and keyboard navigation.

- **F393 — Progress journey maps:** show factual completed milestones without implying an approval outcome.

- **F394 — Optional keyboard discovery tips:** introduce one relevant shortcut at a time with dismissal memory.

- **F395 — Celebration replay controls:** let users replay or disable a harmless completed-task animation.

- **F396 — Community photo submissions:** moderate owner-authorized neighborhood images before publication.

- **F397 — Opt-in community bulletin:** publish reviewed local events without exposing resident membership lists.

- **F398 — Resident idea board:** collect private suggestions and publish only approved non-identifying summaries.

- **F399 — Micro-interaction sound preferences:** keep optional sounds off by default and independently controllable.

- **F400 — Design consistency gallery:** let staff review approved buttons, states and typography before releasing changes.



## Language and time handling · P2

Audience: All roles.


- **F401 — Full interface translation catalog:** maintain versioned human-reviewed strings instead of translating only dates.

- **F402 — Account language preference:** synchronize a chosen interface language across devices.

- **F403 — Guest language negotiation:** offer supported languages without overwriting an explicit visitor choice.

- **F404 — Missing-translation reports:** identify untranslated strings before publishing a language pack.

- **F405 — Translation preview mode:** review a proposed language pack without changing production visitors' language.

- **F406 — Right-to-left layout support:** mirror navigation while preserving numbers, addresses and document orientation.

- **F407 — Named time-zone override:** let visitors explicitly choose a zone separate from their device setting.

- **F408 — Appointment dual-zone display:** show both property time and the visitor's selected time zone.

- **F409 — Daylight-saving conflict warnings:** flag nonexistent or duplicated local appointment times.

- **F410 — Date-only deadline rules:** distinguish a local calendar date from a timestamp in every scheduling workflow.

- **F411 — Property time-zone registry:** record the zone used for each property's appointments.

- **F412 — Multilingual lease companion notes:** attach reviewed explanations without altering the controlling agreement.

- **F413 — Localized email subject previews:** check length and fallback behavior in each supported language.

- **F414 — Locale-aware numeric input:** accept reviewed decimal separators without silently changing the amount.

- **F415 — Unit preference conversion:** display square meters alongside the original square-foot measurement.

- **F416 — Translated form error messages:** preserve field links and meaningful instructions in each supported language.

- **F417 — Language-specific resource libraries:** show only reviewed documents for the chosen language.

- **F418 — Interpreter request notes:** record a visitor's requested support without machine-generated legal advice.

- **F419 — Localized search synonyms:** match approved multilingual amenity terms against the same factual inventory.

- **F420 — Time-zone change audit:** record changes to staff-defined property zones affecting future appointments.



## Reporting and planning · P2

Audience: Agent and admin.


- **F421 — Portfolio period comparisons:** compare equivalent reporting periods with an explicit data cutoff.

- **F422 — Property income drill-down:** trace each reported amount to its authorized ledger source.

- **F423 — Expense allocation reports:** show how shared recorded costs were assigned to properties.

- **F424 — Maintenance response distributions:** report median and percentile timings rather than only averages.

- **F425 — Application stage duration reports:** measure time spent in each recorded stage.

- **F426 — Listing exposure intervals:** report actual published vacancy durations excluding paused periods.

- **F427 — Viewing funnel analysis:** connect booking, attendance and application milestones using permitted records.

- **F428 — Agent workload trends:** show assigned work and resolution counts without public staff rankings.

- **F429 — Recurring repair cost reports:** compare repeated equipment repairs with recorded replacement estimates.

- **F430 — Data quality dashboards:** identify missing references and inconsistent operational dates.

- **F431 — Report definition catalog:** document the formulas and exclusions behind each metric.

- **F432 — Saved report layouts:** retain approved filters and columns for recurring staff reports.

- **F433 — Scheduled in-app report snapshots:** generate bounded summaries without emailing sensitive attachments.

- **F434 — Report annotation notes:** record known exceptions alongside a reporting period.

- **F435 — Report comparison exports:** include current and prior values with formula-safe spreadsheets.

- **F436 — Forecast scenario workbooks:** model owner-entered assumptions separately from actual receipts.

- **F437 — Vacancy scenario planning:** estimate operational effects without predicting applicant eligibility.

- **F438 — Budget revision history:** compare approved budget versions and their explanations.

- **F439 — Report access scoping:** apply property-specific staff permissions to every report source.

- **F440 — Report reproducibility references:** save the filter, schema version and generation time for a snapshot.



## Owner oversight · P3

Audience: Admin and invited owner.


- **F441 — Owner identity records:** maintain separate ownership entities without granting resident data access.

- **F442 — Property ownership shares:** record effective-dated ownership percentages for reporting review.

- **F443 — Owner contact authorization:** verify which representative may receive a property's summary.

- **F444 — Restricted owner portal:** expose approved summaries without applicant identity documents.

- **F445 — Owner statement preparation:** assemble a reviewed period statement from recorded transactions.

- **F446 — Statement review workflow:** require management approval before an owner can view it.

- **F447 — Statement correction notes:** retain the original version alongside an approved correction.

- **F448 — Owner document sharing:** publish selected files through expiring authenticated access.

- **F449 — Owner approval requests:** request a decision on a proposed property project.

- **F450 — Approval spending limits:** route planned work according to documented owner authorization.

- **F451 — Owner decision deadlines:** track promised response dates and internal follow-up.

- **F452 — Owner distribution records:** record an actual transfer without initiating a bank payment.

- **F453 — Owner reserve planning:** compare an agreed reserve target with recorded balances.

- **F454 — Management fee worksheets:** calculate proposed fees for staff review before posting.

- **F455 — Ownership change checklist:** review contacts, documents and approvals before a transfer takes effect.

- **F456 — Owner announcement preferences:** choose which optional portfolio updates to receive.

- **F457 — Owner dispute intake:** track questions about a statement or recorded expense privately.

- **F458 — Annual owner review packs:** assemble approved operational summaries and pending decisions.

- **F459 — Owner access expiry:** automatically end an invited representative's authorization at a set time.

- **F460 — Ownership audit history:** record reviewed changes to property ownership and sharing permissions.



## Mobile and progressive app experience · P3

Audience: All roles.


- **F461 — Install eligibility guidance:** explain browser-specific installation only when the app meets requirements.

- **F462 — Offline public help pack:** cache approved public guidance without storing private documents.

- **F463 — Connection-aware upload recovery:** pause and resume permitted uploads when connectivity returns.

- **F464 — Low-data media mode:** load smaller public images without hiding factual listing content.

- **F465 — Native file share support:** share an authorized downloaded file through the device's share sheet.

- **F466 — Mobile document scanning flow:** guide page capture, review and upload in one accessible sequence.

- **F467 — Bottom navigation personalization:** pin a small set of role-permitted mobile destinations.

- **F468 — Safe-area layout support:** keep primary controls clear of device cutouts and browser chrome.

- **F469 — Viewport keyboard resilience:** keep form actions reachable while the mobile keyboard is open.

- **F470 — Mobile PDF reading controls:** provide clear zoom, page and download actions for authorized PDFs.

- **F471 — Device-local draft consent:** ask before storing any sensitive offline draft.

- **F472 — Offline draft encryption:** protect opted-in drafts with a user-held unlock secret.

- **F473 — Shared-device draft cleanup:** remove opted-in offline drafts after an explicit account switch.

- **F474 — Reconnect change preview:** show pending local edits before syncing them to the server.

- **F475 — App update readiness prompts:** offer a refresh after unsaved work is protected.

- **F476 — Capability-based fallbacks:** explain when capture, sharing or installation APIs are unavailable.

- **F477 — Portrait and landscape audits:** verify each critical flow with rotation and large text.

- **F478 — Mobile upload queue controls:** cancel individual pending transfers without losing completed ones.

- **F479 — Public page prefetch budget:** warm likely next routes within an explicit data allowance.

- **F480 — Private route cache audit:** verify that service-worker changes never cache account or invitation responses.



## Performance and service resilience · P3

Audience: Admin.


- **F481 — Endpoint latency dashboard:** summarize bounded response timings without request body collection.

- **F482 — Slow query diagnostics:** identify expensive query shapes without logging private parameter values.

- **F483 — Database index review:** report query plans for high-volume staff lists.

- **F484 — Cursor-based application queues:** page through growing datasets without unstable offset results.

- **F485 — Streaming protected exports:** reduce memory use while retaining authorization and no-store headers.

- **F486 — Asynchronous export jobs:** build large reports with expiring owner-scoped download references.

- **F487 — Export cancellation:** stop an authorized queued export before unnecessary work continues.

- **F488 — Image processing queue:** bound derivative-generation concurrency and storage usage.

- **F489 — Request timeout budgets:** apply explicit limits to expensive operational endpoints.

- **F490 — Graceful deployment draining:** finish accepted writes before the single instance exits.

- **F491 — Outbox shutdown recovery:** safely resume interrupted queue processing after a deploy.

- **F492 — Background job lease records:** prevent duplicate workers from claiming the same future job.

- **F493 — Admin maintenance windows:** show planned read-only periods with a clear end and rollback route.

- **F494 — Feature rollout switches:** enable bounded changes per staff pilot group with an audit trail.

- **F495 — Rollback readiness report:** check whether current migrations permit the selected rollback release.

- **F496 — Synthetic journey monitoring:** run authorized non-destructive public checks with sanitized results.

- **F497 — Public asset performance budgets:** flag excessive image or script growth during review.

- **F498 — Long-list rendering improvements:** keep keyboard and screen-reader navigation usable in large queues.

- **F499 — Storage-efficient document deduplication:** share underlying identical blobs while retaining separate access control.

- **F500 — Managed-database migration rehearsal:** prepare an export and validation plan without provisioning a paid service.


