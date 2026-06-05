# Smoke Test Prompt(複製貼上,驗收用)

```
請對目前版本做自我驗收。逐項回報 PASS/FAIL 並附證據(指令輸出 / network / 手動操作描述)。
不要改程式,只測試與回報;測完把結果填進 templates/manual_test_report.md。

1. 三間會議室(玻璃屋1/玻璃屋2/展間)是否都顯示?
2. 09:00–18:00 是否依 config 正確切格?(列出第一格與最後一格,並說明目前 granularity 與格數)
3. 點綠格能否開表單、必填驗證是否擋空白、purpose 超過上限是否擋下、送出後是否變紅?
4. 紅格是否顯示 owner/dept/purpose?能否確認取消並變綠?有 PIN 時錯誤 PIN 是否擋下、正確 PIN 是否放行?
5. 重整頁面後資料是否保留?目前 provider 是 local 還是 upstash?(若宣稱可雲端同步,必須用 upstash 實測)
6. 跨裝置/兩分頁:一邊操作,另一邊是否 ≤10s 反映?手動 refresh 是否即時同步?分頁隱藏時是否暫停輪詢?
7. 併發:兩分頁幾乎同時訂「同一格」,是否只有一個成功、另一個收到 conflict 提示?(說明你如何模擬)
8. 手機尺寸(~390px)是否可用、不破版?
9. 斷網 / API 回 401 或 500 / timeout 時,是否有清楚 UI 錯誤提示,而非 silent failure?寫入中是否防重複送出?
10. 安全:config.js 是否在 .gitignore?git 歷史是否不含真實 token?頁面是否有「請勿填寫機密」警告?audit log 是否有寫入?

任何 FAIL → 寫進 harness/BLOCKERS.md 與 templates/bug_report.md。
不要為了「順便」去擴張任何功能(對照 harness/SCOPE_GUARD.md)。
```
