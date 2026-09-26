# Screenshots — VoxDrill UI polish (2026-09-26)

Three screens at two viewports, captured from the single-origin local build
(`http://localhost:3001/`, serving `web/dist`). Drill/report states were
driven via text intents through the page context (no voice needed for layout).

| Screen | Desktop 1920×1080 | Mobile 390×844 |
|--------|-------------------|----------------|
| Selection (hero) | `selection-desktop.png` (56,522 B) | `selection-mobile.png` (57,085 B) |
| Drill (2 turns in) | `drill-desktop.png` (57,399 B) | `drill-mobile.png` (51,113 B) |
| Report (5/5 complete) | `report-desktop.png` (62,184 B) | `report-mobile.png` (52,943 B) |

Checks: no horizontal scroll at either viewport (grids collapse to one column
under 900px / 640px), no console errors during capture, all frozen DOM
selectors preserved (`#selection-view`, `#drill-view`, `#report-view`,
`#report-score`, `#drill-timeline-list`, `#mic-state`, `#open-report`, etc.).
Real-mic audio verification is still pending user hardware — see BLOCKERS.md.
