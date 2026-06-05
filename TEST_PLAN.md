# TEST_PLAN · 測試計畫

無重型測試框架。採 **manual smoke test + 可選輕量 JS 單元測試**。每完成功能即跑對應項。

## A. slot 產生(單元,可寫純函式測)
- 給 open=09:00 close=18:00 granularity=30 → 18 格,首 0900 末 1730。
- 改 granularity=60 → 9 格。granularity=15 → 36 格。
- 邊界:close 不產生獨立空格(17:30–18:00 為最後一格)。

## B. 渲染
- 三房 × N 格全顯示;空格綠、有 booking 紅。
- 手機 390px 不破版。

## C. 預約
- 點綠格 → 表單 → 必填驗證(空白擋下)→ purpose >30 字擋下 → 送出成功變紅。
- 重整後仍紅(資料持久)。

## D. 取消
- 紅格顯示資訊 → 取消需確認 → 成功變綠。
- 有 PIN:錯 PIN 擋下、對 PIN 放行。

## E. 同步 / 刷新
- 兩分頁:A 訂,B ≤10s 變紅。手動 refresh 立即同步。
- 分頁隱藏時不輪詢(可由 network 面板確認)。

## F. 併發 conflict(最重要)
- 兩分頁幾乎同時訂同格 → 僅一成功,另一收到「已被訂走」提示;資料無雙重 booking。
- 模擬方式:兩分頁先各自打開表單,再快速依序送出。

## G. 錯誤處理
- 斷網 / 故意填錯 token / 模擬 500 → 頂部錯誤 banner + 可重試,無 silent failure。

## H. 安全
- 檢查 git:`config.js` 未追蹤;歷史無 token。
- 頁面有「請勿填寫機密」警告。

## 通過標準
A–H 全 PASS 並填 `templates/manual_test_report.md`。任何 FAIL → `harness/BLOCKERS.md` + `templates/bug_report.md`。
