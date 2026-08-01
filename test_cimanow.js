const cheerio = require("cheerio");
const fs = require("fs");

async function run() {
    const url = "https://cimanow.cc/فيلم-batman-begins-2005-مترجم/watching/";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
        "Referer": "https://cimanow.cc/فيلم-batman-begins-2005-مترجم/"
    };
    
    try {
        console.log("Fetching...", url);
        const res = await fetch(url, { headers });
        const html = await res.text();
        fs.writeFileSync("watch.html", html);
        
        const $ = cheerio.load(html);
        const iframes = $("iframe").map((i, el) => $(el).attr("src") || $(el).attr("data-src")).get();
        const sources = $("source").map((i, el) => $(el).attr("src")).get();
        const links = $("a").map((i, el) => $(el).attr("href")).get();
        const serverLinks = links.filter(l => l && (l.includes("vid") || l.includes("embed") || l.includes("watch") || l.includes("download") || l.includes("server")));
        
        console.log("Iframes:", iframes);
        console.log("Sources:", sources);
        console.log("Possible Server Links:", serverLinks.slice(0, 10));
    } catch(err) {
        console.error(err);
    }
}
run();
