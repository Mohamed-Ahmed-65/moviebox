const express = require("express");
const addonInterface = require("../addon");

const app = express();

// Mount the Stremio addon router at the root
app.use("/", addonInterface.getRouter());

// Export the Express app for Vercel Serverless
module.exports = app;
