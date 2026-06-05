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
