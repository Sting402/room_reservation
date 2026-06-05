// config.example.js — 複製成根目錄 config.js 後填入真實值。
// ⚠ config.js 已被 .gitignore;切勿提交真實 token。
window.APP_CONFIG = {
  // "local" = 用瀏覽器 LocalStorage(prototype/離線);"upstash" = 真雲端同步
  provider: "local",

  // 三間會議室(固定)
  rooms: [
    { id: "glass1",   name: "玻璃屋 1" },
    { id: "glass2",   name: "玻璃屋 2" },
    { id: "showroom", name: "展間會議室" }
  ],

  // 時段設定(slot 由此推導,未來可改 15 / 30 / 60)
  schedule: {
    open: "09:00",
    close: "18:00",
    granularityMinutes: 30,
    timezone: "Asia/Taipei"
  },

  // 行為
  pollIntervalSeconds: 10,     // 自動刷新間隔
  purposeMaxLength: 30,        // 事由字數上限
  enablePin: true,             // 是否允許設定取消 PIN(選填功能)

  // Upstash REST(僅 provider="upstash" 時需要;真值放 config.js,勿提交)
  upstash: {
    restUrl: "YOUR_UPSTASH_REDIS_REST_URL",
    restToken: "YOUR_UPSTASH_REDIS_REST_TOKEN"
  }
};
