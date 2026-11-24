# Luxury interface quality review

The redesign applies to the public home, vacancy and agent pages, sign-in/signup, application forms, private status/invitation pages, recovery/email preferences, and tenant/agent/admin dashboards.

## Design changes

Warm ivory and charcoal surfaces, restrained slate and champagne accents, locally served variable fonts, clearer form boundaries, a light neutral navigation rail with a charcoal night variant, consistent cards and buttons, and a more spacious editorial hierarchy replace the competing visual styles. Alternate palettes, visitor-local day/night, reduced motion, reading settings, print layouts, the moving architectural background and agent illustrations remain available. Staff hero navigation now says **View properties**.

The visual sweep corrected sidebar/brand contrast, public footer contacts, application progress and file labels, dark-mode section markers, public help controls, dark display-settings panels, sign-in placeholders and empty-dashboard guidance. Photo/hero overlays were also inspected visually. Fonts and their licenses are bundled locally; no third-party font requests or paid add-ons are introduced.

## Verification

| Area | Coverage |
|---|---|
| Server/API | 94 existing and recent regression tests, using isolated SQLite databases |
| Identity and permissions | Shared login/signup, all three roles, resident isolation, staff/admin-only APIs, private records and links |
| Property operations | Creation/editing, photographs, availability, assignments, galleries, archive/restore and deletion constraints |
| Applications | Listed/open-address intake, required and optional fields, private uploads, receipts, reviews, approval/rejection and combined PDF export |
| Leases | Editable/generated/uploaded agreements, guest private invitations, same-address applicants, signatures, expiry/replacement, alerts and account assignment |
| Resident and staff workflows | Maintenance, work tracking, appointments, messages, ledger/recorded payments, resources, reports, account recovery and sessions |
| Email | Saved SMTP administration, connection states, test-email queue controls, privacy and error handling with mock transports |
| Display and accessibility | 326 public/staff/tenant layout and visible text-contrast cases, including 320px, phone and desktop widths, day/night, three palettes, help and display panels |
| Assets | Correct local font MIME, no external asset requests in the design sweep, no browser script errors or page overflow in the checked cases |

Workflow tests use artificial accounts and records with email delivery disabled or mocked. They do not send additional production emails, sign real leases or charge money. Live release verification checks the deployed revision, public pages, contact email, assets, HTTPS and redirects. Existing payment instructions, SMTP credentials, private records and the Render persistent disk are not replaced by this design release.

The browser regression suite now includes `tests/design-browser.cjs`. Its solid-surface text-contrast checks complement the visual review; they are not a certification of every possible uploaded photograph or future content combination. Existing literal teal-color assertions were changed to check themed surfaces so they continue testing dark-mode behavior across the new palettes.
