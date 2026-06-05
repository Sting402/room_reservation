/goal Upgrade the Office Meeting Room Scheduler from today-only booking to full current-year date-based booking.

Current situation:
The app already works as a simple meeting room reservation website with:

- GitHub Pages frontend
- config.js
- Upstash backend storage
- three rooms
- booking/cancel flow
- basic log/audit behavior

The current limitation is that the system is still too focused on today. Real room reservation needs to support future dates. I want the app to support the whole current year.

Important product decision:
This is now a simple year-based reservation website.
It does NOT need login.
It does NOT need employee accounts.
It does NOT need Outlook/Google Calendar integration.
It does NOT need recurring meetings.
It does NOT need an enterprise admin dashboard.
It does NOT need Cloudflare Worker yet.
Direct frontend Upstash token is accepted for this low-risk MVP, but document the tradeoff clearly.

Goal:
Allow users to reserve any date within the current year.

Required behavior:

1. Add a clear date selector near the top of the page.
2. Default selected date = today in Asia/Taipei.
3. User can choose any date from January 1 to December 31 of the current year.
4. When selected date changes:
   - update the visible date display
   - load that date’s booking data from backend
   - render the same 09:00–18:00 schedule
   - show the same three rooms
   - refresh booking status for that selected date
5. Booking applies to selectedDate, not always today.
6. Cancellation applies to selectedDate, not always today.
7. Audit log applies to selectedDate, not always today.
8. Auto-refresh refreshes the currently selected date.
9. Manual refresh refreshes the currently selected date.
10. Existing today bookings must remain readable.
11. Do not erase existing Upstash data.

Rooms:

- glass1 / 大玻璃屋(左)
- glass2 / 小玻璃屋(右)
- showroom / 展間會議室

Schedule:

- 09:00–18:00
- 60-minute slots unless config.js says otherwise
- one record per selected date

Data model requirement:
Storage must be date-based.

Use selectedDate as the primary date key.

Recommended storage keys:

- mrs:bookings:YYYY-MM-DD
- mrs:audit:YYYY-MM-DD

Booking uniqueness:
selectedDate + roomId + slot

Example:
2026-06-05 + glass1 + 0900
2026-09-18 + showroom + 1430

This means:

- booking glass1 at 09:00 today must not affect glass1 at 09:00 tomorrow
- booking showroom at 14:30 in September must persist and only appear when that September date is selected

Implementation requirements:

1. Replace todayDate-only logic with selectedDate.
2. Keep getTaipeiDate() for:
   - default selectedDate
   - comparing today vs selectedDate
   - disabling past slots
3. Add helper functions:
   - getCurrentYearRange()
   - isValidDateInCurrentYear(date)
   - compareDateToToday(date)
4. Date picker should have min/max:
   - min = YYYY-01-01
   - max = YYYY-12-31
     where YYYY is current Taiwan year.
5. Validate selectedDate before loading, booking, or cancelling.
6. If invalid date is selected, show clear error and do not write backend.
7. Persist last selected date in localStorage if useful, but default to today if missing/invalid.
8. Header should show selectedDate clearly.
9. The old "today only" text should be rewritten so the UI does not mislead users.

Past/future slot rules:

1. If selectedDate is today:
   - past time slots show 已過
   - past time slots cannot be booked
   - future slots can be booked
2. If selectedDate is before today:
   - all slots should be disabled/read-only
   - existing bookings may be viewed
   - no new bookings allowed
3. If selectedDate is after today:
   - all business-hour slots can be booked
   - do not mark morning slots as 已過 just because current time has passed today

Backend/storage requirements:

1. load() must call adapter.getDay(selectedDate).
2. booking must call adapter.book(selectedDate, roomId, slot, booking).
3. cancellation must call adapter.cancel(selectedDate, roomId, slot, pin).
4. audit log must call adapter.appendLog(selectedDate, logEntry).
5. Confirm appendLog() actually writes to Upstash and is not a stub.
6. If appendLog() is missing or incomplete, implement it.
7. Audit log should record:
   - timestamp
   - selectedDate
   - action: book/cancel
   - room_id
   - slot
   - owner
   - dept
8. Do not store sensitive meeting information beyond short general purpose.

Conflict detection:

1. Same selectedDate + roomId + slot cannot be double-booked.
2. If a conflict happens, show a clear message:
   “這個時段剛被別人訂走了，已重新整理”
3. Reload selectedDate after conflict.
4. Do not overwrite existing booking silently.

UI requirements:

1. Add date selector near top, above the schedule table.
2. Add quick buttons if simple:
   - 今天
   - 明天
   - 本週
     But do not overbuild.
3. The current selected date must be obvious.
4. Remove misleading today-only copy if present.
5. Keep the UI simple.
6. Do not build a full yearly calendar grid unless already easy. A normal date input is enough.
7. Fix or remove any broken “現在” label/current-time marker if still present.
8. Keep table radius, padding, and layout unless required.
9. No console errors.

Docs/harness updates:
Update:

- README.md
- PRODUCT_SPEC.md
- DATA_MODEL.md
- ARCHITECTURE.md if needed
- SECURITY_NOTES.md
- TEST_PLAN.md
- DECISIONS.md
- DEPLOYMENT_GUIDE.md if needed
- harness/CURRENT_STATE.md
- harness/BUILD_LOG.md
- harness/NEXT_ACTIONS.md

Documentation must clearly state:

- This supports reservation within the current year.
- It is not a recurring meeting system.
- It is not a full enterprise calendar.
- Direct frontend token exposure is accepted for MVP only.
- Future hardening can move storage behind Cloudflare Worker if usage grows.

Acceptance tests:

1. Open site.
2. Default selected date is today.
3. Today’s schedule loads correctly.
4. Book 玻璃屋 1 at a future time today.
5. Refresh page; today booking persists.
6. Select tomorrow.
7. Tomorrow’s schedule loads separately.
8. Book 展間會議室 at 10:00 tomorrow.
9. Refresh page.
10. Select tomorrow again; booking persists.
11. Select today; tomorrow booking does not appear.
12. Select a date later this year, e.g. September 18.
13. Book 小玻璃屋 at 14:30.
14. Refresh page.
15. Select September 18 again; booking persists.
16. Select a past date in this year.
17. Existing bookings can be viewed but new bookings cannot be created.
18. Try booking the same room/date/slot from two browser windows.
19. One succeeds, one gets conflict handling.
20. Cancel a future booking.
21. Confirm cancellation log is written under that selected date.
22. No console errors.
23. Upstash sync works across two browsers/devices.

Do not add:

- login
- employee database
- admin dashboard
- recurring meetings
- Google Calendar
- Outlook
- full yearly visual calendar
- Cloudflare Worker
- complex backend
- multi-company support

Do not push to git.

Return:

1. root cause of today-only limitation
2. files changed
3. data model/storage key changes
4. whether existing today data needs migration
5. manual smoke test steps
6. remaining risks
7. production readiness status
