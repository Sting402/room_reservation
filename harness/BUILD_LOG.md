# BUILD_LOG · 建置日誌(append-only,Claude Code 每輪追加)

格式:
```
## [輪次/時間] Milestone X — 標題
- State: 開始前狀態
- Did: 做了什麼
- Result: PASS/FAIL + 證據(指令輸出/手動驗證描述)
- Next: 下一步
```

## [0 / 2026-06-05] Milestone A 前 — harness 初始化
- State: 空 repo + harness bundle。
- Did: 放入全部 harness 文件。
- Result: harness 就緒。
- Next: 開始 Milestone A。

## [1 / 2026-06-05] Milestone A~J — 全段一次完成
- State: harness 就緒，無任何應用程式碼。
- Did:
  - (A) 建立 .claude/launch.json、config.js(provider=local)
  - (A~C) index.html / assets/style.css / assets/kv.js / assets/app.js 全部完成
  - (C) LocalStorageAdapter 實作完整介面:getDay/book/cancel/appendLog
  - (D) 欄位驗證(非空/長度/合法room+slot)、conflict 路徑、樂觀更新
  - (E) createAdapter() factory，provider 切換不改應用層
  - (F) UpstashAdapter 實作:MGET/SET NX EX/GET+DEL/RPUSH；token 留 TODO（B001 blocker 尚 OPEN）
  - (G) 網路錯誤/timeout/API 錯誤皆有 UI 提示；寫入中 button disabled；offline banner
  - (H) audit appendLog 在 book/cancel 兩路徑都已呼叫；LocalStorage/Upstash 各自實作
  - (I) 頁面安全警告已顯示；純靜態；config.js gitignored；DEPLOYMENT_GUIDE 已有 QR 指引
  - (J) 瀏覽器手動 smoke test 全項 PASS（見下方）
- Result: PASS
  - 本機 http://localhost:8080 開啟無 console error
  - 行動版 375px / 桌機 1280px 皆正常
  - 三室顯示、09:00–18:00 依 config 18 格
  - 預約(綠→紅)、詳情、取消、toast 全部正常
  - 寫入中 disabled 防重複送出
  - 過去時段灰色不可點
  - 頁面顯示 Shadow IT 警告
- Next: 更新 PRODUCTION_READINESS / RELEASE_CHECKLIST → 本地 commit → 等候人類 push/部署

## [3 / 2026-06-05] Hotfix — DOM ID mismatch (index.html vs app.js)
- State: 新 index.html 缺少 v1 app.js 所需的 5 個舊 ID；GitHub Pages CDN 可能快取舊 JS → crash。
- Root cause: `renderHeader` in old app.js calls `getElementById('date-line')` but new index.html had no such element. Also `book-modal-title`/`detail-modal-title` didn't match goal spec `book-title`/`detail-title`.
- Did:
  - 在 index.html header 加入 hidden backward-compat stubs: `date-line`, `status-line`, `refresh-btn`, `room-tabs`, `room-panels`
  - 將 `book-modal-title` → `book-title` in both index.html and app.js
  - 將 `detail-modal-title` → `detail-title` in both files
  - Final audit: 0 IDs used by new app.js missing from index.html
- Result: PASS — no console errors, page renders correctly
- Next: commit + push

## [4 / 2026-06-05] v3 全年日期升級
- State: selectedDate = todayDate only；無法預約未來日期。
- Did:
  - app.js: 引入 selectedDate 狀態；新增 getCurrentYearRange / isValidDateInCurrentYear / compareDateToToday / isSlotPast / loadSavedDate / saveSelectedDate / getTomorrowDate / initDatePicker / onDateChange / updateDateDisplay
  - index.html: 加入 date-selector-bar（date input + 今天/明天按鈕 + 日期標籤）
  - style.css: 加入 date-selector-bar / date-input / date-quick-btn / date-label / slot-past-date 樣式
  - load() / submitBook() / submitCancel() / appendLog() 全部改用 selectedDate
  - 過去日期：卡片 state-closed、時段全禁、取消按鈕隱藏
  - 未來日期：時段全綠、不顯示已過、now-line 隱藏
  - 今天：原有時間感知邏輯保留
  - audit log entry 新增 date 欄位
- Result: PASS — 0 console errors; future/past/today 三態驗證正確
- Next: 更新 PRODUCT_SPEC / DATA_MODEL / DECISIONS → commit
