# Living studio

Open `/studio` from the home introduction or Dashboard → Resources. Guests, tenants, agents and administrators use the same four optional tools. No vacancy listings appear in the tenant dashboard. These tools never create or change property, applicant, lease, payment or staff records; no email or AI requests are made.

## Room remix

A measured top-down rectangular room sketch supports 5–60 feet per side (or meter equivalents), ten starter furniture types and up to 24 pieces. Starter sizes are estimates. Edit labels, dimensions and positions; rotate, duplicate, remove, drag or use arrow keys. Shift + arrow uses a larger step. Optional half-foot snapping and a grid assist placement. Four room moods change the sketch. Overlap notes ignore rugs; they do not assess real-world safety, accessibility, door swings or delivery clearance.

Undo/redo retains 30 changes in memory. Saving on the browser is explicit; no layout is restored automatically. Restore can be undone, and Forget saved room removes the stored copy without clearing the open layout. Reset asks before clearing and can be undone. Download an editable JSON plan or a standalone escaped SVG picture, or print the sketch. Imports enforce version, size, finite geometry, bounds, IDs and a 24-piece limit. Extra imported fields are discarded. Invalid imports leave the open plan intact. Files are read locally, not uploaded.

Browser-saved layouts are device-local and visible to others using the same browser. Downloaded plans and images include user-entered labels. Storage denial leaves the tools usable; downloads remain an alternative. Unsaved layouts are lost on page reload or navigation. Confirm measurements, furniture instructions and required clearances in person.

## Pack happy

Generate 1–30 sequential box labels at a time, with box numbers from 1–9999, destination room, optional contents/note, four colors and a fragile marker. Preview text is escaped. Print a dedicated sheet or choose Save as PDF in the browser print dialog. Clearing removes the preview and form; labels are never saved to browser storage or the server. Print settings and paper sizes are controlled by the browser.

## Little wins

Twenty-four editorial cards cover settling in, home care, moving and everyday delight. Search titles/text, choose a topic, shuffle without repeating the same card when alternatives exist, save/remove ideas and filter to saved ideas. Only idea IDs are stored locally. Clear saved ideas removes them from this browser. Copy uses the browser clipboard; if denied, instructions offer manual selection. Cards provide general suggestions, not maintenance dispatch or professional advice.

## Focus corner

Choose 5, 15, 25 or 45 minutes, optionally label the task, and start/pause/resume/reset a focus session. A separate five-minute break is available. The countdown uses elapsed wall-clock time so background tab throttling does not stretch a session. Completion is visual, without sound, browser notification permissions or external messages. A task label and timer remain in memory only; leaving/reloading ends the session. The device clock remains the time source.

## Verification

`tests/studio.test.cjs` covers geometry, rotation, overlap rules, schema limits, malicious imported values, escaped SVGs and bounded sequential labels. `tests/studio-browser.cjs` exercises the complete room/label/card/timer flows, print and downloads, storage denial, keyboard controls and day/night phone/desktop contrast. `/studio` is included in the app-wide design audit. The full existing suite remains required before the Render deployment.

The accompanying [1,000-item roadmap](ROADMAP-1000.md) is a candidate backlog. Four complete tools are implemented here; roadmap proposals and individual controls are not represented as 1,000 new shipped features.
