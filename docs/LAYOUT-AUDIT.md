# Layout and component audit — November 27, 2026

The audit covers the public pages, tenant/agent/admin dashboards and the existing end-to-end workflows, plus 38 dialogs and forms in a seeded app. Fixtures use isolated SQLite databases and artificial accounts, leases, applications and photos. Production verification is read-only apart from an isolated login/logout session when required. No production records are created, no leases are signed, no live emails are sent and no payments are charged by these checks.

## Corrections

- Phone and tablet Help, Display, Back to top and building-motion controls share a bottom bar. It reserves scrolling room and accounts for device safe areas. Existing handlers, preferences, labels and keyboard access are preserved. The comparison tray and status messages sit above the utility bar, with extra scrolling room while a comparison is active. Fixed tablet sidebars end above the bar so Sign out stays reachable. Desktop controls retain their placement.
- Tablet dashboards keep their content beside the fixed navigation rail through the 801–980px breakpoint range; headers wrap their actions within the content width.
- Property image frames stay within their cards. Previously, an image's transferred aspect-ratio width could extend past a narrow card and clip the Next photo button even when the page itself showed no horizontal overflow. The larger viewer also gives its photo dots enough room.
- Notification dates, unread surfaces, comparison tables, status messages and actions use theme colors with readable day/night contrast. The heading says Notifications rather than claiming the user is caught up while unread updates exist.
- Long dialogs keep Close reachable while scrolling. Shared dialogs receive accessible titles, and replacing a dialog's contents retains its original focus-return target. Focused fields have space below the close control.

## Coverage

| Check | Scope |
|---|---|
| Existing server and API suite | 133 tests covering authentication, role boundaries, persistence, private documents, decisions, leases, financial records, SMTP, AI adapters and photo migrations |
| Existing browser suite | Navigation and all roles; property management, photos, applications, signing, maintenance, messaging, accounts, work tracking, email/AI tools, exports and Living studio |
| Page design sweep | 666 layout/visible-text contrast cases across 12 public routes and role-specific dashboards; day/night, three palettes, 320px/phone/tablet/desktop and local assets |
| Component sweep | 422 checks across 38 dialogs and forms: desktop, 1024px tablet, 768px landscape, phone, 320px, day/night, larger text and touch settings |
| Interaction layout checks | Onscreen, unobstructed Next photo at four widths; tablet Sign out; dialog close reachability after scrolling; field/button labels; focus return after gallery updates |
| Print checks in existing suite | Dedicated room/packing sheets, combined application documents, lease PDFs, exports and worksheets |

The component sweep includes property creation/editing, eight-photo galleries and descriptions, cover upload, lease assignment, rent charges, messages, account/agent creation, contractor and viewing editors, agent profiles, expenses and budgets, team tasks, maintenance plans, community notices, private notes/tasks, populated notifications, application review, the email composer, all ten operations editors, resident maintenance/search forms, property comparisons, the larger photo viewer, Display and built-in help. SMTP settings are checked as a page form.

Email, payment and AI provider paths use disabled delivery or mock adapters in the automated workflow suite. Provider readiness can be inspected on the live app; these layout checks do not assert that an external provider will accept every future request. The contrast audit measures visible text on solid surfaces and is complemented by screenshots; arbitrary future uploaded images and every possible browser/content combination are outside that measurement.

Run `npm test`. Focused additions live in `tests/component-layout-browser.cjs`; its report is written to `/tmp/ctpm-component-layout-results.json`. `tests/design-browser.cjs` continues the page-wide audit. CI must pass before the existing Render service auto-deploys the commit.
