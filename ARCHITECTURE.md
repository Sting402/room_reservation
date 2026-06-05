# ARCHITECTURE · 架構決策(權威)

## 三條路線(CTO 視角)
- **Fastest prototype path:** GitHub Pages + LocalStorage only。最快,但**不能多人同步**,只能算 prototype,**不是** production MVP。本專案用它當 Milestone C 的中繼站與離線 fallback,不是終點。
- **Honest production MVP path(本專案採用):** GitHub Pages(純靜態)+ **Upstash Redis REST**。免費額度足、瀏覽器 CORS 原生支援、`SET NX` 提供真正原子防覆蓋、`MGET` 一次讀全天。
- **Future hardened path:** GitHub Pages + **Cloudflare Worker proxy** + KV/D1。把 token 藏進 Worker secret、加寫入白名單與 rate limit。列為 ROADMAP 第一優先升級,**不在 MVP**。

## 為什麼選 Upstash(對照表)
| 方案 | 免費額度(2026) | Pages 相容 | 前端直呼安全 | Key 暴露 | 難度 | MVP 適合 |
|---|---|---|---|---|---|---|
| LocalStorage | 無限本機 | ✅ | n/a | 無 | 最低 | ❌ 不能同步 |
| **Upstash Redis REST** | 500K cmd/月,256MB | ✅ CORS | ⚠ token 在前端 | 高 | 低 | **★ 採用** |
| JSONBin | **一次性 10K**(非每月) | ✅ | ⚠ | 高 | 很低 | ❌ 額度撐不住輪詢 |
| GitHub Gist/API | 5K/hr(authed) | ✅ | ⚠ PAT 過度授權 | 高 | 中 | ⚠ 危險 |
| Firebase/Firestore | Spark 額度 | ✅ SDK | ✅ rules 可擋 | 低 | 中高 | ⚠ 較重 |
| Cloudflare Worker+KV | 10萬 req/天 | ✅ | ✅ key 藏 Worker | 低 | 中 | ★ 留給 hardened |

> 輪詢數學:設計成每次 poll = 1 個 `MGET`(讀全天固定 key)。尖峰平均 2 活躍分頁 × 6 次/分 × 60 × 9h × 22 工作日 ≈ **14 萬 cmd/月**,遠低於 Upstash 500K。JSONBin 一次性 10K 數小時內爆,故淘汰。

## 技術形態
- **純靜態,不用 Vite。** 三個檔(index.html / app.js / kv.js)+ css 足夠;少一層 build 對 Shadow IT MVP 更可維護。記於 `DECISIONS.md`。
- **KV adapter 抽象(關鍵)**:`assets/kv.js` 匯出統一介面;提供 `LocalStorageAdapter` 與 `UpstashAdapter`,由 `config.js` 的 `provider` 切換。Milestone C 用 local,Milestone F 接 Upstash。應用層程式碼不因換 provider 而改。

## KV 介面(adapter 必須實作)
```
getDay(date) -> Promise<{ [slotKey]: Booking | null }>   // 一次讀全天
book(date, room_id, slot, booking) -> Promise<{ok:boolean, reason?:'conflict'|'error'}>  // 原子,不覆蓋
cancel(date, room_id, slot, pin?) -> Promise<{ok:boolean, reason?:'pin'|'notfound'|'error'}>
appendLog(date, entry) -> Promise<void>                  // best-effort audit
```

## Upstash 指令對應
- 讀全天:`MGET` 固定 key 清單(rooms × slots)→ 1 command;缺 key 視為空閒。
- 預約:`SET key value NX` → 回 `OK` 成功;回 `null` = 已被搶訂 → conflict。
- 取消:`GET` 比對 PIN → `DEL key`(MVP 接受極小競態;可選 Lua `EVAL` 原子化)。
- Audit:`RPUSH mrs:log:{date} <json>`(append-only)。
