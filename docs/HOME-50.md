# 50 home-page additions

The public home page now includes these features. No paid add-ons or external
APIs are required. Search uses current, verified public vacancies; showcase
concepts remain separate and cannot receive applications.

1. Filter homes by property type.
2. Filter by neighborhood from the live inventory.
3. Require a minimum number of bathrooms.
4. Require a minimum floor area.
5. Set a minimum monthly rent alongside the existing maximum.
6. Select multiple must-have amenities (all selections must match).
7. Show only listings with actual uploaded property photographs.
8. Remove individual filters using visible filter chips.
9. Sort by largest floor area first.
10. Sort by most bathrooms first.
11. Switch between card and compact layouts.
12. Load matching homes in batches of 12.
13. Save a guest shortlist on this browser, without creating an account.
14. Filter the listing grid to that shortlist.
15. Download the available shortlist as a spreadsheet-safe CSV.
16. Print a clean shortlist with addresses and property facts.
17. Revisit the five most recently viewed available homes.
18. Share a complete search with restorable filters in its link.
19. Remember, restore or forget a search on this browser.
20. See when availability was last successfully refreshed.
21. Display rent by month, year or estimated week with the formula explained.
22. Identify and remove shortlist entries no longer publicly available.
23. Calculate monthly housing costs including user-entered utilities and fees.
24. Estimate move-in costs including deposits, moving and one-time charges.
25. Calculate money remaining after housing, living costs and a chosen buffer.
26. Estimate equal housing-cost shares for a household.
27. Plan weekly savings toward a chosen move-in savings date.
28. Compare the monthly and annual cost difference for another home's rent.
29. Download the budget and entered figures as a CSV.
30. Explicitly save, restore or clear budget figures on this browser.
31. Count down to a planned move date (or show time since that date).
32. Turn the move date into a dated preparation schedule.
33. Track moving-checklist completion with a progress bar.
34. Add and remove up to 20 custom moving tasks.
35. Restore the moving plan automatically on the same browser, with a reset.
36. Download the moving plan, dates and completion state as a CSV.
37. Download an all-day calendar reminder for the planned move.
38. Print a clean moving plan.
39. Use a persistent viewing-readiness checklist.
40. Build and download a question list for a property viewing.
41. Build a live home search from a three-preference quick-match form.
42. Prepare with an interactive application/document-readiness checklist.
43. Consult an exact required-versus-optional application guide.
44. Understand the five real application statuses and find receipt tracking.
45. Search the expanded FAQ by question or answer text.
46. Filter FAQs by topic.
47. Expand or collapse all matching answers.
48. Search a plain-language rental glossary.
49. Print the application-preparation checklist and upload requirements.
50. Celebrate checklist milestones with a status message and brief confetti,
    respecting reduced-motion and the page's pause-motion setting.

## Storage and accuracy

Home tools store only browser-local plans, numeric budget figures (only when
explicitly saved), checkmarks, search preferences and public property IDs.
They do not save application answers, documents or receipt secrets, do not
sync between devices and do not submit applications or reserve homes. Each
stored collection has a clear or reset control. Shared-browser use is explained.

Budget figures are arithmetic on visitor estimates, not quoted fees or screening
decisions. Weekly rent is monthly rent × 12 ÷ 52. Monthly rent remains the basis
for filtering, sharing and exports. Unavailable saved homes expose no private
property details. Copying links has a selectable-input fallback when clipboard
access is unavailable. Exports neutralize spreadsheet formula prefixes. Planning
tabs support arrow keys, Home and End; all controls work with a keyboard.

## Verification

`tests/home-experience-browser.cjs` covers compound filters, URL restoration,
local shortlist isolation and stale entries, pagination, planner calculations,
downloads, calendar dates, persistent checklists, input escaping, FAQ/glossary
search, keyboard tabs, reduced motion and phone overflow. Existing role,
application, account, email and dashboard checks remain in the full test suite.
