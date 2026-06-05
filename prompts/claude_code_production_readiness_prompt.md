# Production Readiness 驗證 Prompt(複製貼上)

```
請對照 harness/PRODUCTION_READINESS.md 與 RELEASE_CHECKLIST.md,逐項判定目前是否達標。
規則:只有你**實際驗證過**的才可標完成;模糊、半成品、未實測一律標未達。

針對每一項回報:✅達標 / ❌未達(原因) / ⚠有風險(說明)。
特別嚴格檢查這幾條(最常被造假):
- 雲端同步是否「真的」用 upstash 實測跨裝置,而非 localStorage 充當?
- 併發 SET NX 防覆蓋是否「真的」驗過?
- 是否有任何 silent failure?
- 是否有任何硬寫的真實 token?
- 是否有任何 SCOPE_GUARD 禁區被做出來?

最後:
- 若全部達標 → 產出/更新 templates/release_report.md,在 harness/CURRENT_STATE.md 宣告 production-ready MVP,停下回報人類(待 push 與部署)。
- 若有未達 → 列出最短補完路徑寫進 harness/NEXT_ACTIONS.md,然後繼續自主補完(除非是真 blocker)。
```
