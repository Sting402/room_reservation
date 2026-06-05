# SECURITY_NOTES · 安全與隱私(誠實版)

## 核心事實(必讀,寫給未來維護者與導入決策者)
這是 **Shadow IT MVP**,純前端把 KV token 放在 client。
> **任何拿到網址 + 檢視原始碼的人,都能讀寫資料庫,甚至清空它。**
這不是企業資安系統,不做任何合規承諾(不符 ISO / SOC2 / 個資法高標)。

## 已知風險(誠實列出,不美化)
1. **API token 暴露** — 純前端必然把 Upstash token 放進可被讀取的 JS。拿到即全權。
2. **公開網址** — 任何人開網址即可操作;QR 不公開只是 obscurity,**不是 security**。
3. **惡意覆蓋 / 清空** — token 在手者可亂改或 flush。
4. **PIN 可繞過** — PIN 只防手滑誤刪,hash 與比對都在前端,惡意者可繞過。
5. **免費 KV 限流 / 不穩** — 超額或服務異常會導致同步失敗。
6. **無強身分** — 無法真正驗證「owner」是本人。

## MVP 可接受的最低防護(必須實作)
- **不存機密**:事由欄字數上限 + UI 明文警告「請勿填寫機密」。
- **取消確認 + optional PIN**:降低誤刪。
- **Audit log**(`mrs:log:{date}`):出事可追誰在何時訂/取消。
- **Token 範圍最小化**:Upstash 開**獨立** database,token 只綁這顆,可定期 rotate。
- **config.js 不進版控**(`.gitignore`),只提交 `templates/config.example.js`。
- **寫入驗證**:每條寫入路徑驗欄位與合法值(見 `DATA_MODEL.md`)。

## 不保證 / 不防護(明講)
不防惡意覆蓋、不防 DDoS、不防內部濫用、不加密內容、無合規。

## 唯一正解（放 ROADMAP，不放 MVP）
**Cloudflare Worker 代理**：token 藏 Worker secret；前端只呼叫 Worker；Worker 內做
(a) 寫入白名單（只允許 `SET NX`/`DEL` 指定 key 格式）、(b) 簡單 rate limit、(c) 隱藏真實後端。
這是把它從「能被任何人清空的便利貼」升級為「可信任內部工具」的關鍵一步，**優先於任何花俏功能**。

> **明確聲明（v3）**：直接前端暴露 Upstash token 是 MVP 主動接受的設計取捨，
> 不是疏漏。目前唯一加固路徑是 Cloudflare Worker proxy，已列入 ROADMAP。
> 在此之前，切勿將此工具用於任何敏感會議或機密討論。

## 公司導入注意事項(給決策者)
- 視為「方便的共享便利貼」,不要放任何敏感會議資訊。
- 若要長期正式使用,先做 Worker proxy + 內部存取限制(IP 白名單 / 共用密碼 / SSO 依需求)。
