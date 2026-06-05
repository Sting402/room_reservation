# NEXT_ACTIONS · 下一步佇列(Claude Code 維護)

依序執行;完成即勾並補新項。

- [x] (A) 建 `.gitignore`(含 `config.js`、OS 雜檔)
- [x] (A) 由 `templates/config.example.js` 複製出 `config.js`,provider=local
- [x] (A) 建立 index.html / assets/style.css / assets/app.js / assets/kv.js 骨架
- [x] (B) 由 config 推導 slot 清單,渲染三房紅綠燈看板 + 手機 RWD
- [x] (B) 點綠格彈預約表單
- [x] (C) LocalStorageAdapter 全介面:訂/取消/持久/10s刷新/手動refresh
- [x] (D) 欄位驗證 + conflict 路徑 + 樂觀更新
- [x] (E) adapter 介面與 provider 切換(createAdapter factory)
- [x] (F) UpstashAdapter(MGET/SET NX EX/GET+DEL/RPUSH)→ B001 blocker 仍 OPEN,等 token
- [x] (G) 錯誤處理 / 離線 banner / 寫入鎖定
- [x] (H) audit log 寫入(book/cancel 兩路徑)
- [x] (I) Pages 部署就緒 + 安全警告 + QR 指引
- [x] (J) smoke test 全 PASS + PRODUCTION_READINESS + release_report 完成

## 剩餘(等候人類)
- [x] 人類在 Upstash 建 DB → 填 config.js(restUrl/restToken) → 改 provider="upstash" ✅
- [ ] 人類建 GitHub repo → push → 啟用 Pages
- [ ] 人類列印 QR Code 貼門口（含 ?room= deep-link 各一張）

## v3 完成項目
- [x] selectedDate 全年日期選擇
- [x] 日期選擇器 UI（今天/明天快捷鈕）
- [x] 過去日期唯讀
- [x] 未來日期全時段可預約
- [x] audit log 含 date 欄位
- [x] 0 console errors 驗證通過
