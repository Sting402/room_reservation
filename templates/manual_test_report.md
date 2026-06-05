# 手動測試報告 — {日期} / {milestone 或版本}

測試者:{Claude Code / 人類}
provider:{local | upstash}
裝置/瀏覽器:{}

| # | 測試項(對應 TEST_PLAN) | 結果 PASS/FAIL | 證據 / 備註 |
|---|---|---|---|
| A | slot 產生正確(首末格、granularity) | | |
| B | 三房渲染 + 手機 RWD | | |
| C | 預約成功變紅 + 重整持久 | | |
| D | 取消 + PIN 驗證 | | |
| E | 10s 自動刷新 + 手動 refresh + 跨裝置 | | |
| F | 併發訂同格僅一成功(conflict) | | |
| G | 斷網/API 錯誤有提示(無 silent failure) | | |
| H | config.js 未進版控 + 機密警告 | | |

FAIL 摘要與後續:{ 連結到 bug_report.md / BLOCKERS.md }
