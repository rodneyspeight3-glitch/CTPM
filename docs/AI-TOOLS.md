# Gemini tools for staff

The existing Gemini connection now powers **Property → Add/Edit → Draft the property description with AI**, **Maintenance → AI summary**, **Messages → Open conversation → Draft a tenant reply with AI**, and **AI workspace → Multilingual FAQs**. Email drafting remains available in Email history. No additional provider, subscription, database, or service instance is created.

Every tool uses the saved `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). The shared allowance is 20 requests per staff account and 100 per installation per day across all these tools and email drafting. Google account quotas also apply. Missing credentials and provider errors leave manual editors and published FAQs working.

## Reviewing and using drafts

- Property drafting reads the editable listing facts, omitting account data, property photos and exact-address fields. Staff review the source before generation. **Use description** fills the description field; the ordinary property save remains separate and preserves photos/agent assignments. The prompt uses supplied property features rather than renter preferences or invented neighborhood/policy claims.
- Maintenance summaries use title, category, reported observations and current status. Contacts/private links are redacted, and staff can edit the excerpt before sending it to Gemini. **Save internal summary** saves a staff-only note with source/version checks. It does not change the request status, resident update, contractor assignment or tenant-visible history. Notes are marked stale after the source changes; newer staff notes cannot be overwritten silently.
- Reply suggestions use up to the last six message bodies, without author names, account fields or attachments. Staff review/edit the excerpt first. **Use reply draft** fills the existing reply editor. Only the separate ordinary **Send reply** action posts a message.
- AI output is always rendered as editable plain text. Generation alone does not send emails/messages, save a property, dispatch work or publish public content. Prompts and unused model results are not stored. Only explicitly saved descriptions, notes, replies or FAQ drafts are persisted by their respective workflows.

Email addresses, common phone/identity-number patterns, long private references, credential labels and HTTP links are removed from tool context in both browser and server. This is a practical redaction step, not a guarantee that free-form text contains no personal information. Staff should review the source excerpt. The Gemini service receives only that reviewed/redacted text or the public canonical English FAQ source; application documents, SMTP credentials, recipient lists and account credentials are not included.

## Multilingual FAQs

`/faq` is public and available without an account or a Gemini request. English uses the app's existing help guidance. Staff can generate/edit/save Spanish, French, Portuguese, Simplified Chinese, Vietnamese and Arabic translations in AI workspace. Generated translations contain exactly the eight canonical FAQ IDs and retain the original navigation links. Arabic answers display right-to-left.

Agents can save drafts. Administrators review a saved translation against its English source, check the review confirmation, and publish it. Editing a draft leaves the previous published version intact. Administrators can unpublish a language while retaining its draft. Version checks prevent overwriting newer drafts or publishing outdated versions. When the canonical English source changes, its old translations are withheld from the public language selector until reviewed against the new source. English remains available.

Endpoints: public `GET /api/faqs?lang=en`; staff `GET /api/ai-tools/status`, `POST /api/ai-tools/generate`, `GET/POST /api/ai-tools/maintenance/:id`, `GET/POST /api/ai-tools/faqs`; administrator `POST /api/ai-tools/faqs/publish` and `POST /api/ai-tools/faqs/unpublish`. Tenants and guests cannot invoke Gemini, read staff notes, or manage FAQ drafts. Publishing and note saving do not require or trigger an AI request.
