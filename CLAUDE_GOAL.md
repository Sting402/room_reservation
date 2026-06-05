# CLAUDE_GOAL · Claude Code 總指令(讀我)

你是本 repo 的自主建置代理。你的單一目標:
**從目前 repo 狀態,一路自主建置到 production-ready MVP,不停在 prototype,不亂膨脹。**
production-ready 的定義以 `harness/PRODUCTION_READINESS.md` 為準。

## 你要打造的產品
公司會議室當日時段預約系統(Office Meeting Room Scheduler)。
細節權威:`PRODUCT_SPEC.md` / `ARCHITECTURE.md` / `DATA_MODEL.md`。範圍紅線:`harness/SCOPE_GUARD.md`。

## 開工程序
1. 讀完本檔 + `NORTHSTAR.md` + `AGENTS.md` + `SCOPE_GUARD.md` + `ARCHITECTURE.md` + `DATA_MODEL.md` + `PRODUCT_SPEC.md`。
2. 盤點 repo:空 repo → 從 Milestone A 建最小可運行架構;已有檔案 → 先盤點,不破壞,再整合。
3. 讀 `harness/CURRENT_STATE.md` / `NEXT_ACTIONS.md` / `BLOCKERS.md` 接續。

## 怎麼跑(核心)
- 按 `ROADMAP.md` 的 Milestone A→J **連續自主推進**,不要每個 milestone 停下來問人。
- 每一輪執行 Build Loop:**State → Execute → Evaluate → Fix → Next → Log**。
- 每一輪更新:`harness/CURRENT_STATE.md`、`harness/NEXT_ACTIONS.md`、`harness/BLOCKERS.md`、`harness/BUILD_LOG.md`,必要時 `DECISIONS.md` / `harness/CHANGELOG.md`。
- 每完成一個功能就跑對應 smoke 項(`TEST_PLAN.md`);沒有自動框架就維護 manual checklist 並實際走一遍。
- 不確定的小事:採合理 assumption 寫進 `DECISIONS.md` 後**繼續**,不要停。

## 只有這些情況才停下來問人(真 blocker)
- 需要 Upstash 帳號 / database / REST token(你不可捏造或硬寫)。
- 需要 GitHub repo / Pages 部署憑證 / push 權限。
- 超出 PRODUCT_SPEC 的產品方向決策。
- 無法在 MVP 框架內緩解的重大安全風險。
遇到上述:寫清楚到 `harness/BLOCKERS.md`,在該處停下並向人類提問,**其餘能做的先做完**(例如沒 token 時把 local provider 全部完成、Upstash adapter 寫好但用假設值標 TODO)。

## 硬規則(違反即失敗)
- ❌ 不做 `SCOPE_GUARD.md` 的禁區(登入/權限/admin/多日/週期/行事曆整合/員工庫/報表/存機密…)。
- ❌ 不 fake done;不把 localStorage mock 說成 production cloud sync。
- ❌ 不硬寫真實 API key;用 `config.example.js`,真值放 gitignored `config.js`。
- ❌ 不自動 `git push`。工作區乾淨時可 **local commit**(訊息繁中,描述該輪成果)。
- ❌ 不 silent failure;所有讀寫錯誤要有 UI 提示。

## 完成定義
當 `harness/PRODUCTION_READINESS.md` 全部勾選、`RELEASE_CHECKLIST.md` 全綠、smoke test 全 PASS,
產出 `templates/release_report.md`,在 `harness/CURRENT_STATE.md` 宣告「production-ready MVP 達成」,然後停下回報人類(等候 push 與部署)。
