# One-time Thanksgiving greeting

An administrator can explicitly send a fixed Thanksgiving greeting to current lease recipients through the saved SMTP connection. Nothing sends automatically each year. There are no external add-ons or changes to lease invitations.

- `GET /api/admin/smtp-settings/lease-greetings` previews the fixed subject/body, audience hash, eligible recipients and current California holiday window.
- `POST` to that endpoint requires the current administrator password, SMTP configuration revision, `confirm: true`, the preview's `campaign` and `audienceHash`.
- `GET /api/admin/smtp-settings/lease-greetings/thanksgiving-YYYY` reports individual SMTP acceptance, pending, cancelled and failed results. Acceptance does not prove inbox delivery.

Recipients include opted-in, verified tenants with active leases and opted-in approved applicants with a current pending or signed lease invitation. Drafts, declined/voided/revoked invitations, expired pending invitations, ended leases, archived properties and preview properties are excluded. Tenant email opt-outs also apply when the same mailbox appears on an applicant invitation. The audience is checked again before each send.

Each mailbox receives one private message per annual campaign, even across multiple agreements, repeated requests and different administrators. Greetings must be explicitly queued on Thanksgiving in `America/Los_Angeles`; unsent messages expire at midnight California time. The existing SMTP rate limits, delivery pause and retry handling apply. No recipients are copied on another person's message. No lease details, documents or private invitation links appear in the greeting.
