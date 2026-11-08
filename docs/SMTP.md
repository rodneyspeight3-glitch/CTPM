## Configure from the administrator dashboard

Administrators can manage SMTP in **Dashboard → Built-in services**. Choose **Custom SMTP server** for any public provider that supports password/token-based SMTP login, or use the Gmail/mail.com presets. Enter its hostname, port, TLS mode, username, SMTP password and authorized sender address. Custom usernames retain their case and can differ from the sender address. Save a provider/mailbox/password with delivery paused, check the saved connection, or confirm **Check & enable automatic email**. These actions require the current administrator password. The saved mailbox password stays masked and is never returned. Gmail still needs a Google app password; the dashboard cannot create one for the Google account.

The override is encrypted in SQLite with a separate `.smtp-key` on the persistent disk. Back up that key separately from SQLite backups. Existing hosting variables continue to apply until an override is saved, and the administrator can explicitly return to them. See [the handover guide](HANDOVER.md#smtp-settings-in-the-administrator-dashboard) for recovery, key storage, live changes and the `EMAIL_DELIVERY_DISABLED=true` staging lock.

# Automated email through your SMTP provider

The application uses Nodemailer and the existing SQLite email outbox. Custom providers can use TLS from connection or mandatory STARTTLS on any valid provider port (1–65535), including 465, 587 and 2525. Plaintext, disabled certificate validation, URLs in the hostname field and private/internal destinations are refused. DNS answers are checked on each connection, all must be public, and the actual socket connects only to those validated addresses. TLS still checks the original server hostname. A connection check verifies encryption and login; provider sender authorization and inbox delivery require their own verification. Personal Gmail is supported without a paid email subscription when the account allows Google app passwords. mail.com is also supported for an existing Premium mailbox; its free accounts cannot use SMTP. No subscription is purchased or upgraded by the app.

## Optional hosting fallback in the existing Render service

These variables apply when the SMTP form shows **Hosting settings**. A saved dashboard override takes precedence. Use **Save settings with delivery paused** to pause that override; use `EMAIL_DELIVERY_DISABLED=true` as a hosting-level lock for staging or recovery.

| Render Environment variable | Value |
|---|---|
| `SMTP_ENABLED` | `true` enables the hosting SMTP fallback; `false` pauses that fallback |
| `SMTP_HOST` | Your provider’s public hostname, e.g. `smtp.fastmail.com`, `smtp.gmail.com` or `smtp.mail.com` |
| `SMTP_PORT` | Your provider’s port from 1–65535; usually `465`, `587` or `2525` |
| `SMTP_SECURITY` | `tls` or `starttls` (mandatory encryption); defaults to TLS for port 465, STARTTLS for other ports |
| `SMTP_USER` | Provider SMTP username; Gmail/mail.com use the complete sender mailbox address |
| `SMTP_FROM` | Provider-authorized sender address; Gmail/mail.com require the same mailbox as the login |
| `SMTP_PASSWORD` | Provider SMTP password/token; Gmail requires a Google app password; enter privately in Render |
| `PUBLIC_APP_URL` | `https://ctpm.onrender.com`; Render's service URL is a fallback |

Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`. SMTP does not require that legacy flag and never activates Stripe or Resend. When SMTP is selected but incomplete, the app does not fall back to another provider. Never place a mailbox password in source control, chat, Management settings, or public agent profiles. Follow the provider setup below. Custom public SMTP hosts and provider ports are accepted with mandatory TLS or STARTTLS; private-network destinations are refused. Network reachability, port restrictions, sender verification and quotas depend on your provider and Render. OAuth-only or unauthenticated relays are not supported by this password-based form.

For custom SMTP, use your provider’s exact login username and an authorized From address; the username may be a token rather than an email address. For the Gmail and mail.com presets, use the same authorized mailbox as both login and sender. A dedicated company mailbox is recommended; the owner may instead choose a personal mailbox as both values. That choice makes the personal address visible to recipients. Sender display name is **Come Together Property Management (No Reply)**. The selected address remains visible in From, envelope, and message headers. TLS encrypts the SMTP connection; it does not hide sender identity or provide end-to-end message encryption. Mailbox addresses and passwords are configured privately in Render, rather than embedded in source.

## Personal Gmail setup (no paid subscription)

1. Keep `SMTP_ENABLED=false` while switching providers. Do this **before** replacing
   the password, so an old provider cannot receive the new provider's password.
2. Use a Gmail mailbox you control. Enable Google 2-Step Verification and create a
   password for this app at [Google App passwords](https://myaccount.google.com/apppasswords).
   Use the generated app password, not the ordinary Google sign-in password.
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, and set both `SMTP_USER` and
   `SMTP_FROM` to that same Gmail address. Personal `gmail.com` and `googlemail.com`
   addresses are supported. Do not keep a mail.com sender behind a Gmail login.
4. Save the app password privately as `SMTP_PASSWORD` in Render. Displayed spaces
   in Google's app-password groups are removed for Gmail only. No password is
   stored in source or returned by setup/status APIs.
5. Once the settings are complete, enable SMTP and use Admin → Service connections
   → Check SMTP connection. A connection check sends no email. Startup also checks
   the encrypted login and holds the outbox until that check finishes.

Google's [app-password guide](https://support.google.com/accounts/answer/185833)
explains eligibility: 2-Step Verification is required, and certain account
security or organization policies can make app passwords unavailable. This app
uses authenticated SMTP, not Google OAuth; it cannot override those policies.
Gmail can apply sending limits and recipient spam filtering. The app's conservative
outbox budget is 400 emails per rolling 24 hours and ten per minute. Mail beyond
that budget remains pending without using retries. The admin page shows usage.
This counter covers this app, not mail sent elsewhere from the same Gmail account.

## Existing mail.com Premium setup

mail.com [requires Premium for SMTP](https://support.mail.com/pop-imap/toggle.html).
If Premium already exists, enable **Email → Settings → POP3 & IMAP → Enable access
via POP3 and IMAP** and save. Its [server guide](https://support.mail.com/premium/imap/server.html)
provides the supported TLS settings. Use an app-specific password if the mailbox's
security settings require it. Retrying a free mail.com account with different
passwords cannot enable SMTP; no upgrade is purchased by this app.

## Automatic messages

- New public tenant signup creates an immediate, persistent dashboard welcome. When email is configured, it queues one welcome email with a 24-hour, single-use verification link. It never emails the password. Welcome delivery is not conditional on signing a lease.
- New applicants can choose **Email me my receipt and application progress updates** on the form. It is optional and checked by default. A valid submission with that preference queues a receipt containing its private status link.
- Actual status changes to Reviewing, Contacted, Closed, or Withdrawn queue an update. Saving staff notes alone sends nothing. A repeated application does not overwrite the existing record or send another receipt for it.
- Staff document requests trigger a generic notice for opted-in applicants. Private request text and documents stay in the portal.
- Applicants do not need an account to receive these application messages. Dashboard application access still requires the receipt claim or confirmed identity.
- Active staff who verify their own email and enable account email notifications can receive new-application alerts. General account preferences are separate from the application's explicit email choice.
- Each application email contains a secret unsubscribe link. Opening it does not unsubscribe automatically; the recipient confirms on the page. It disables that application's emails and cancels pending deliveries, preserving the application and dashboard access. A message already in flight or accepted by an email server cannot be recalled.

Message bodies contain a reference and status, not credit scores, financial answers, landlord details, identity files, or private staff notes. No attachments are sent. New submissions keep a separate email preference; older applications default to email off. Connecting SMTP does not create a welcome/receipt mailing for historical records. Subsequent updates can be delivered for applications that already explicitly opted in while the connection was unavailable.

## Delivery and verification

Email is processed every five seconds while the single Render instance runs. SMTP is limited to ten accepted messages per minute across the outbox, with the additional Gmail daily budget above; the mailbox provider may impose additional quotas. Queue entries are deduplicated by event. Transient failures retry with backoff up to six attempts; authentication, TLS, and permanent rejections stop for review. Authentication/TLS failures also pause automatic delivery for fifteen minutes to avoid repeated failed logins. A successful administrator connection check or explicit retry clears the pause. Stable Message-ID values are reused, but SMTP cannot guarantee exactly-once delivery after a server accepts a message and the connection then fails.

Newer application progress supersedes older pending progress. The worker checks the current status, recipient, opt-out, account state, and expiry again before sending. Expired and suppressed messages are cancelled. Sent/cancelled message bodies and private unsubscribe URLs are cleared from the outbox; backups made before delivery may still contain private links.

Admin → **Built-in services / Service connections** shows configuration completeness, safe delivery counts, and sanitized error codes. **Check SMTP connection** tests TLS and login without sending an email. **Retry recent failed email** queues at most twenty unexpired failures from the last seven days; suppression checks run again. Agent and tenant accounts cannot inspect configuration or trigger these actions. No secret values or raw SMTP errors are exposed by the app.

After configuring the sender mailbox, sign in as administrator and check SMTP. Then test signup and application updates in a separate staging environment using addresses you control. Automated tests use local transports and artificial records; they do not establish that the selected provider has accepted the owner's real credentials or that recipient inboxes will accept delivery. Do not upload fake identity documents to production for an email test. Manual replies and bounces may still reach the authorized sender mailbox; inbound email is not imported into portal conversations.

## Background photography

The page background uses a locally bundled photograph of real buildings, moving continuously left to right with a linear CSS loop. Mirrored duplicate tiles align the seams. It remains behind the white page areas, supports pause/reduced-motion preferences, and makes no browser requests to an image service.

Photo source: [Unsplash building photograph](https://images.unsplash.com/photo-1486406146926-c627a92ad1ab), used under the [Unsplash License](https://unsplash.com/license). The image is decorative and does not represent an available property.

## No-reply policy

All automated delivery passes through a shared formatter, including welcome, verification, recovery, general notifications, application receipts, progress updates, and document requests. Existing queued mail receives the same policy when delivered. The sender display name includes **(No Reply)**, every body says **Please do not reply**, and help links point to portal messages and the public management contact section. The footer is added once, including during retries.

The app sets `Auto-Submitted: auto-generated` and `X-Auto-Response-Suppress: All` to discourage automatic reply loops, preserving application unsubscribe headers. It keeps the authenticated sender address and envelope for legitimate delivery and bounces. It does not invent `noreply@realtyagent.com`, redirect replies to an unrelated mailbox, or block a person from manually replying. A literal no-reply sender needs provider authorization; Gmail and mail.com require its matching mailbox credentials. Custom providers can authorize a sender separately from the SMTP login.

When SMTP is configured, startup performs a TLS/login check without sending a test email. The check never blocks website startup. Outbox delivery waits during the check, and failures pause delivery with sanitized status codes. The admin service connections page shows the last successful connection check; a complete configuration alone is not proof of successful authentication or inbox delivery.
