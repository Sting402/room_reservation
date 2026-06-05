# NORTHSTAR · 不可動搖的目標

## 一句話
全公司手機可用、QR 入口、即時同步、紅綠燈狀態,管理三間會議室**當日** 09:00–18:00 時段的輕量預約系統。

## 要解決的真實痛點
三間會議室未納入官方系統,同仁撞期開會。本工具把「門口紙本登記表」數位化、即時同步,如此而已。

## Doctrine(建置信條 — 每一輪都要遵守)
- **Ship today, log for tomorrow.** 今天就交付可用的東西,明天的事寫進 log。
- **Approve before truth.** 沒被確認的不算事實;agent 只產生候選,不擅自宣稱完成。
- **Tools and agents must not cross-write reality.** 工具/代理不得越界改寫真實資料。
- **MVP first, expansion later.** 先 MVP,擴張以後再說。
- **Do not ask unless blocked.** 不是真 blocker 不要問。
- **No fake done.** 不准假裝完成。
- **No silent failure.** 不准靜默失敗,所有錯誤要顯示。
- **Every write path must have validation.** 每條寫入路徑都要驗證。
- **Every risky shortcut must be documented.** 每個冒險捷徑都要寫進 `SECURITY_NOTES.md` / `DECISIONS.md`。
- **Every phase must leave the repo more useful than before.** 每階段都讓 repo 更可用。
- **A simple working knife is better than an unfinished golden sword.** 能用的小刀勝過沒完工的屠龍刀。

## Definition of Success(本專案唯一勝利條件)
做到 `harness/PRODUCTION_READINESS.md` 全部勾選的 production-ready MVP,且**沒有任何一項** `SCOPE_GUARD.md` 的禁區被觸碰。

## 反向北極星(失敗的樣子)
- 變成大型 enterprise booking system。
- 停在 prototype(只有 localStorage,不能多人同步)。
- 把 mock backend 講成 production cloud sync。
- 硬寫真實 API key 進版控。
- 為了「順便」加了沒人要的功能。
