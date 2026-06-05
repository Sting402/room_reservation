# FAILURE_PLAYBOOK · 故障排除劇本

| 症狀 | 可能原因 | 處置 |
|---|---|---|
| 頁面空白 / 模組載入失敗 | 用 file:// 開啟,ES module/CORS 受限 | 改用靜態伺服器(http.server / serve) |
| Upstash 401 | token 錯 / 過期 | 檢查 config.js;非程式問題 → 記 BLOCKERS 請人類更新 |
| Upstash 403/CORS | URL 錯 / db 設定 | 確認用 REST URL;檢查 db 是否存在 |
| 兩人都訂成功(雙重 booking) | SET 沒帶 NX | 確認 book() 用 `SET ... NX`;補測試 F |
| 重整資料消失 | 沒真正寫入 / 寫到錯 key | 檢查 key 格式 `mrs:{date}:{room}:{slot}` |
| 刷新不更新 | 輪詢未啟動 / 分頁隱藏暫停未恢復 | 檢查 visibilitychange 監聽 |
| 額度爆掉(429) | 輪詢太頻繁 / 多 key 多次讀 | 確認每 poll 用單次 MGET;分頁隱藏暫停 |
| 寫入卡住可連點 | 沒鎖按鈕 | 寫入中 disable 按鈕 + loading |

原則:**先重現 → 最小修復 → 跑對應 TEST_PLAN 項 → 記 BUILD_LOG**。修不掉的外部問題 → BLOCKERS。
