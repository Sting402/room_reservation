# /goal — 主建置 Prompt(複製貼上)

> 假設所有 harness files 已在 repo 內。把以下整段貼進 Claude Code。

```
/goal 自主把本 repo 從目前狀態建置到 production-ready MVP:公司會議室當日時段預約系統。

先讀(照順序,務必讀完):
CLAUDE_GOAL.md → NORTHSTAR.md → AGENTS.md → harness/SCOPE_GUARD.md →
ARCHITECTURE.md → DATA_MODEL.md → PRODUCT_SPEC.md →
harness/CURRENT_STATE.md → harness/NEXT_ACTIONS.md → harness/BLOCKERS.md → ROADMAP.md

然後:
1. 盤點 repo。空 repo → 從 Milestone A 建最小可運行架構;已有檔案 → 先盤點不破壞再整合。
2. 按 ROADMAP 的 Milestone A→J 連續自主推進,「不要」每個 milestone 停下問我。
3. 每一輪跑 Build Loop:State → Execute → Evaluate → Fix → Next → Log,
   並更新 harness/CURRENT_STATE.md、NEXT_ACTIONS.md、BLOCKERS.md、BUILD_LOG.md(必要時 DECISIONS.md、harness/CHANGELOG.md)。
4. 每完成一個功能,跑 TEST_PLAN 對應項;沒有自動框架就維護 manual checklist 並實走一遍。
5. 架構照定案:純靜態(不用 Vite)、KV adapter 抽象、provider 可切 local/upstash、
   資料模型用 per-slot key + SET NX 原子防覆蓋(細節見 ARCHITECTURE.md / DATA_MODEL.md)。
6. 先用 provider=local 把 UI、互動、錯誤處理、conflict 全部做完做對;
   再實作 UpstashAdapter(MGET/SET NX/DEL/RPUSH)。

硬規則:
- 不做 SCOPE_GUARD 禁區(登入/權限/admin/多日/週期/行事曆整合/員工庫/報表/存機密…)。
- 不 fake done;不把 localStorage mock 說成 production cloud sync。
- 不硬寫真實 API key;真值放 gitignored config.js,版控只放 templates/config.example.js。
- 不自動 git push;工作區乾淨時可 local commit(繁中訊息)。
- 不 silent failure;所有讀寫錯誤要有 UI 提示。

只在這些「真 blocker」停下來問我(其餘先做完能做的):
- 需要 Upstash 帳號/db/REST token(不可捏造或硬寫)→ 記 BLOCKERS #B001,
  但仍要把 local provider 全部完成、UpstashAdapter 寫好(從 config 讀值,標 TODO)。
- 需要 GitHub repo / Pages 憑證 / push → 記 BLOCKERS #B002,把可部署狀態備好。
- 超出 PRODUCT_SPEC 的產品決策,或無法在 MVP 內緩解的重大安全風險。

完成定義:harness/PRODUCTION_READINESS.md 全勾 + RELEASE_CHECKLIST.md 全綠 + smoke test 全 PASS,
產出 templates/release_report.md,在 CURRENT_STATE 宣告「production-ready MVP 達成」後停下回報。

現在開始。先回報你讀完 harness 後的理解與第一輪計畫,然後直接動工,不要等我逐步確認。
```
