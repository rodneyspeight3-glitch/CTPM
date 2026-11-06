# Company email through mail.com SMTP

The application uses Nodemailer and the existing SQLite email outbox. No email service is purchased by the app. mail.com's published SMTP settings are in its [Premium IMAP/SMTP guide](https://support.mail.com/premium/imap/server.html); the company mailbox must already allow SMTP. A free mailbox without SMTP access cannot be enabled by application code. No subscription upgrade is made automatically.

## Configure privately in the existing Render service

| Render Environment variable | Value |
|---|---|
| `SMTP_ENABLED` | `true` to select mail.com; `false` pauses external delivery |
| `SMTP_HOST` | `smtp.mail.com` |
| `SMTP_PORT` | `465` for TLS, or `587` for mandatory STARTTLS |
| `SMTP_USER` | The complete dedicated company mailbox address |
| `SMTP_FROM` | The same dedicated company mailbox address |
| `SMTP_PASSWORD` | That company mailbox's SMTP password, entered privately in Render |
| `PUBLIC_APP_URL` | `https://ctpm.onrender.com`; Render's service URL is a fallback |

Keep `ALLOW_PAID_INTEGRATIONS` unset or `false`. SMTP does not require that legacy flag and never activates Stripe or Resend. When mail.com is selected but incomplete, the app does not fall back to another provider. Never place a mailbox password in source control, chat, Management settings, or public agent profiles. Check that SMTP is enabled for the mailbox at mail.com; use its application-specific password if required by the account's two-factor settings.

Use the dedicated **company** mailbox as both login and sender. The app deliberately rejects mismatched SMTP login and From addresses to avoid using a personal login behind a public alias. Sender display name is **Come Together Property Management**. The company address remains visible in From, envelope, and message headers. TLS encrypts the SMTP connection; it does not hide sender identity or provide end-to-end message encryption. No personal mailbox address is used or embedded in the application.

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

Email is processed every five seconds while the single Render instance runs. SMTP is limited to ten accepted messages per minute across the outbox; the mailbox provider may impose additional quotas. Queue entries are deduplicated by event. Transient failures retry with backoff up to six attempts; authentication, TLS, and permanent rejections stop for review. Authentication/TLS failures also pause automatic delivery for fifteen minutes to avoid repeated failed logins. A successful administrator connection check or explicit retry clears the pause. Stable Message-ID values are reused, but SMTP cannot guarantee exactly-once delivery after a server accepts a message and the connection then fails.

Newer application progress supersedes older pending progress. The worker checks the current status, recipient, opt-out, account state, and expiry again before sending. Expired and suppressed messages are cancelled. Sent/cancelled message bodies and private unsubscribe URLs are cleared from the outbox; backups made before delivery may still contain private links.

Admin → **Built-in services / Service connections** shows configuration completeness, safe delivery counts, and sanitized error codes. **Check SMTP connection** tests TLS and login without sending an email. **Retry recent failed email** queues at most twenty unexpired failures from the last seven days; suppression checks run again. Agent and tenant accounts cannot inspect configuration or trigger these actions. No secret values or raw SMTP errors are exposed by the app.

After configuring the company mailbox, sign in as administrator and check SMTP. Then test signup and application updates in a separate staging environment using addresses you control. Automated tests use local transports and artificial records; they do not establish that mail.com has accepted the owner's real credentials or that recipient inboxes will accept delivery. Do not upload fake identity documents to production for an email test. Read replies in the company mailbox; inbound SMTP replies are not imported into portal conversations.

## Background photography

The page background uses a locally bundled photograph of real buildings, moving continuously left to right with a linear CSS loop. Mirrored duplicate tiles align the seams. It remains behind the white page areas, supports pause/reduced-motion preferences, and makes no browser requests to an image service.

Photo source: [Unsplash building photograph](https://images.unsplash.com/photo-1486406146926-c627a92ad1ab), used under the [Unsplash License](https://unsplash.com/license). The image is decorative and does not represent an available property.
