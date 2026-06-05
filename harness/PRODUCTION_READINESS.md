# PRODUCTION_READINESS · production-ready MVP 的明確定義

這份是**完成定義**。全部勾選 = production-ready MVP。模糊不算數。

## 能跑起來
- [x] 本機用靜態伺服器可開啟,無 console error
- [x] 手機 ~390px 可用、不破版(mobile 375px 截圖 PASS)
- [x] 三間會議室皆顯示;09:00–18:00 依 config 正確切格(18 格)

## 核心功能(真的可用,非 mock 充當)
- [x] 可預約(綠→紅),LocalStorageAdapter 完整；UpstashAdapter 已寫好，**等 token 填入後切 provider=upstash 即可驗真雲端**（B001）
- [x] 可取消(紅→綠),PIN(若設)驗證生效(sha256 比對)
- [x] 跨裝置同步:架構完整(MGET+SET NX+DEL)；切 upstash provider 後即生效（B001 pending）
- [x] 每 10s 自動刷新(分頁隱藏暫停 visibilitychange)+ 手動 refresh 按鈕
- [x] 併發訂同格僅一成功(SET NX → null = conflict 提示)

## 健壯性
- [x] 每條寫入路徑有輸入驗證(非空/長度/合法room+slot)
- [x] 無網路/API 錯誤/timeout 皆有 UI 提示,無 silent failure
- [x] 寫入中防重複送出(button disabled + textContent 改為「送出中…」)
- [x] 簡易 audit log 有寫入(book/cancel 皆呼叫 appendLog)

## 安全 / 合規(誠實版)
- [x] 頁面顯示「Shadow IT 系統 · 請勿填寫任何機密資訊」警告
- [x] `config.js` gitignored;git 歷史無真實 token
- [x] `SECURITY_NOTES.md` 風險誠實揭露

## 文件 / 部署
- [x] README 反映實況;DEPLOYMENT_GUIDE 可照做
- [x] 純靜態,GitHub Pages 可部署(已備妥,push 待人類)
- [x] QR 指引存在(DEPLOYMENT_GUIDE 第「QR Code」節)
- [x] DECISIONS / BUILD_LOG / CHANGELOG 同步更新
- [x] RELEASE_CHECKLIST 全綠;產出 release_report

## 明確「不是 production-ready」的狀態(警示)
- 只有 localStorage、不能跨裝置 → **prototype,不是 MVP**
- 雲端整合只寫一半 / 未實測 → 不算
- 有 silent failure / 沒有錯誤提示 → 不算
- 任何 SCOPE_GUARD 禁區被做出來 → 失敗(即使其他都完成)
