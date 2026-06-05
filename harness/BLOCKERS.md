# BLOCKERS · 阻擋事項(只記真 blocker)

真 blocker = 需要外部帳號/token、部署憑證、重大產品/安全決策。其餘用 assumption 解決並記 DECISIONS。

格式:`#編號 狀態(OPEN/RESOLVED) — 描述 / 需要人類做什麼 / 影響哪個 milestone`

## #B001 OPEN — Upstash REST URL + Token(影響 Milestone F 起的真同步)
需要人類:在 Upstash 建獨立 db,把 URL/token 填入 gitignored `config.js`。
在此之前:Claude Code 仍可把 local provider 全部完成,並把 UpstashAdapter 程式寫好(以 config 變數讀取,不硬寫),標 TODO 等 token 後驗證。

## #B002 OPEN — GitHub repo / Pages 部署(影響 Milestone I 上線)
需要人類:建 repo、設定 Pages、執行 push。Claude Code 只準備好可部署狀態,不 push。

<!-- 新 blocker 往下加;解決後改 RESOLVED 並註明 -->
