# EVAL_CHECKLIST · 每輪自評(Claude Code 在 Evaluate 階段用)

每完成一步,逐項自問(誠實):
- [ ] 這步**真的可驗證**嗎?我實際跑/看過結果嗎?(否 → 不可標完成)
- [ ] 有沒有 silent failure?所有錯誤路徑都有 UI 提示嗎?
- [ ] 這步有沒有踩 `SCOPE_GUARD.md` 紅線?
- [ ] 我有沒有把 mock 當成真同步在描述?
- [ ] 有沒有硬寫任何真實 token / key?
- [ ] 寫入路徑有沒有驗證輸入?
- [ ] 我有沒有更新 CURRENT_STATE / NEXT_ACTIONS / BUILD_LOG?
- [ ] 對應的 TEST_PLAN 項我跑了嗎?結果 PASS 嗎?
- [ ] repo 是否比這步之前更可用?

任一答「否」→ 回去修,不要前進。
