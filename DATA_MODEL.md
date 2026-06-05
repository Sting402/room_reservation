# DATA_MODEL · 資料模型

## 設計原則
**per-slot 獨立 key + `SET NX` 原子寫入** → 從根本消滅「兩人同時訂同格互相覆蓋」。

## Key 格式
```
mrs:{date}:{room_id}:{slot}
範例: mrs:2026-06-05:glass1:0900
date : Asia/Taipei YYYY-MM-DD
room_id : glass1 | glass2 | showroom
slot : 0900 0930 ... 1730 (由 config 的 open/close/granularity 推導)
audit key: mrs:log:{date}  (Redis LIST, RPUSH)
```

## Booking 物件(value,JSON 字串)
```json
{
  "room_id": "glass1",
  "slot_start": "09:00",
  "slot_end": "09:30",
  "owner": "陳小明",
  "dept": "業務部",
  "purpose": "客戶討論",
  "pin_hash": null,
  "created_at": "2026-06-05T09:01:22+08:00",
  "schema_v": 1
}
```
規則:`owner`/`dept`/`purpose` 必填且 trim 後非空;`purpose` ≤ 30 字;`pin_hash` 為 `sha256(pin)` 或 `null`。

## Audit log entry
```json
{ "ts":"2026-06-05T09:01:22+08:00", "action":"book|cancel", "room_id":"glass1", "slot":"0900", "owner":"陳小明", "dept":"業務部" }
```
注意:audit **不存** purpose 全文以降低洩漏面;只留足以追蹤的最小欄位。

## Conflict detection 流程
1. 使用者點綠格送出 → adapter `book()` → Upstash `SET NX`。
2. 回 `OK` → 樂觀更新該格為紅 + toast 成功。
3. 回 `null` → 「這格剛被別人訂走」→ 立即重讀該格刷新。
4. 取消:先比 PIN(若該 booking 有 pin_hash),不符回 `reason:'pin'`;相符 `DEL` + 寫 audit。

## 過期 / 清理
MVP 不主動清理。前端只讀「今天」的 key,昨天資料自然不被顯示。可選 hardened:`EXPIRE` 至當日 23:59 自動回收。

## 驗證(每條寫入路徑必做)
- book:欄位非空、purpose 長度、slot 屬於合法 slot 清單、room 屬於合法 rooms。
- cancel:key 存在、PIN(若有)相符。
- 任何 adapter 錯誤(網路/4xx/5xx)→ 回 `reason:'error'`,UI 顯示,不靜默。
