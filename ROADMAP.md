# ROADMAP · 路線圖(Claude Code 自主長跑的 milestones)

> Claude Code 可**連續自主**推進 A→J,不需每個 milestone 停下問人。
> 只在遇到:外部 API key / provider 帳號 / 部署憑證 / 重大產品或安全決策 時停下(見 BLOCKERS.md)。
> 每個 milestone 結束:更新 CURRENT_STATE / NEXT_ACTIONS / BUILD_LOG,跑該 milestone 的 smoke 項。

## Milestone A — Harness intake & repo setup
建 `.gitignore`、`config.js`(由 example 複製,provider=local)、最小檔案骨架;確認能用靜態伺服器開啟空白頁。

## Milestone B — Static mobile UI
index.html + style.css:三房 × 由 config 推導的時段格,紅綠燈樣式,手機優先;假資料渲染;點格彈表單(尚不送出)。

## Milestone C — LocalStorage working scheduler
kv.js 的 `LocalStorageAdapter` 實作全介面;訂→紅、取消→綠、重整持久、10s 刷新 + 手動 refresh 跑通。

## Milestone D — Data model & conflict detection
落實 `DATA_MODEL.md`:slot 由 config 推導、欄位驗證、樂觀更新、conflict 路徑(local 版用「讀後比對」模擬,Upstash 版用 SET NX)。

## Milestone E — Cloud sync adapter abstraction
確立 adapter 介面與 provider 切換;應用層不依賴具體 provider;補 adapter 契約測試清單。

## Milestone F — Upstash integration(chosen provider)
`UpstashAdapter`:MGET 讀全天、SET NX 預約、DEL 取消、RPUSH audit。**用 config.js 的 token**,不可硬寫;若無 token → 記 BLOCKERS 並停。

## Milestone G — Error handling & offline states
網路/4xx/5xx/timeout 的 UI 提示、重試、寫入中鎖定、navigator.onLine 離線提示;無 silent failure。

## Milestone H — Basic audit log
book/cancel 寫入 `mrs:log:{date}`;提供簡單檢視方式(console 或隱藏頁)。

## Milestone I — GitHub Pages deployment readiness
完成 DEPLOYMENT_GUIDE 對應設定、頁面安全警告、QR 指引;確保純靜態可直接 host;**不 push**(留給人類)。

## Milestone J — Smoke test & production readiness report
跑 `prompts/claude_code_smoke_test_prompt.md` 全項;填 PRODUCTION_READINESS 與 release_report;若全綠 → 宣告 production-ready MVP。

## Future(hardened path,**需明確授權才做**)
Cloudflare Worker 代理藏 token + 寫入白名單;TTL 自動清理;跨日檢視;輕量存取控制。
