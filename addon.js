const { addonBuilder } = require("stremio-addon-sdk");
const crypto = require("crypto");

// ============================================
//  MANIFEST
// ============================================
const manifest = {
    id: "org.custom.moviebox",
    version: "3.0.0",
    name: "Movie Box 🎬",
    description: "مصادر MovieBox لمشاهدة الأفلام والمسلسلات بجودة عالية باللغة الإنجليزية والعربية",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
    logo: "https://movie-box.co/favicon.ico",
    behaviorHints: { configurable: false, configurationRequired: false }
};

const builder = new addonBuilder(manifest);

// ============================================
//  TMDB & Cinemeta
// ============================================
const TMDB_API_KEY = process.env.TMDB_API_KEY || "dbef9a724f4e0c6209f132c4eb13429f";

async function getMetaData(type, imdbId) {
    try {
        const response = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
        const data = await response.json();
        return data.meta;
    } catch (err) {
        console.error("[Cinemeta Error]", err.message);
        return null;
    }
}

async function getArabicNameFromTMDB(imdbId, type) {
    try {
        if (!TMDB_API_KEY) return null;
        const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=ar`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        if (type === "movie" && data.movie_results && data.movie_results.length > 0) {
            let name = data.movie_results[0].title;
            return name ? name.replace(/ک/g, 'ك').replace(/ی/g, 'ي') : null;
        } else if (type === "series" && data.tv_results && data.tv_results.length > 0) {
            let name = data.tv_results[0].name;
            return name ? name.replace(/ک/g, 'ك').replace(/ی/g, 'ي') : null;
        }
    } catch (err) {
        console.error("[TMDB Error]", err.message);
    }
    return null;
}

async function getEnglishNameFromTMDB(imdbId, type) {
    try {
        if (!TMDB_API_KEY) return null;
        const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=en`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        if (type === "movie" && data.movie_results && data.movie_results.length > 0) {
            return data.movie_results[0].title || null;
        } else if (type === "series" && data.tv_results && data.tv_results.length > 0) {
            return data.tv_results[0].name || null;
        }
    } catch (err) {
        console.error("[TMDB Error]", err.message);
    }
    return null;
}

// ============================================
//  MovieBox Crypto Module
// ============================================
const SECRET_KEY_DEFAULT = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
const SECRET_KEY_ALT = "Xqn2nnO41/L92o1iuXhSLHTbXvY4Z5ZZ62m8mSLA";
const SIGNATURE_BODY_MAX_BYTES = 102400;

function md5Hex(data) {
    return crypto.createHash("md5").update(data).digest("hex");
}

function b64Decode(value) {
    // Add padding if needed
    const padding = (4 - (value.length % 4)) % 4;
    return Buffer.from(value + "=".repeat(padding), "base64");
}

function b64Encode(data) {
    return Buffer.from(data).toString("base64");
}

function generateXClientToken(timestampMs) {
    const ts = String(timestampMs);
    const reversedTs = ts.split("").reverse().join("");
    const hashVal = md5Hex(Buffer.from(reversedTs, "utf-8"));
    return `${ts},${hashVal}`;
}

function sortedQueryString(url) {
    try {
        const parsed = new URL(url);
        const params = Array.from(parsed.searchParams.entries());
        if (params.length === 0) return "";
        params.sort((a, b) => a[0].localeCompare(b[0]));
        return params.map(([k, v]) => `${k}=${v}`).join("&");
    } catch {
        return "";
    }
}

function buildCanonicalString(method, accept, contentType, url, body, timestampMs) {
    let path = "";
    try {
        const parsed = new URL(url);
        path = parsed.pathname || "";
    } catch {
        path = url.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
    }
    
    const query = sortedQueryString(url);
    const canonicalUrl = query ? `${path}?${query}` : path;

    let bodyHash = "";
    let bodyLength = "";
    if (body !== null && body !== undefined) {
        const bodyBytes = Buffer.from(body, "utf-8");
        const truncated = bodyBytes.slice(0, SIGNATURE_BODY_MAX_BYTES);
        bodyHash = md5Hex(truncated);
        bodyLength = String(bodyBytes.length);
    }

    return [
        method.toUpperCase(),
        accept || "",
        contentType || "",
        bodyLength,
        String(timestampMs),
        bodyHash,
        canonicalUrl
    ].join("\n");
}

