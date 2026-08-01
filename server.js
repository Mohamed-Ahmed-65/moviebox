const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

const PORT = process.env.PORT || 7000;

serveHTTP(addonInterface, { port: PORT });

console.log(`
=========================================
 🎬 MovieBox Streams Addon is RUNNING!
=========================================
 📌 URL: http://127.0.0.1:${PORT}/manifest.json
 🌐 Source: movie-box.co
=========================================
`);