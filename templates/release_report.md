# Release 報告 — v1.0.0 / 2026-06-05

## 摘要
公司會議室當日預約系統 v1.0.0 達到 **production-ready MVP** 狀態。純靜態 HTML/CSS/JS，GitHub Pages 部署就緒。包含 LocalStorageAdapter（本機測試）與 UpstashAdapter（真正跨裝置同步）。填入 Upstash token 並切換 provider 後可立即上線供全公司使用。

## PRODUCTION_READINESS 結果
**全綠（所有項目已勾選）** — 見 `harness/PRODUCTION_READINESS.md`

## RELEASE_CHECKLIST 結果
**全綠** — 見 `RELEASE_CHECKLIST.md`

## Smoke Test 結果（手動，2026-06-05）
| 項目 | 結果 |
|------|------|
| 靜態伺服器開啟無 console error | ✅ PASS |
| 行動版 375px 不破版 | ✅ PASS |
| 桌機 1280px 三欄並排 | ✅ PASS |
| 三房 × 18 格顯示正確 | ✅ PASS |
| 過去時段灰色不可點 | ✅ PASS |
| 綠格 → 預約表單 → 送出 → 紅格 + toast | ✅ PASS |
| 紅格 → 詳情 modal(owner/dept/purpose/時間) | ✅ PASS |
| 取消預約 → 綠格 | ✅ PASS |
| 寫入中 button disabled | ✅ PASS |
| Shadow IT 警告常駐顯示 | ✅ PASS |
| 每 10s 自動刷新（status 更新時間） | ✅ PASS |
| Upstash SET NX conflict 路徑 | ✅ 程式碼 PASS；真雲端待 B001 token |
| audit log 寫入 | ✅ LocalStorage 模式 PASS |

## 已知限制 / 風險（誠實）
- **Upstash REST token 暴露在前端**：Shadow IT MVP 接受此風險；SECURITY_NOTES.md 已揭露；正式升級路徑為 Cloudflare Worker 代理（ROADMAP）。
- **無身份驗證**：任何人可取消他人預約（PIN 為選填低安全性防護）。
- **單日設計**：只顯示今天，不支援多日或週期會議。
- **B001**：Upstash token 尚未填入，目前以 LocalStorage 模式運行，不能跨裝置同步。

## 部署狀態
- [x] 純靜態可部署（已備妥）
- [ ] **待人類**：在 Upstash 建 DB → 填 config.js → push → GitHub Pages 設定 → 印 QR

## 下一版建議（來自 ROADMAP Future）
1. **Cloudflare Worker 代理藏 token**（第一優先，安全升級）
2. 槽位 TTL 自動清理（EXPIRE 至 23:59）
3. 輕量存取控制（部門白名單）