function generateXTrSignature(method, accept, contentType, url, body, timestampMs, useAltKey = false) {
    const canonical = buildCanonicalString(method, accept, contentType, url, body, timestampMs);
    const secretB64 = useAltKey ? SECRET_KEY_ALT : SECRET_KEY_DEFAULT;
    const secretBytes = b64Decode(secretB64);
    const mac = crypto.createHmac("md5", secretBytes).update(canonical, "utf-8").digest();
    const sigB64 = b64Encode(mac);
    return `${timestampMs}|2|${sigB64}`;
}

function generateClientInfoAndUA() {
    const androidVersions = [
        ["9", "PQ3A.190605.03081104"],
        ["10", "QP1A.191005.007.A3"],
        ["11", "RP1A.200720.011"],
        ["12", "S1B.220414.015"],
        ["13", "TQ2A.230405.003"],
    ];
    const redmiDevices = [
        ["23078RKD5C", "Redmi"],
        ["22011117TY", "Redmi"],
        ["22011117TG", "Redmi"],
        ["22101316G", "Redmi"],
        ["21121210G", "Redmi"],
        ["M2012K11AG", "Redmi"],
        ["M2007J20CG", "Redmi"],
    ];
    const versionCodes = [500200042, 500200043, 500200044, 500200045, 500200046];
    const networkTypes = ["NETWORK_WIFI", "NETWORK_MOBILE"];
    const timezones = ["Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "America/New_York", "Europe/London"];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const android = pick(androidVersions);
    const device = pick(redmiDevices);
    const versionCode = pick(versionCodes);
    const network = pick(networkTypes);
    const timezone = pick(timezones);
    const gaid = crypto.randomUUID();
    const deviceId = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

    const userAgent = `com.community.oneroom/${versionCode} (Linux; U; Android ${android[0]}; en_US; ${device[1]}; Build/${android[1]}; Cronet/135.0.7012.3)`;
    
    const clientInfo = JSON.stringify({
        package_name: "com.community.oneroom",
        version_name: "3.0.03.0529.03",
        version_code: versionCode,
        os: "android",
        os_version: android[0],
        install_ch: "ps",
        device_id: deviceId,
        install_store: "ps",
        gaid: gaid,
        brand: device[1],
        model: device[0],
        system_language: "en",
        net: network,
        region: "US",
        timezone: timezone,
        sp_code: "40401",
        "X-Play-Mode": "2"
    });

    return { userAgent, clientInfo };
}

function randomSpoofedIp() {
    const host = Math.floor(Math.random() * 254) + 1;
    return `103.241.224.${host}`;
}

function buildSignedHeaders(method, url, body, authToken, clientInfo, userAgent, spoofedIp) {
    const accept = "application/json";
    const contentType = "application/json";
    const ts = Date.now();

    const headers = {
        "User-Agent": userAgent,
        "Accept": accept,
        "Content-Type": contentType,
        "Connection": "keep-alive",
        "X-Client-Token": generateXClientToken(ts),
        "x-tr-signature": generateXTrSignature(method, accept, contentType, url, body, ts),
        "X-Client-Info": clientInfo,
        "X-Client-Status": "0",
        "X-Forwarded-For": spoofedIp,
    };

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    return headers;
}

// ============================================
//  MovieBox API Client
// ============================================
const HOST_POOL = [
    "https://api6.aoneroom.com",
    "https://api5.aoneroom.com",
    "https://api4.aoneroom.com",
    "https://api4sg.aoneroom.com",
    "https://api3.aoneroom.com",
    "https://api6sg.aoneroom.com",
    "https://api.inprovider.com",
];

let globalSharedToken = null;
let globalSharedTokenExpiry = 0;

class MovieBoxClient {
    constructor() {
        this.hostPool = HOST_POOL;
        this.activeBase = this.hostPool[0];
        this.runtimeToken = globalSharedToken;
        const { userAgent, clientInfo } = generateClientInfoAndUA();
        this.userAgent = userAgent;
        this.clientInfo = clientInfo;
        this.spoofedIp = randomSpoofedIp();
    }

    async start() {
        if (globalSharedToken && Date.now() < globalSharedTokenExpiry) {
            this.runtimeToken = globalSharedToken;
            return this;
        }
        // Initialize by making a warm-up request to get auth token
        try {
            await this._request("GET", "/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=");
        } catch (err) {
            console.error("[MovieBox] Warm-up request failed (non-fatal):", err.message);
        }
        return this;
    }

    _absorbXUser(headers) {
        const xUser = headers.get ? headers.get("x-user") : headers["x-user"];
        if (xUser) {
            try {
                const payload = JSON.parse(xUser);
                if (payload.token) {
                    this.runtimeToken = payload.token;
                    globalSharedToken = payload.token;
                    globalSharedTokenExpiry = Date.now() + 30 * 60 * 1000;
                    console.log("[MovieBox] Auth token acquired");
                }
            } catch {}
        }
    }

    async _request(method, pathAndQuery, body = null) {
        let lastException = null;
        const badStatuses = new Set([403, 406, 407, 429, 500, 502, 503, 504]);

        for (const base of this.hostPool) {
            const url = `${base}${pathAndQuery}`;
            const headers = buildSignedHeaders(
                method, url, body,
                this.runtimeToken, this.clientInfo, this.userAgent, this.spoofedIp
            );

            try {
                const fetchOpts = {
                    method,
                    headers,
                    signal: AbortSignal.timeout(15000),
                };

                if (method === "POST" && body) {
                    fetchOpts.body = body;
                }

                const response = await fetch(url, fetchOpts);
                
                // Try to absorb auth token from response
                this._absorbXUser(response.headers);

                if (!badStatuses.has(response.status)) {
                    this.activeBase = base;
                    return response;
                }
                
                console.warn(`[MovieBox] Host ${base} returned ${response.status}, trying next...`);
            } catch (exc) {
                lastException = exc;
                console.warn(`[MovieBox] Host ${base} failed: ${exc.message}, trying next...`);
            }
        }

        throw new Error(`All MovieBox hosts exhausted for ${pathAndQuery}. Last error: ${lastException?.message}`);
    }

    async get(path) {
        const response = await this._request("GET", path);
        return this._processResponse(await response.json());
    }

    async post(path, jsonData) {
        const body = JSON.stringify(jsonData);
        const response = await this._request("POST", path, body);
        return this._processResponse(await response.json());
    }

    _processResponse(data) {
        if (data.code === 0 && data.message === "ok") {
            return data.data || {};
        }
        // Some endpoints return data differently
        if (data.data) return data.data;
        throw new Error(`MovieBox API Error: ${JSON.stringify(data).substring(0, 200)}`);
    }
}

// ============================================
//  MovieBox Search & Stream Extraction
// ============================================
async function searchMovieBox(query, isMovie) {
    console.log(`[MovieBox] Searching for: "${query}" (${isMovie ? "movie" : "series"})`);
    
    const client = new MovieBoxClient();
    await client.start();

    const subjectType = isMovie ? 1 : 2;
    const payload = {
        keyword: query,
        page: 1,
        perPage: 20,
        subjectType: subjectType,
        tabId: "All"
    };

    try {
        // Try v2 search endpoint first
        let data;
        try {
            data = await client.post("/wefeed-mobile-bff/subject-api/search/v2", payload);
        } catch {
            // Fallback to v1
            delete payload.tabId;
            data = await client.post("/wefeed-mobile-bff/subject-api/search", payload);
        }

        let items = [];
        
        // v2 format: data.results[0].subjects
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const subjects = data.results[0].subjects || [];
            items = subjects.filter(sub => sub.subjectType === subjectType);
        }
        // v1 format: data.items
        else if (data.items && Array.isArray(data.items)) {
            items = data.items.filter(sub => sub.subjectType === subjectType);
        }

        console.log(`[MovieBox] Found ${items.length} results for "${query}"`);
        return { items, client };
    } catch (err) {
        console.error("[MovieBox Search Error]", err.message);
        return { items: [], client };
    }
}

