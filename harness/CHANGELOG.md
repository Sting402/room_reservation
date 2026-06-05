# CHANGELOG · 變更紀錄(對使用者有感的變更)

採 Keep a Changelog 精神,繁中。

## [1.0.0] — 2026-06-05
### Added
- 三間會議室(玻璃屋1/玻璃屋2/展間)當日預約看板。
- 09:00–18:00 每 30 分鐘一格,共 18 格。
- 綠格點擊預約(姓名/部門/事由/選填 PIN)。
- 紅格點擊查看詳情並可取消(有 PIN 則驗證)。
- 每 10 秒自動輪詢 + 手動 refresh 按鈕。
- 分頁隱藏時暫停輪詢，回到前台立即刷新。
- 離線狀態警示 banner。
- LocalStorageAdapter(本機單機模式)。
- UpstashAdapter(跨裝置雲端同步，填入 token 後生效)。
- SET NX 原子防覆蓋，衝突時顯示提示並重新整理。
- SHA-256 PIN hash，取消時比對。
- Audit log 寫入(book/cancel)。
- Shadow IT 安全警告常駐顯示。
- 行動版 tab UI + 桌機三欄並排 RWD。
- config.js 設定抽離，gitignored，token 安全。

## [1.1.0] — 2026-06-05 (UI/UX 升級)
### Added
- 全新企業工具風格 UI：深色背景、16px 圓角卡片、左側色條狀態指示。
- RoomCard：三間會議室大卡，顯示即時狀態（可使用/使用中/即將開始/已關閉）+ 人話文案 + 對應操作按鈕。
- TodaySchedule：所有房間×時段的時間軸表格，包含「現在」藍線標示。
- Kiosk 模式：`?room=glass1&kiosk=1` → 單房巨大狀態顯示，門口平板專用。
- QR deep-link：`?room=glass1` → 自動聚焦 highlight 該房。
- 同步狀態 pill（常駐 header）：已同步/同步中/同步失敗（可點擊重試）。
- 即時時鐘（秒級，tabular-nums）。
- 管理預約 view：今日全部預約清單 + 取消按鈕。
- 記住我：上次使用人/部門自動預填 + 清除按鈕。
- 用途字數計數（0/30，近上限變紅）。
- 色盲友善：每個狀態有圖示（●/✕/▲/–）+ 文字，不只靠顏色。
- prefers-color-scheme dark mode。
- prefers-reduced-motion 支援。
- 規格文案：Empty/Success/Conflict/Error 皆用人話。
### Changed
- 原本的 tab 式 room 切換改為 Dashboard + Manage 兩個 view。
- 移除 overlay backdrop-filter 避免渲染問題。

## [Unreleased]
<!-- 每個 milestone / 功能完成後在此記一行使用者可感知的變更 -->
