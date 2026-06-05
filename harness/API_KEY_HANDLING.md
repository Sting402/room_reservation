# API_KEY_HANDLING · 金鑰處理規範(硬規則)

## 鐵則
- **絕不**把真實 token / API key 寫進任何**會進版控**的檔案、程式、commit、log。
- 真實值只放根目錄 `config.js`,且 `config.js` 必須在 `.gitignore`。
- 版控只放 `templates/config.example.js`(佔位字串,如 `"YOUR_UPSTASH_REST_URL"`)。

## Claude Code 行為
- 需要 token 但沒有 → **不要捏造、不要硬寫**。記 `BLOCKERS.md #B001`,把 UpstashAdapter 寫成從 `config` 變數讀取,標 TODO,先把不需 token 的部分(local provider、UI、錯誤處理)全部完成。
- 任何示範/測試需要值時,用 example 佔位字串,並註明「人類需替換」。

## .gitignore 必含
```
config.js
config.public.js   # 若採用「可提交的拋棄式 db 設定」做法,仍建議謹慎
.DS_Store
Thumbs.db
node_modules/
```

## 部署期金鑰(見 DEPLOYMENT_GUIDE)
GitHub Pages 為純前端,token 一旦提交即公開。兩條合法路線:
1. (MVP)接受暴露,只用一顆**拋棄式/隔離** Upstash db,並在頁面警告。
2. (hardened)Cloudflare Worker 藏 token,前端只放 Worker URL。
抉擇記入 `DECISIONS.md`。

## 自查
commit 前必跑:`git grep -nE "(rest.*token|AED|UPSTASH.*=.*[A-Za-z0-9]{20,})" -- . ':!templates'`(或人工檢視 diff),確認無真實憑證外洩。