function shouldKeepLanguage(langStr) {
    const lang = (langStr || "").toLowerCase().trim();
    // Keep empty (original language releases usually have no tag)
    if (lang === "") return true;
    
    // Keep English/Original tags
    if (lang.includes("english") || lang.includes("en") || lang.includes("original")) {
        return true;
    }
    
    // Keep Arabic tags
    if (lang.includes("arabic") || lang.includes("ar")) {
        return true;
    }
    
    return false;
}

function extractDubbings(title, corner) {
    const tags = [];
    if (corner) {
        tags.push(corner.trim());
    }
    const matches = title.matchAll(/\[(.*?)\]|\((.*?)\)/g);
    for (const match of matches) {
        const val = match[1] || match[2];
        if (val) {
            tags.push(val.trim());
        }
    }
    return [...new Set(tags)];
}

function normalizeArabic(text) {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[گك]/g, "k") // normalize Kaaf/Gaf
        .replace(/[٠۰]/g, "0")
        .replace(/[١۱]/g, "1")
        .replace(/[٢۲]/g, "2")
        .replace(/[٣۳]/g, "3")
        .replace(/[٤۴]/g, "4")
        .replace(/[٥۵]/g, "5")
        .replace(/[٦۶]/g, "6")
        .replace(/[٧۷]/g, "7")
        .replace(/[٨۸]/g, "8")
        .replace(/[٩۹]/g, "9")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanTitle(title) {
    return title.replace(/\[.*?\]|\(.*?\)/g, "").trim();
}

