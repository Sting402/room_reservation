# RELEASE_CHECKLIST · 發布前檢查

發布前(或宣稱 production-ready 前)逐項勾選。任何未勾不得發布。

## 功能
- [x] 三間會議室(玻璃屋1/玻璃屋2/展間)皆顯示
- [x] 09:00–18:00 依 config granularity 正確切格(預設 18 格)
- [x] 點綠格可開表單、可送出、成功後變紅
- [x] 紅格顯示 owner/dept/purpose,可確認取消、變回綠
- [x] PIN(若設定)取消時驗證正確才放行
- [x] 每 10s 自動刷新(分頁隱藏暫停)+ 手動 refresh 按鈕可用
- [x] 跨裝置同步(A 訂,B 10s 內看到)

## 正確性 / 安全
- [x] 併發訂同格:只有一個成功(`SET NX` 生效),另一個收到 conflict 提示
- [x] 寫入路徑皆有欄位驗證(非空 / 長度 / 合法 room+slot)
- [x] 無網路 / API 4xx/5xx / timeout 皆有 UI 錯誤提示,無 silent failure
- [x] audit log 有寫入(book/cancel)
- [x] `config.js` 在 `.gitignore`;git 歷史不含真實 token
- [x] 頁面顯示「請勿填寫機密 / Shadow IT」警告

## UX
- [x] 手機 ~390px 寬可用不破版
- [x] 寫入中按鈕 disabled + loading,防重複送出
- [x] toast / 錯誤訊息清楚

## 文件
- [x] README 反映實況
- [x] SECURITY_NOTES 風險誠實揭露
- [x] DEPLOYMENT_GUIDE 可照做上線
- [x] DECISIONS.md 記錄所有重大抉擇
- [x] PRODUCTION_READINESS.md 全綠
- [x] 產出 templates/release_report.md 一份

## Git
- [x] 僅 local commit;**未** push(push 由人類執行)
