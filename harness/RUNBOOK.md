# RUNBOOK · 操作手冊

## 本機開發
```
# 在 repo 根目錄
python3 -m http.server 8080      # 或 npx serve .
# 開 http://localhost:8080
```
- 切 provider:編輯 `config.js` 的 `provider`("local" / "upstash")。
- 重置本機資料(local provider):瀏覽器 devtools → Application → Local Storage → 清除,或在 console 跑清除函式。

## 切到 Upstash
1. `config.js` 填 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`,`provider:"upstash"`。
2. 重整頁面,確認讀寫成功(network 面板看 200)。

## 檢查 audit log(Upstash)
用 Upstash console 或 REST `LRANGE mrs:log:{date} 0 -1`。

## 清空當日資料(謹慎)
人工於 Upstash console 刪 `mrs:{date}:*`。MVP 不提供前端清空(避免誤觸)。

## 常見指令
- 看 git 狀態確保乾淨:`git status`
- local commit(允許時):`git add -A && git commit -m "繁中訊息"`
- **不要** `git push`(留給人類)。
