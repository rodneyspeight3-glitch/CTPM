# 1,000-feature candidate roadmap

Updated November 27, 2026. This is a planning inventory, **not a claim that 1,000 features shipped**.

F001–F500 retain the earlier roadmap IDs. They need a fresh code review because several capabilities have shipped since that inventory. F501–F1000 add 500 candidate outcomes. Only the four complete Living studio workflows below are marked implemented in this release; their controls are not inflated into separate shipped features.

This broader inventory replaces neither the original historical roadmap nor the working app. Similar candidates must be combined when implementation review reveals overlapping user outcomes. Titles describe candidate scope, not an estimate or approval to activate new access or external delivery.

## Delivery order

1. Resolve verified P0 issues from the original inventory before expanding sensitive workflows.
2. Review P1 operational gaps against the current applications, leases, messages and maintenance tools.
3. Ship the four P2 Living studio workflows as a small, tested, reversible release.
4. Select P3 expansion candidates after usage and owner feedback. Each needs specific acceptance examples before coding.

Keep the current Render service and persistent disk. No paid add-ons, purchased datasets or automatic external actions are authorized by this document. Shared household features, public contributions and new audiences require explicit access designs. Never infer application decisions, fabricate property facts or client reviews, or expose private applicant activity. Tenant dashboards continue to exclude vacancy browsing.

## This release

- **F501 — Measured room sketch:** furniture sizing, placement, rotation, undo/redo, moods, explicit browser saves and safe plan/picture downloads.
- **F526 — Packing label batches:** bounded sequential labels, destination, contents, notes, color, fragile marking and a print/PDF sheet.
- **F551 — Home inspiration deck:** 24 editorial ideas, topic/text filters, nonrepeating shuffle, saved ideas and copy with a manual fallback.
- **F576 — Device-local focus timer:** focus durations, task label, accurate background catch-up, pause/resume/reset and a short break.

Details and limits: [Living studio](LIVING-STUDIO.md). Full searchable inventory: [ROADMAP-1000.csv](ROADMAP-1000.csv).

## Expansion candidate groups

| IDs | Area | Audience |
|---|---|---|
| F501–F525 | Room planning | All visitors |
| F526–F550 | Packing coordination | All visitors |
| F551–F575 | Home inspiration | All visitors |
| F576–F600 | Focus routines | All visitors |
| F601–F625 | Household planning | Residents |
| F626–F650 | Viewing companions | Applicants and staff |
| F651–F675 | Neighborhood discovery | Visitors and staff |
| F676–F700 | Resource-conscious living | Residents |
| F701–F725 | Reuse and sharing | Residents and moderators |
| F726–F750 | Welcome journeys | Residents and staff |
| F751–F775 | Gentle celebrations | All roles |
| F776–F800 | Inclusive interactions | All roles |
| F801–F825 | Staff content studio | Agents and admins |
| F826–F850 | Agent workspace improvements | Agents and admins |
| F851–F875 | Applicant clarity | Applicants and staff |
| F876–F900 | Lease reading support | Applicants and residents |
| F901–F925 | Maintenance experience | Residents and staff |
| F926–F950 | Team time and coordination | Agents and admins |
| F951–F975 | Engagement safeguards | Admins and moderators |
| F976–F1000 | Community activities | Residents and staff |

## Before marking another item implemented

Check the current code and tests for an equivalent. Define a complete outcome and useful empty, failure and recovery states. Specify ownership, role boundaries, storage and retention, opt-in delivery and external dependencies. Verify mobile, keyboard, light/dark, reduced motion and storage denial where relevant. Record a release reference and evidence only after the behavior passes. A palette swatch, furniture type, checkbox, button or text variation does not count as another shipped feature.
