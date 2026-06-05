# 公司會議室當日預約系統 · Office Meeting Room Scheduler

掃門口 QR → 看今天 → 綠色點一下訂、紅色點一下取消 → 全公司即時同步。
管理三間會議室:**玻璃屋 1、玻璃屋 2、展間會議室**,當日 09:00–18:00,每 30 分鐘一格。

> ⚠ 這是 **Shadow IT MVP**,不是公司正式系統。純前端 + 免費雲端 KV。
> **請勿在此填寫任何機密。** 詳見 `SECURITY_NOTES.md`。

---

## 給 Claude Code 的入口(最重要)
本 repo 是一個 **harness-driven 自主建置專案**。你(Claude Code)應該:
1. 先讀 `CLAUDE_GOAL.md`,它是你的總指令。
2. 再讀 `NORTHSTAR.md` / `AGENTS.md` / `SCOPE_GUARD.md` / `ARCHITECTURE.md` / `DATA_MODEL.md`。
3. 然後用一次 `/goal`(見 `prompts/claude_code_goal_prompt.md`)從空 repo 一路建到 production-ready MVP。
4. 不要每一步問人。只有 `BLOCKERS.md` 定義的「真 blocker」才停下來問。

人類使用者只需要做一件事:把整包丟進資料夾,貼一次 `/goal`。

---

## 這是什麼 / 不是什麼
**是:** 當日三間會議室的紅綠燈預約看板,手機優先,約每 10 秒同步,GitHub Pages 部署。
**不是:** ERP / Outlook / Google Calendar 整合 / 登入 / 權限 / admin 後台 / 多日 / 週期會議 / 報表。

## 怎麼用(同仁)
1. 掃門口 QR Code。2. 看今天時段:綠=可訂、紅=已訂。3. 點綠格填姓名/部門/事由送出。4. 點自己的紅格可取消。

## 技術簡述
純 HTML/CSS/JS,部署 GitHub Pages。資料 Upstash Redis(REST),per-slot key + `SET NX` 原子防覆蓋。前端每 ~10 秒輪詢(分頁隱藏時暫停)+ 手動 refresh。

## 給未來維護者
- 真實設定在 `config.js`(已 `.gitignore`,**勿提交 token**),範本見 `templates/config.example.js`。
- 風險與限制見 `SECURITY_NOTES.md`;部署見 `DEPLOYMENT_GUIDE.md`。
- 正式長期使用的第一優先升級:Cloudflare Worker 代理藏 token(見 `ROADMAP.md` 的 hardened path)。

## Harness 文件地圖
- 戰略:`NORTHSTAR.md` `PRODUCT_SPEC.md` `ARCHITECTURE.md` `DATA_MODEL.md` `ROADMAP.md` `DECISIONS.md`
- 代理規範:`AGENTS.md` `CLAUDE_GOAL.md` `harness/SCOPE_GUARD.md` `harness/API_KEY_HANDLING.md`
- 執行狀態:`harness/CURRENT_STATE.md` `harness/NEXT_ACTIONS.md` `harness/BLOCKERS.md` `harness/BUILD_LOG.md` `harness/CHANGELOG.md`
- 品質與運維:`TEST_PLAN.md` `harness/EVAL_CHECKLIST.md` `harness/RUNBOOK.md` `harness/FAILURE_PLAYBOOK.md` `harness/PRODUCTION_READINESS.md` `RELEASE_CHECKLIST.md` `SECURITY_NOTES.md` `DEPLOYMENT_GUIDE.md`
- Prompts:`prompts/`(goal / smoke test / production readiness / recovery)
- 範本:`templates/`
