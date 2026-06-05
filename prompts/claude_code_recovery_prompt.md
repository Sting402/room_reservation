# Recovery Prompt(斷線 / 迷路 / 疑似漂移時用,複製貼上)

```
你可能中斷過或失去脈絡。請執行復原程序,先穩住再前進:

1. 重新讀:CLAUDE_GOAL.md、NORTHSTAR.md、harness/SCOPE_GUARD.md、
   harness/CURRENT_STATE.md、harness/NEXT_ACTIONS.md、harness/BLOCKERS.md、harness/BUILD_LOG.md。
2. 盤點 repo 真實狀態(ls、開檔、用靜態伺服器試開),和 CURRENT_STATE 對照:
   - 若 CURRENT_STATE 與實況不符,以**實況**為準,更正 CURRENT_STATE。
3. 自我稽核漂移:
   - 是否做了 SCOPE_GUARD 禁區的東西?→ 標記、評估是否該回退,記 DECISIONS。
   - 是否有 fake done(宣稱完成但實際沒驗)?→ 降級為未完成,補驗或補做。
   - 是否把 mock 當真同步?→ 更正描述與狀態。
   - 是否硬寫了 token?→ 立即移除,改用 config 機制,檢查 git 歷史。
4. 重建最短前進路徑寫進 NEXT_ACTIONS.md。
5. 回到 Build Loop 繼續自主推進,只有真 blocker 才停。

先回報你的稽核結果與更正,再繼續動工。
```
