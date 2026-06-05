# DEPLOYMENT_GUIDE · 部署指南

## 前置(人類執行,Claude Code 不可代勞)
1. 註冊 Upstash,建立一顆**獨立** Redis database(僅供本工具)。
2. 取得 REST `UPSTASH_REDIS_REST_URL` 與 `UPSTASH_REDIS_REST_TOKEN`。
3. 複製 `templates/config.example.js` 為根目錄 `config.js`,填入上述兩值與房間/時段設定。
4. 確認 `config.js` 已被 `.gitignore` 忽略(切勿提交)。

## 本機測試
直接用任何靜態伺服器開啟(避免 file:// 的 CORS/模組問題):
```
# 擇一
python3 -m http.server 8080
# 或 npx serve .
```
瀏覽器開 `http://localhost:8080`。先用 `provider: "local"` 驗 UI/互動,再切 `provider: "upstash"` 驗真同步。

## 部署到 GitHub Pages
1. 建立 GitHub repo,push 程式碼(**由人類執行;Claude Code 不 push**)。
2. Settings → Pages → Source 選 `main` branch `/ (root)`。
3. 等待發布,取得 `https://<user>.github.io/<repo>/`。
4. **重要**:`config.js` 已 gitignore → Pages 上不會有它。部署用設定有兩種做法:
   - (MVP 簡便)另存一份 `config.public.js` 只含**那顆拋棄式 db** 的設定並提交;**接受 token 暴露**(見 SECURITY_NOTES)。
   - (較佳)走 hardened path 用 Cloudflare Worker,前端只填 Worker URL,無 token。
   此抉擇必須記入 `DECISIONS.md`,且若採前者,README 與頁面需顯示安全警告。

## QR Code
用任一 QR 產生器把 Pages 網址轉成 QR,印三張貼在三間會議室門口(可加房名標示)。

## Rollback
GitHub Pages 重新 build 上一個 commit 即可。資料在 Upstash,與部署解耦。