function extractYear(item) {
    const rd = item.releaseDate;
    if (!rd) return "";
    if (typeof rd === "string" && rd.includes("-")) {
        return rd.split("-")[0];
    }
    return String(rd);
}

async function findMovieBoxMatches(title, year, isMovie, season = 1) {
    const { items, client } = await searchMovieBox(title, isMovie);
    
    if (items.length === 0) return [];

    const targetClean = normalizeArabic(cleanTitle(title));
    const targetSeasonTitle = `${targetClean} s${season}`;
    const matches = [];

    for (const item of items) {
        const itemClean = normalizeArabic(cleanTitle(item.title || ""));
        const itemYear = extractYear(item);

        console.log(`[MovieBox] Checking: "${item.title}" (${itemYear}) vs "${title}" (${year})`);

        // Match by title
        const titleMatch = itemClean === targetClean || 
                          itemClean === targetSeasonTitle ||
                          itemClean.includes(targetClean) ||
                          targetClean.includes(itemClean);

        if (titleMatch) {
            // For movies, also check year
            if (isMovie && year && itemYear && itemYear !== String(year)) {
                console.log(`[MovieBox] Year mismatch: ${itemYear} vs ${year}, skipping`);
                continue;
            }

            const audioLangs = extractDubbings(item.title || "", item.corner || "");
            const langStr = audioLangs.join(", ");
            
            // Discard unwanted languages (Hindi, Portuguese, Spanish, etc.)
            if (!shouldKeepLanguage(langStr)) {
                console.log(`[MovieBox] Discarding match "${item.title}" due to unwanted language: ${langStr}`);
                continue;
            }

            console.log(`[MovieBox] ✓ Matched: "${item.title}"`);
            matches.push({ item, client, audioLangs });

            // Try to fetch dubbing variants, but only add them if they are Arabic
            try {
                const detailRes = await client.get(`/wefeed-mobile-bff/subject-api/get?subjectId=${item.subjectId}&update=0&status=0`);
                const dubs = detailRes.dubs || [];
                for (const dub of dubs) {
                    const dubId = String(dub.subjectId || "");
                    const dubName = (dub.lanName || dub.name || "").replace(" dub", "").replace(" Audio", "");

                    if (dubId && dubId !== String(item.subjectId)) {
                        const isArabic = dubName.toLowerCase().includes("arabic") || dubName.toLowerCase().includes("ar");
                        if (isArabic) {
                            if (!matches.some(m => String(m.item.subjectId) === dubId)) {
                                const mockItem = { ...item, subjectId: dubId };
                                matches.push({
                                    item: mockItem,
                                    client,
                                    audioLangs: [dubName]
                                });
                                console.log(`[MovieBox] Added Arabic dubbing variant: ${dubName} (${dubId})`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("[MovieBox] Error fetching dub details:", err.message);
            }
        }
    }

    console.log(`[MovieBox] Total matched: ${matches.length} results`);
    return matches;
}

async function getMovieBoxStreams(matches, isMovie, season = 1, episode = 1) {
    const allStreams = [];

    // Parallel fetch for all matches and all resolutions
    const matchPromises = matches.map(async (match) => {
        const { item, client, audioLangs } = match;
        const subjectId = item.subjectId;
        const resolutions = [2160, 1080, 720, 480, 0];

        const resPromises = resolutions.map(async (res) => {
            try {
                let path = `/wefeed-mobile-bff/subject-api/resource?subjectId=${subjectId}&resolution=${res}&page=1&perPage=20`;
                if (!isMovie) {
                    path += `&se=${season}&epFrom=${episode}&epTo=${episode}&all=0&pagerMode=0`;
                }

                const data = await client.get(path);
                const fileList = data.fileList || data.file_list || data.list || data.files || data.items || [];
                const actualList = Array.isArray(data) ? data : (Array.isArray(fileList) ? fileList : []);

                const localStreams = [];
                for (const file of actualList) {
                    if (!isMovie) {
                        const fileSe = file.se || file.season;
                        const fileEp = file.ep || file.episode;
                        if (fileSe && Number(fileSe) !== season) continue;
                        if (fileEp && Number(fileEp) !== episode) continue;
                    }

                    const streamUrl = file.resourceLink || file.url || file.downloadUrl || file.download_url;
                    if (!streamUrl) continue;

                    const fileSize = file.size || file.fileSize || file.file_size || 0;
                    const fileResolution = file.resolution || file.quality || file.res || res;
                    const resStr = formatResolution(fileResolution);

                    const descParts = [];
                    if (resStr) descParts.push(`📺 ${resStr}`);
                    if (fileSize) {
                        const sizeGB = fileSize / (1024 ** 3);
                        if (sizeGB >= 1.0) {
                            descParts.push(`💾 ${sizeGB.toFixed(2)} GB`);
                        } else {
                            const sizeMB = fileSize / (1024 ** 2);
                            descParts.push(`💾 ${sizeMB.toFixed(0)} MB`);
                        }
                    }
                    if (audioLangs.length > 0) {
                        descParts.push(`🔊 ${audioLangs.join(", ")}`);
                    }

                    localStreams.push({
                        name: `MovieBox ${resStr || ""}`.trim(),
                        description: descParts.join(" | ") || "▶ تشغيل مباشر",
                        url: streamUrl,
                        language: audioLangs.join(", ").toLowerCase(),
                        resolutionVal: Number(fileResolution) || 0
                    });
                }
                return localStreams;
            } catch (err) {
                return [];
            }
        });

        const resResults = await Promise.all(resPromises);
        return resResults.flat();
    });

    const matchResults = await Promise.all(matchPromises);
    return matchResults.flat();
}

function formatResolution(resolution) {
    const r = Number(resolution);
    if (r >= 2160) return "4K";
    if (r >= 1080) return "1080p";
    if (r >= 720) return "720p";
    if (r >= 480) return "480p";
    if (r > 0) return `${r}p`;
    return "";
}

function getLanguageScore(langStr) {
    const lang = (langStr || "").toLowerCase();
    // Prioritize Arabic
    if (lang.includes("arabic") || lang.includes("ar")) {
        return 100;
    }
    // Prioritize English / Original
    return 80;
}

// ============================================
//  STREAM HANDLER
// ============================================
builder.defineStreamHandler(async (args) => {
    console.log(`\n---------------------------------`);
    console.log(`[Stream Request] Type: ${args.type} | ID: ${args.id}`);
    const [imdbId, season, episode] = args.id.split(":");

    try {
        const isMovie = args.type === "movie";
        const seasonNum = season ? parseInt(season) : 1;
        const episodeNum = episode ? parseInt(episode) : 1;

        // Fetch Cinemeta, Arabic name, and English name ALL IN PARALLEL!
        const [meta, arName, enName] = await Promise.all([
            getMetaData(args.type, imdbId),
            getArabicNameFromTMDB(imdbId, args.type),
            getEnglishNameFromTMDB(imdbId, args.type)
        ]);

        if (!meta) {
            console.log("[Error] Could not get metadata from Cinemeta");
            return { streams: [] };
        }

        let searchQuery = meta.name;
        const year = meta.year || (meta.releaseInfo ? meta.releaseInfo.split("-")[0] : "");

        console.log(`[Meta] Title: "${searchQuery}" | Year: ${year}`);

        const namesToTry = new Set();
        if (searchQuery) namesToTry.add(searchQuery);
        if (arName) namesToTry.add(arName);
        if (enName) namesToTry.add(enName);

        const uniqueNames = Array.from(namesToTry).filter(Boolean);
        console.log(`[MovieBox] Query variations to search:`, uniqueNames);

        // Search all variations in parallel
        const searchPromises = uniqueNames.map(async (name) => {
            let movieBoxQuery = name;
            if (!isMovie && seasonNum > 1) {
                movieBoxQuery = `${name} S${seasonNum}`;
            }

            let matches = await findMovieBoxMatches(movieBoxQuery, year, isMovie, seasonNum);

            // Fallback for series without season suffix
            if (matches.length === 0 && !isMovie && seasonNum > 1) {
                matches = await findMovieBoxMatches(name, year, isMovie, seasonNum);
            }
            return matches;
        });

        const resultsArray = await Promise.all(searchPromises);

        // Combine matches and deduplicate by subjectId
        const finalMatches = [];
        const seenSubjectIds = new Set();
        for (const matchResults of resultsArray) {
            for (const match of matchResults) {
                const subId = String(match.item.subjectId);
                if (!seenSubjectIds.has(subId)) {
                    seenSubjectIds.add(subId);
                    finalMatches.push(match);
                }
            }
        }

        // 3. Extract streams from MovieBox
        let allStreams = [];
        if (finalMatches.length > 0) {
            allStreams = await getMovieBoxStreams(finalMatches, isMovie, seasonNum, episodeNum);
        }

        // Sort streams by language score (descending), then resolution (descending)
        allStreams.sort((a, b) => {
            const scoreA = getLanguageScore(a.language);
            const scoreB = getLanguageScore(b.language);
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
            return b.resolutionVal - a.resolutionVal;
        });

        // 4. Deduplicate streams by URL pathname (ignoring signature tokens but keeping them in final URL)
        const seenPaths = new Set();
        const uniqueStreams = [];
        for (const stream of allStreams) {
            // Strict check: verify language once again to make absolutely sure no other language leaks
            if (!shouldKeepLanguage(stream.language)) {
                continue;
            }

            try {
                const parsedUrl = new URL(stream.url);
                const basePath = parsedUrl.origin + parsedUrl.pathname;
                if (!seenPaths.has(basePath)) {
                    seenPaths.add(basePath);
                    uniqueStreams.push({
                        name: stream.name,
                        description: stream.description,
                        url: stream.url
                    });
                }
            } catch {
                if (!seenPaths.has(stream.url)) {
                    seenPaths.add(stream.url);
                    uniqueStreams.push({
                        name: stream.name,
                        description: stream.description,
                        url: stream.url
                    });
                }
            }
        }

        console.log(`[Result] Sending ${uniqueStreams.length} streams to Stremio.`);
        return { streams: uniqueStreams };

    } catch (err) {
        console.error("[Stream Handler Error]", err.message);
        return { streams: [] };
    }
});

module.exports = builder.getInterface();