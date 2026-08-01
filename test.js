const cheerio = require("cheerio");
const fs = require("fs");

async function run() {
    const response = await fetch("https://cimanow.cc/?s=Batman");
    const html = await response.text();
    fs.writeFileSync("output.html", html);
    console.log("Written to output.html");
}
run();
