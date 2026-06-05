/goal Apply final product tweaks and then run a full pre-push smoke test for the Office Meeting Room Scheduler.

Product tweaks:

1. Rename rooms:
   - glass1 should display as 大玻璃屋(左)
   - glass2 should display as 小玻璃屋(右)
   - showroom should display as 展間會議室
2. Keep internal room IDs stable if possible:
   - glass1
   - glass2
   - showroom
3. Change schedule interval from 30 minutes to 60 minutes.
4. Schedule remains 09:00–18:00.
5. Expected slots should be:
   - 09:00–10:00
   - 10:00–11:00
   - 11:00–12:00
   - 12:00–13:00
   - 13:00–14:00
   - 14:00–15:00
   - 15:00–16:00
   - 16:00–17:00
   - 17:00–18:00
6. Update config.example.js, config-related docs, README, PRODUCT_SPEC, TEST_PLAN, and any UI copy that still says 30 minutes.
7. Do not erase existing Upstash data.
8. Existing data created with old room IDs should remain readable because IDs should not change.
9. If existing 30-minute bookings exist, document the migration concern instead of silently deleting them.

Current product direction:
The app should support reservations for any date within the current year.
It should remain a simple website:

- no login
- no employee database
- no admin dashboard
- no recurring meetings
- no Outlook/Google Calendar integration
- no Cloudflare Worker yet
- direct frontend Upstash config is accepted for this low-risk MVP, but documented honestly

Date behavior:

1. Default selected date = today in Asia/Taipei.
2. User can choose any date from January 1 to December 31 of the current year.
3. Booking, cancellation, loading, manual refresh, auto-refresh, and audit log must all use selectedDate, not hardcoded todayDate.
4. Storage keys should be date-based, for example:
   - mrs:bookings:YYYY-MM-DD
   - mrs:audit:YYYY-MM-DD
5. Booking uniqueness:
   selectedDate + roomId + slot
6. Past-slot behavior:
   - selectedDate is today: past slots disabled
   - selectedDate is before today: all slots read-only/disabled for new booking
   - selectedDate is after today: all business-hour slots bookable

Known previous issues to prevent:

1. GitHub Pages loaded but config.js was missing.
2. After config.js was added, app.js crashed because it tried to set textContent on a missing DOM element such as #date-line.
3. UI had a stray/broken 「現在」 current-time marker near the table header.
4. App originally loaded today only instead of selected date.
5. Need to avoid fake enterprise security claims.

Pre-push test category A — Static file and config loading:

1. Confirm index.html loads config.js before assets/app.js.
2. Confirm root config.js behavior is documented.
3. Confirm templates/config.example.js uses:
   - provider
   - rooms
   - schedule.open
   - schedule.close
   - schedule.granularityMinutes = 60
   - timezone
   - pollIntervalSeconds
   - upstash.restUrl placeholder
   - upstash.restToken placeholder
4. Confirm no real secrets are committed to templates/config.example.js.
5. Confirm README explains how to create root config.js.

Pre-push test category B — DOM selector contract:
Inspect every document.getElementById and querySelector used by assets/app.js.
Verify every required element exists in index.html.

Required IDs include:

- app
- header
- date-line
- status-line
- refresh-btn
- room-tabs
- room-panels
- book-overlay
- book-form
- book-title
- book-slot-info
- pin-field
- f-owner
- f-dept
- f-purpose
- f-pin
- book-cancel-btn
- book-submit-btn
- detail-overlay
- detail-title
- detail-info
- detail-close-btn
- detail-cancel-btn
- cancel-pin-section
- cancel-pin-input
- toast-container

Do not allow null.textContent or null.addEventListener runtime crashes.

Pre-push test category C — UI rendering:
Verify:

1. Header renders.
2. Date selector renders.
3. Selected date is obvious.
4. Room labels render exactly:
   - 大玻璃屋(左)
   - 小玻璃屋(右)
   - 展間會議室
5. Time slots render exactly as 60-minute slots from 09:00 to 18:00.
6. No 30-minute slots remain in the UI.
7. Available slots show 可預約.
8. Booked slots show owner/dept.
9. Past slots show 已過 only when appropriate.
10. The stray 「現在」 label does not appear.
11. No console errors.

Pre-push test category D — Date-based behavior:
Verify selectedDate is used for:

1. load()
2. book()
3. cancel()
4. appendLog()
5. auto-refresh
6. manual refresh

Manual test:

1. Open site; default date is today.
2. Book 大玻璃屋(左) at a future slot today.
3. Refresh page; booking persists.
4. Select tomorrow.
5. Tomorrow schedule is separate.
6. Book 展間會議室 at 10:00 tomorrow.
7. Refresh page.
8. Select tomorrow again; booking persists.
9. Select today; tomorrow booking does not appear.
10. Select a later date this year.
11. Book 小玻璃屋(右) at 14:00.
12. Refresh page.
13. Select that date again; booking persists.

Pre-push test category E — Upstash/backend:
Verify:

1. adapter.getDay(selectedDate) reads date-based key.
2. adapter.book(selectedDate, roomId, slot, booking) writes date-based booking.
3. adapter.cancel(selectedDate, roomId, slot, pin) cancels only selectedDate.
4. adapter.appendLog(selectedDate, logEntry) actually writes to backend and is not a stub.
5. Existing today data remains readable.
6. No backend write happens for invalid dates, invalid room, or invalid slot.
7. Conflict detection prevents same selectedDate + roomId + slot from being double-booked.

Pre-push test category F — Booking/cancel flow:
Verify:

1. Click green slot.
2. Booking modal opens.
3. Owner/dept required.
4. Purpose required and max length enforced.
5. Optional PIN works if enabled.
6. Submit booking.
7. Slot turns booked/red.
8. Refresh page.
9. Booking remains.
10. Click booked slot.
11. Detail modal opens.
12. Wrong PIN fails if PIN exists.
13. Correct PIN cancels.
14. Slot becomes available again.
15. Audit log records book and cancel.

Pre-push test category G — GitHub Pages readiness:
Verify:

1. index.html works from repo root.
2. Asset paths are GitHub Pages compatible.
3. No absolute Windows paths.
4. No broken links to assets/app.js or CSS.
5. config.js path is correct.
6. Documentation says direct frontend token exposure is accepted for MVP only.
7. SECURITY_NOTES recommends Cloudflare Worker proxy only as future hardening.

Docs/harness updates:
Update:

- README.md
- PRODUCT_SPEC.md
- DATA_MODEL.md
- DECISIONS.md
- TEST_PLAN.md
- SECURITY_NOTES.md
- DEPLOYMENT_GUIDE.md if needed
- harness/CURRENT_STATE.md
- harness/BUILD_LOG.md
- harness/NEXT_ACTIONS.md

Hard rule:
Do not say “ready to push” unless:

1. Browser console has zero uncaught runtime errors.
2. Every app.js DOM selector exists in index.html.
3. Room names display correctly.
4. Slot interval is 60 minutes.
5. Selected-date/year booking behavior works.
6. Upstash sync still works.

Do not push to git automatically.

Final output required:

1. Pass/fail checklist.
2. Files changed.
3. Any remaining blockers.
4. Whether it is safe for me to push.
5. Exact manual smoke test steps after GitHub Pages deploy.
