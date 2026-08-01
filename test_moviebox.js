// Test script for MovieBox API integration
const addon = require("./addon");

async function runTest() {
    console.log("=== MovieBox Addon Test ===\n");

    // Test 1: Movie search (Batman Begins)
    console.log("--- Test 1: Movie Stream (Batman Begins - tt0372784) ---");
    try {
        const result1 = await addon.get("stream", "movie", "tt0372784");
        console.log(`Streams found: ${result1.streams.length}`);
        if (result1.streams.length > 0) {
            result1.streams.forEach((s, i) => {
                console.log(`  [${i + 1}] ${s.name} — ${s.description}`);
                console.log(`      URL: ${(s.url || "").substring(0, 100)}...`);
            });
        } else {
            console.log("  No streams found.");
        }
    } catch (err) {
        console.error("Test 1 failed:", err.message);
    }

    console.log("\n");

    // Test 2: Series search (Breaking Bad S1E1)
    console.log("--- Test 2: Series Stream (Breaking Bad S1E1 - tt0903747:1:1) ---");
    try {
        const result2 = await addon.get("stream", "series", "tt0903747:1:1");
        console.log(`Streams found: ${result2.streams.length}`);
        if (result2.streams.length > 0) {
            result2.streams.forEach((s, i) => {
                console.log(`  [${i + 1}] ${s.name} — ${s.description}`);
                console.log(`      URL: ${(s.url || "").substring(0, 100)}...`);
            });
        } else {
            console.log("  No streams found.");
        }
    } catch (err) {
        console.error("Test 2 failed:", err.message);
    }

    console.log("\n=== Tests Complete ===");
}

runTest();
