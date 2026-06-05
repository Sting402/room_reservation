# UI/UX 升級 Prompt（複製貼上給 Claude Code）

```
/goal UI/UX 升級 pass：把現有會議室預約 App 的前端，依設計規格 + 以下強化建議，
改造成「乾淨企業工具 + 紅綠燈狀態面板」。要好看、手機順、門口平板能用，
但不要夜店風、不要過度動畫。交通號誌，不是 DJ 台。

這是一次 UI/UX 改造，不是新增產品範圍。動工前先讀：
CLAUDE_GOAL.md → NORTHSTAR.md → harness/SCOPE_GUARD.md →
ARCHITECTURE.md → DATA_MODEL.md → PRODUCT_SPEC.md → harness/CURRENT_STATE.md
既有的 conflict detection / SET NX / KV adapter / 錯誤處理「不可破壞」，只改呈現層與互動。
若需動到資料層，先把理由寫進 DECISIONS.md。

== 設計語言 ==
- 風格：乾淨企業工具 + 交通號誌。
- 色彩：背景 #F7F8FA、卡片 #FFFFFF、主文 #1F2937、次文 #6B7280、
  綠 #22C55E、黃 #FACC15、紅 #EF4444、灰 #9CA3AF、藍 #2563EB。
- 卡片：圓角 16px、輕陰影、舒服間距、字夠大。
  狀態用「左側色條 + 淡色底」呈現，不要整張卡灌滿飽和色。
- 時間/時鐘用 tabular-nums 等寬數字，避免每秒跳動。
- header 可做輕微 frosted glass（呼應「玻璃屋」），克制即可。

== 畫面（單頁三 view，沿用既定決策，不要加 router）==
view = dashboard / booking / manage。
- Header：標題「會議室狀態」+ 副標「今天誰在開會，一眼看清楚」+ 即時日期時間 + 同步狀態 pill。
- Dashboard：RoomStatusGrid（三張 RoomCard；桌機並排、手機卡片流）+ 其下 TodaySchedule（V1 表格即可）。
- RoomCard：房名、狀態、人話文案、下一場時間、對應按鈕。
  可使用→[立即預約][查看今日]；使用中→[查看今日][下一個空檔]；即將開始→[查看詳情][改約其他時段]。
- booking：BookingModal（房 / 日期=今天 / 開始 / 結束 / 使用人 / 用途含 6/30 計數 / PIN）。
- manage：列出今日預約，可取消（需確認；有 PIN 要驗）。
  manage 不是 admin 後台，不得做全域管理 / 權限 / 報表。「改約」用「取消後重訂」實作。

== 狀態邏輯（衍生，不另存）==
狀態由「slot 真實資料 + 現在時間」即時計算：
  outside business hours        -> Closed   （灰）
  else now 落在某 booking 內     -> Busy     （紅，顯示到幾點）
  else 下一個 booking 在 30 分內 -> Soon     （黃，顯示開始時間）
  else                          -> Available（綠）
文案要人話。禁止顯示「status: occupied」這種工程話；要顯示「使用中，到 14:30」。

== 架構決策：固定 slot vs 自由 start/end（重要）==
truth model 是固定 30 分 slot key + SET NX。Booking modal 的開始/結束必須「對齊 config slot 邊界」，
一筆預約 = 一段連續 slots。
多 slot 預約必須原子化（全成功或全失敗，不可半套）：用 Upstash Lua EVAL 做 check-all-then-set-all。
若你判斷 V1 先只允許「單一 30 分 slot」更穩，也可以——兩種擇一並記入 DECISIONS.md，UI 要與所選一致。
結束時間選項要自動 > 開始時間，且最多到「下一筆已存在預約之前」，避免一開 modal 就能撞期。

== 強化建議（請一併實作）==
1. 不可只靠顏色：每個狀態都要有「圖示/形狀 + 文字」，不只紅綠（色盲友善，這是交通燈 App 的底線）。
   例：● 可使用 / ✕ 使用中 / ▲ 即將開始 / – 已關閉。
2. 門口平板 Kiosk 模式：支援 ?room=glass1&kiosk=1 → 只顯示單一會議室的「巨大狀態 + 現在/下一場」，
   字大、遠看清楚，給門口平板用。
3. QR deep-link：支援 ?room=glass1 → dashboard 自動聚焦/預選該房，讓「掃 QR → 兩步完成預約」。
4. 記住我（僅 localStorage，不上雲、不違反不存機密原則）：記住上次使用人/部門並預填，加速 3 秒預約；提供清除。
5. 同步狀態 pill（常駐 header）：已同步 / 同步中… / 同步失敗（可重試），搭配既有錯誤處理；不要只用一閃即逝的 toast。
6. 樂觀更新 + 防手慢：送出後先樂觀變色，以 SET NX 結果為準；回 conflict 就顯示衝突文案並即時刷新該格。
7. 過去時段自動置灰不可選；現在時間在 timeline 上用一條細「now」線標示。
8. 觸控目標 ≥44px；送出/取消按鈕處理中 disabled + loading，防重複送出。

== Fancy 但有品味（節制）==
- 微動畫：點擊輕微 scale、狀態顏色平滑過渡、首載 skeleton shimmer、toast 由下滑入。全部 < 200ms。
- 只有黃色「即將開始」可加非常輕微的 pulse 吸睛，其餘安靜。
- 一律尊重 prefers-reduced-motion：開啟時關閉所有非必要動畫。
- 可選：prefers-color-scheme 深色模式（低成本就做，否則略過，別硬塞）。
- 禁止：大量動畫、彈跳、彩帶、花俏漸層、夜店感。

== UI Copy（用這些語氣）==
- Empty：「今天還沒有預約。空氣很安靜，會議室很自由。」
- Success：「預約成功。這間房間暫時屬於你。」+ 房名/時段/用途。
- Conflict：「這段時間已經被預約了。會議室不會分身，請換個時段。」
- 超出營業時間：「目前只開放 09:00–18:00 預約。」
- PIN 錯：「PIN 不正確，無法修改或取消這筆預約。」
- 同步：「正在同步最新預約狀態…」/「目前無法同步雲端資料，請稍後再試。」

== 範圍護欄（對照 SCOPE_GUARD，一律不做）==
登入 / 角色權限 / admin 後台 / Email / LINE 通知 / 多日多週月曆 / 週期會議 / 報表。
任何想加的擴張寫進 ROADMAP，不在這 pass 做。

== Doctrine（沿用）==
No fake done / No silent failure / 每條寫入路徑驗證 / 不硬寫真實 token /
不自動 git push（乾淨時可 local commit，繁中訊息）。

== 完成後 ==
更新 harness/CURRENT_STATE.md、BUILD_LOG.md、CHANGELOG.md、必要時 DECISIONS.md。
跑 prompts/claude_code_smoke_test_prompt.md 全項 + 額外驗：
(a) 三狀態文案與圖示正確且不只靠顏色；(b) kiosk 模式單房巨大顯示；
(c) ?room= deep-link 預選；(d) 手機 390px 不破版、觸控好按；
(e) 結束時間不可早於開始、不可跨越既有預約；(f) prefers-reduced-motion 生效。
結果填 templates/manual_test_report.md。
先回報你的改造計畫與 slot/range 決策，再動工；中途不必逐步等我確認。
```
