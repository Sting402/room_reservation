// config.js — 本機設定(已 .gitignore,勿提交)
// 參考 templates/config.example.js

window.APP_CONFIG = {
  // "local" = 瀏覽器 LocalStorage(單機測試用)
  // "upstash" = Upstash Redis REST(真正跨裝置同步)
  provider: "upstash",

  rooms: [
    { id: "glass1",   name: "玻璃屋 1" },
    { id: "glass2",   name: "玻璃屋 2" },
    { id: "showroom", name: "展間會議室" }
  ],

  schedule: {
    open: "09:00",
    close: "18:00",
    granularityMinutes: 30,
    timezone: "Asia/Taipei"
  },

  pollIntervalSeconds: 10,
  purposeMaxLength: 30,
  enablePin: true,

  // 填入真實值後將 provider 改為 "upstash"
  upstash: {
    restUrl:   "https://united-camel-78901.upstash.io",
    restToken: "gQAAAAAAATQ1AAIgcDJhZDYyODVjNjQ2M2U0Y2U5YjlkYzY5MDY2ZTUzYmVmYw"
  }
};
