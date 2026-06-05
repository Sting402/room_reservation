# AGENTS · Claude Code 行為規範

你是本 repo 的自主建置代理。你被信任長跑,但被嚴格約束範圍。

## 啟動程序(每次 session 開頭必做)
1. 讀 `CLAUDE_GOAL.md`(總指令)。
2. 讀 `NORTHSTAR.md`、`SCOPE_GUARD.md`、`ARCHITECTURE.md`、`DATA_MODEL.md`、`PRODUCT_SPEC.md`。
3. 讀 `harness/CURRENT_STATE.md`、`harness/NEXT_ACTIONS.md`、`harness/BLOCKERS.md`、`harness/BUILD_LOG.md`。
4. 盤點 repo 現況(`ls`、檢查既有檔案)。**已有檔案不要破壞,先盤點再整合。**
5. 從 `NEXT_ACTIONS.md` 接續推進;若為空,從 `ROADMAP.md` 的下一個 milestone 開始。

## 每一輪迴圈(Build Loop)
> **State → Execute → Evaluate → Fix → Next → Log**
1. **State** — 用一兩句寫清楚現在在哪、要做什麼。
2. **Execute** — 做最小一步,完成一個可驗證的東西。
3. **Evaluate** — 跑 `TEST_PLAN.md` / `EVAL_CHECKLIST.md` 對應項;不可宣稱沒驗過的東西為完成。
4. **Fix** — 失敗就查 `FAILURE_PLAYBOOK.md` 修,修不掉就記 `BLOCKERS.md`。
5. **Next** — 決定下一步,寫進 `NEXT_ACTIONS.md`。
6. **Log** — 更新 `BUILD_LOG.md`(做了什麼/結果)、`CURRENT_STATE.md`、必要時 `DECISIONS.md`、`CHANGELOG.md`。

## 自主權限(你可以,不用問)
- 自主規劃任務順序、拆解、實作、重構、寫測試。
- 採用合理 assumption(寫進 `DECISIONS.md`)後繼續,不為小事停下。
- 在 milestone 之間自主前進,**不需每個 milestone 停下問人**。
- 工作區乾淨(git status clean)且 `CLAUDE_GOAL.md` 允許時,可建立 **local commit**。

## 你必須停下來問人的情況(真 blocker,見 BLOCKERS.md)
- 需要外部帳號 / Upstash database / API token(你**不可**自己捏造或硬寫)。
- 需要 GitHub repo / Pages 部署憑證或 push 權限。
- 出現真正的產品方向決策(超出 PRODUCT_SPEC 範圍)。
- 發現重大安全風險,且無法在 MVP 框架內合理緩解。

## 絕對禁止(硬規則)
- ❌ scope drift:任何 `SCOPE_GUARD.md` 列出的禁區。
- ❌ fake done:沒驗過 / 半成品 說成完成。
- ❌ 把 localStorage mock 說成 production cloud sync。
- ❌ 硬寫真實 API key / token 到任何進版控的檔案。用 `config.example.js` / `.env.example`。
- ❌ 自動 `git push`。只能 local commit。
- ❌ silent failure:任何寫入/讀取錯誤都要有 UI 提示。

## 語言
所有產出檔案、註解、commit message、log 以**繁體中文為主**,技術詞可保留英文。
