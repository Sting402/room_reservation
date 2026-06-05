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

## [Unreleased]
<!-- 每個 milestone / 功能完成後在此記一行使用者可感知的變更 -->
