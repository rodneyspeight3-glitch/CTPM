# Staff email history

Administrators and agents can open **Dashboard → Email history** (`/dashboard#email-history`). The read-only history lists emails queued by this app, including existing lease reminders and holiday greetings. It does not read the mailbox's Sent folder or record mail sent outside the app.

Search recipients and subjects, filter delivery status/category/created dates, and page through every retained record. Dates display in the visitor's selected timezone; date filters use their browser's local calendar. Open **View details** for attempts, expiry, error descriptions and a safe message preview. **Sent** means the SMTP server accepted the email, not confirmed inbox delivery or an open/read receipt. A queued email past its expiry is shown as **Expired** even before the worker cancels it.

New supported transactional emails retain a preview with all links and long private references omitted. Account-verification and password-recovery emails never expose message content. Unknown email kinds also omit previews. Existing sent bodies have already been cleared and cannot be recovered; the UI says when an earlier preview is unavailable. Existing pending/failed supported messages receive sanitized previews during migration. Neither list nor detail responses expose raw message bodies, private-link tokens, unsubscribe URLs, provider IDs, event keys, SMTP settings or batch snapshots.

The existing cleanup keeps sent and cancelled records for 90 days. Pending and failed records follow their existing retention. Records already removed cannot be reconstructed. Only message-history metadata/previews are added; SMTP configuration, sending and retry permissions stay administrator-only.

Endpoints: `GET /api/email-history` (`q`, `status`, `kind`, `since`, `until`, `page`, `limit`) and `GET /api/email-history/:id`. Date bounds are canonical UTC ISO timestamps; `since` is inclusive and `until` exclusive. Reads require a live active staff account and return no data to tenants, guests or deactivated staff.

## Compose and send

Both staff roles can choose **Compose email**, select everyone with email updates enabled, current lease recipients, tenant accounts, active applicants, or the team. Recipients are deduplicated. Inactive accounts, email opt-outs, preview properties and closed/rejected/withdrawn applications are excluded. The current lease audience also excludes revoked, declined and expired pending invitations. A matching account opt-out takes precedence over an application's opt-in.

The writer reviews the exact message and recipient addresses, enters their own account password, and checks the final send confirmation. Queueing requires the current audience and sender hashes, reauthentication and a unique request reference. Repeating the same reference cannot create duplicate emails; changing its message is rejected. Audience/authorizer eligibility is rechecked before delivery. Each recipient gets an individual message, with no CC/BCC list. Limits are 250 recipients per send, three batches per staff account per hour, six per installation per hour, and a 24-hour delivery window. Existing SMTP limits, pauses and failures still apply. Sending requires the existing connected company mailbox; agents cannot change SMTP credentials or use administrator-only retry/settings endpoints.

## Gemini writing suggestions

Save `GEMINI_API_KEY` privately in the existing Render service's Environment settings. Use a Google AI Studio project on Gemini's free tier; the app does not enable billing or fall back to another paid service. The default model is `gemini-3.5-flash-lite`; `GEMINI_MODEL` can select another compatible Gemini model, and `GEMINI_ENABLED=false` pauses suggestions. Keep keys out of chat and source control.

After deployment with the key, open **Compose email → Gemini writing assistant**. Only the writer's brief and tone go to Google. No recipient list, account/application records, documents or prior message history are included. Suggestions are editable, and using a suggestion never queues or sends it. Prompts and unused suggestions are not stored. Each staff account gets at most 20 suggestion requests per day, with 100 per installation. Google quotas and availability also apply. The current model and free-tier availability are documented at https://aistudio.google.com/docs/models/gemini-3.5-flash-lite. Missing configuration and provider errors leave manual writing and sending available.

`GET /api/email-writing/status` and `POST /api/email-writing/suggest` require active staff. `GET /api/email-campaigns/audience?scope=...`, `POST /api/email-campaigns` and `GET /api/email-campaigns/:requestId` provide the review/send flow. Reading email history never sends or retries a message.
