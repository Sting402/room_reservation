Context:
The boss created an AI-style meeting room sign image with fields like:

- Department 部門
- Date 日期
- Time 時間
- Region / Project 區域 / 專案
- Meeting in Use

We want the reservation website to support this kind of information in the booking form and optionally show it in a clean "meeting in use" card/detail view.

Decision:
Add department back.
Add project/region field.
Do not redesign the whole app.

Required booking form fields:

1. Name
   - label: 姓名
   - required
2. Department
   - label: 部門
   - required
3. Project / Region
   - label: 區域 / 專案
   - required or optional depending on current UX, but prefer required
4. Meeting category or short purpose
   - label: 事由 / 類型
   - required
5. PIN
   - keep existing cancellation PIN behavior if enablePin is true

Field guidance:

1. Add privacy hint:
   - 請勿填寫機密專案名稱或敏感人事資訊
2. Project / Region should be short.
3. Add max length validation:
   - name: 30 chars
   - department: 30 chars
   - project/region: 40 chars
   - purpose/category: 40 chars
4. Do not allow empty department if required.
5. Do not allow empty project/region if required.

Public schedule table behavior:

1. Main schedule table should remain privacy-safe.
2. Booked slots should show only:
   - 已預約
3. Do not show name, department, project, or purpose directly inside the main schedule grid.
4. Available slots still show:
   - 可預約

Detail / Meeting-in-use card behavior:
Create or update the booking detail modal/card so it can display a clean sign-style layout inspired by the image.

The card should show:

- Department 部門
- Date 日期
- Time 時間
- Region / Project 區域 / 專案
- Meeting status: MEETING IN USE / 會議使用中
- Optional category/purpose

Suggested card copy:

- 溫馨提醒：看到此預約牌，請勿使用
- MEETING IN USE
- Department 部門
- Date 日期
- Time 時間
- Region / Project 區域 / 專案

Important:
Do not copy the image exactly.
Use it as visual inspiration only.
Make it fit the existing app style:

- charcoal / burgundy / green brand palette
- clean card layout
- desktop-friendly
- no childish icons unless they already match the design
- keep it professional enough for boss demo

Data model update:
Booking record should include:

- owner
- department
- project_region
- purpose or category
- selectedDate/date
- room_id
- slot_start
- slot_end
- pin_hash if enabled
- created_at
- schema_v

Backward compatibility:

1. Existing old bookings without department/project_region must not crash.
2. If old booking lacks department/project_region, show:
   - 未填寫
     or hide that row in detail view.
3. Do not erase existing Upstash data.
4. If schema version changes, document it.

Audit log:
Update audit log to include:

- date
- action
- room_id
- slot
- owner
- department
- project_region
  Do not show audit log on public main board unless already implemented as management-only.

Preserve:

- GitHub Pages frontend
- Upstash direct storage
- full current-year date selection
- selectedDate single source of truth
- rooms:
  - 大玻璃屋(左)
  - 小玻璃屋(右)
  - 展間會議室
- schedule:
  - 08:00–18:00
  - 60-minute slots
- today hides passed slots
- future dates show all slots
- past dates read-only
- conflict detection
- PIN cancel behavior
- no console errors

UI requirements:

1. Booking modal should be clean and not too tall.
2. Department and project/region fields should visually match existing inputs.
3. Detail modal should feel like a digital meeting room door card.
4. Main table remains simple.
5. Do not show sensitive details directly on schedule cells.
6. Add a small warning/hint:
   - 請勿填寫機密或敏感資訊

Docs updates:
Update:

- README.md
- PRODUCT_SPEC.md
- DATA_MODEL.md
- SECURITY_NOTES.md
- TEST_PLAN.md
- DECISIONS.md
- templates/config.example.js if max length config is added
- harness/CURRENT_STATE.md
- harness/BUILD_LOG.md

SECURITY_NOTES must clearly state:

1. Department/project fields are internal information.
2. Current GitHub Pages + direct Upstash MVP is not enterprise-secure.
3. Users should not enter confidential project names.
4. If the tool becomes official or stores sensitive project names, next step should be Cloudflare Worker / Access control.

Acceptance tests:

1. Booking form shows name, department, project/region, purpose/category, PIN if enabled.
2. Cannot book if required department is empty.
3. Cannot book if required project/region is empty.
4. Max length validation works.
5. Booking succeeds with department and project/region.
6. Main schedule table shows only 已預約, not sensitive details.
7. Detail card shows department/date/time/project-region cleanly.
8. Old bookings without department/project do not crash.
9. Cancel with PIN still works.
10. Audit log records new fields.
11. Refresh persists booking data.
12. Different dates remain isolated.
13. No console errors.
14. Existing date/room/slot behavior does not regress.

Return:

1. how old bookings are handled
2. manual smoke test steps
3. remaining privacy/security risks
