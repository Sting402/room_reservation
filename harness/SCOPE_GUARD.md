# SCOPE_GUARD · 範圍護欄(紅線,違反即失敗)

Claude Code 在每輪 Evaluate 都要對照本清單。**以下一律不做(第一版)**:

## 絕對禁區
- ❌ 登入 / 帳號系統 / SSO
- ❌ 員工資料庫 / 通訊錄整合
- ❌ 角色權限 / 管理後台 / admin dashboard
- ❌ Outlook / Google Calendar 整合
- ❌ 多日 / 週檢視 / 月曆
- ❌ 週期性(recurring)會議
- ❌ 報表 / 統計 / 分析
- ❌ 多分公司 / 多樓層 / 多棟架構
- ❌ 儲存任何機密內容
- ❌ 自架後端伺服器(MVP 用免費 KV;hardened 才考慮 Worker proxy)
- ❌ 把 MVP 重構成 SaaS / 大型平台

## 灰色地帶判準
若某想法不在 `PRODUCT_SPEC.md` 的 MUST/MAY,預設**不做**。真有價值 → 寫進 `ROADMAP.md` Future,**不在這版實作**。

## 觸線時的動作
立即停手該想法 → 在 `DECISIONS.md` 記「拒絕擴張:理由」→ 回到 `NEXT_ACTIONS.md` 既定路線。

> 記住:能用的小刀 > 沒完工的屠龍刀。多做的每一個功能都在偷走「把核心做完」的時間。
