const cheerio = require("cheerio");
const fs = require('fs');

const MYCIMA_URL = "https://mywecima.website";
const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
    "Connection": "keep-alive",
};

async function fetchHtml(url) {
    const response = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return await response.text();
}

async function doMyCimaSearch(searchQuery) {
    try {
        const searchUrl = `${MYCIMA_URL}/search.php?keywords=${encodeURIComponent(searchQuery)}`;
        const html = await fetchHtml(searchUrl);
        const $ = cheerio.load(html);
        const results = [];

        $("ul.pm-ul-browse-videos li .thumbnail").each((i, el) => {
            const $titleLink = $(el).find(".caption h3 a");
            const link = $titleLink.attr("href");
            const name = $titleLink.text().trim();
            
            if (link && link !== "#modal-login-form" && name) {
                results.push({
                    name,
                    url: link.startsWith("http") ? link : `${MYCIMA_URL}${link}`,
                    source: "mycima"
                });
            }
        });

        return results;
    } catch (err) {
        console.error("[MyCima Search Error]", err.message);
        return [];
    }
}

async function searchMyCima(searchQuery) {
    let cleanQuery = searchQuery.replace(/[^\u0621-\u064A0-9a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    cleanQuery = cleanQuery.replace(/[أإآ]/g, 'ا');

    console.log(`[MyCima] Cleaned Query: ${cleanQuery}`);
    let results = await doMyCimaSearch(cleanQuery);
    
    if (results.length === 0) {
        let parts = cleanQuery.split(' ');
        if (parts.length > 1) {
            let firstWord = parts[0];
            console.log(`[MyCima] Fallback first word: ${firstWord}`);
            results = await doMyCimaSearch(firstWord);
        }
    }

    if (results.length > 0) {
        const exactMatchIndex = results.findIndex(r => r.name.includes(cleanQuery) || r.name.includes(searchQuery));
        if (exactMatchIndex > 0) {
            const exactMatch = results.splice(exactMatchIndex, 1)[0];
            results.unshift(exactMatch);
        }
    }

    console.log(`[MyCima] Found ${results.length} results for: ${cleanQuery}`);
    return results;
}

async function runTest() {
    console.log("Testing search for: الخلاط+");
    const results = await searchMyCima("الخلاط+");
    console.log("Search results:");
    console.log(results);
}
runTest();
