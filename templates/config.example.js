// config.example.js — 複製成根目錄 config.js 後填入真實值。
// ⚠ config.js 已被 .gitignore；切勿提交真實 token 到 git。
//
// 使用方式：
//   cp templates/config.example.js config.js
//   填入 Upstash REST URL 與 Token，將 provider 改為 "upstash"
//
// 安全說明：
//   本 MVP 將 Upstash token 直接暴露於前端。這在低風險內部工具中可接受，
//   但不適合公開網路環境。正式加固路徑：使用 Cloudflare Worker 代理藏 token。

window.APP_CONFIG = {
  // "local"   = 瀏覽器 LocalStorage（單機測試用，不跨裝置）
  // "upstash" = Upstash Redis REST（真正跨裝置同步，需填入下方金鑰）
  provider: "local",

  // 三間會議室（固定，ID 不可更動以免影響現有資料）
  rooms: [
    { id: "glass1",   name: "大玻璃屋(左)" },
    { id: "glass2",   name: "小玻璃屋(右)" },
    { id: "showroom", name: "展間會議室" }
  ],

  // 時段設定（slot 清單由此推導，不可寫死）
  schedule: {
    open: "09:00",               // 開始時間（Asia/Taipei）
    close: "18:00",              // 結束時間
    granularityMinutes: 60,      // 每格時長（分鐘）；60 = 9 格 09:00~18:00
    timezone: "Asia/Taipei"
  },

  pollIntervalSeconds: 10,       // 自動刷新間隔（秒）
  purposeMaxLength: 30,          // 用途欄字數上限
  enablePin: true,               // 是否允許設定取消 PIN（選填功能）

  // Upstash Redis REST — 僅 provider="upstash" 時需要
  // 真實金鑰放在根目錄 config.js（已 .gitignore），切勿提交此處的真實值
  upstash: {
    restUrl:   "YOUR_UPSTASH_REDIS_REST_URL",
    restToken: "YOUR_UPSTASH_REDIS_REST_TOKEN"
  }
};
