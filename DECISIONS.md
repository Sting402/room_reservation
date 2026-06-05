# DECISIONS · 決策紀錄(ADR-lite)

格式:`#編號 日期 — 決策 / 理由 / 狀態`。Claude Code 採用任何 assumption 或重大抉擇都要追加一條。

## #001 2026-06-05 — 雲端資料採 Upstash Redis REST
理由:免費 500K cmd/月足夠、瀏覽器 CORS 原生、`SET NX` 真原子防覆蓋、`MGET` 一次讀全天。JSONBin 免費為一次性 10K 故淘汰。狀態:Accepted。

## #002 2026-06-05 — per-slot key + SET NX 作為 conflict 機制
理由:從根本消滅同格覆蓋,避免 read-modify-write 競態。狀態:Accepted。

## #003 2026-06-05 — 純靜態,不用 Vite
理由:三檔 + css 足夠;少一層 build 對 Shadow IT MVP 更易維護與部署。狀態:Accepted。

## #004 2026-06-05 — KV adapter 抽象 + provider 切換(local / upstash)
理由:先用 local 跑通互動,再無痛接雲端;應用層不綁 provider。狀態:Accepted。

## #005 2026-06-05 — PIN 為選填且低安全性
理由:只防誤刪,不防惡意;前端可繞過。已於 SECURITY_NOTES 揭露。狀態:Accepted。

## #006 2026-06-05 — slot 由 config(open/close/granularity)推導,預設 30 分
理由:未來可改 15/30/60,不寫死 18 格。狀態:Accepted。

## #007 2026-06-05 — Cloudflare Worker proxy 列為 ROADMAP,不在 MVP
理由:藏 token 是唯一正解但會多一層 serverless;MVP 先誠實接受 token 暴露並警告。狀態:Accepted。

## #008 2026-06-05 — 靜態檔案放 assets/ 子目錄
理由:index.html 在根目錄(GitHub Pages 要求),JS/CSS 放 assets/ 保持整潔。狀態:Accepted。

## #009 2026-06-05 — 行動版 Tab UI，桌機三欄並排
理由:行動版空間有限採 tab 切換單室;桌機 ≥768px 用 CSS grid 三欄並排隱藏 tab。狀態:Accepted。

## #010 2026-06-05 — 身份持久化用 localStorage mrs:identity(name+dept)
理由:無登入系統,記住上次填寫的姓名/部門節省重複輸入。非機密欄位。狀態:Accepted。

## #011 2026-06-05 — config.js 以 onerror 捕捉載入失敗,顯示設定引導畫面
理由:GitHub Pages 沒有 config.js 時頁面仍可載入並顯示友善說明,不爆 JS error。狀態:Accepted。

## #012 2026-06-05 — UI/UX 升級：V1 採單一 30 分 slot 預約
理由：多 slot 連續預約需要 Lua EVAL 原子化，複雜度高；V1 先用單 slot 確保穩定性，KV adapter 不需改動。多 slot 列入 ROADMAP。狀態：Accepted。

## #013 2026-06-05 — 移除 overlay backdrop-filter
理由：backdrop-filter: blur() 在部分渲染環境（headless Chromium）造成截圖/渲染 hang；移除後功能不受影響，視覺差異極小。狀態：Accepted。

## #014 2026-06-05 — Header backdrop-filter 同步移除
理由：同上，與 #013 一致避免潛在渲染問題；frosted glass 效果以純 rgba 背景替代。狀態：Accepted。

## #015 2026-06-05 — 升級至本年度任意日期預約（v3）
理由：原本的 todayDate-only 架構已足夠 MVP，但真實使用需要提前預約。key 格式 mrs:{date}:{room_id}:{slot} 天生支援任意日期，只需在 app.js 引入 selectedDate 概念即可，無需資料遷移。狀態：Accepted。

## #016 2026-06-05 — 過去日期僅供查閱，不允許新增/取消
理由：避免預約過去已發生的時段造成混淆；審計完整性。狀態：Accepted。

## #017 2026-06-05 — selectedDate 存於 localStorage，預設今天
理由：使用者重整後保留上次瀏覽的日期，提升體驗；若 localStorage 值無效或跨年則 fallback 到今天。狀態：Accepted。

## #018 2026-06-05 — 不實作全年曆格，採 <input type="date">
理由：規格明確說「不要建全年曆格除非已經很容易」；日期 input 原生支援 min/max 且手機鍵盤友善。狀態：Accepted。

## #019 2026-06-05 — onDateChange 立即 renderDashboard 再 load()
理由：load() 有 isLoading guard 防 concurrent poll，但 date 切換時必須保證 renderDashboard 被執行；解法：reset isLoading=false + 先 renderDashboard()（空資料）再 load()（補真實資料）。狀態：Accepted。

## #020 2026-06-05 — schedule open 設定 08:00（規格要求）
理由：產品規格明確要求 08:00–18:00 共 10 格；之前曾改為 09:00 屬暫時偏差，現恢復。狀態：Accepted。

<!-- Claude Code 在此往下追加新決策 -->
