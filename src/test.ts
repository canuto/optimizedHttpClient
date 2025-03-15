import { httpClient } from "./httpClient";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.BASE_URL || "https://httpbin.org/anything"; // Default to httpbin if not set
const API_KEY = process.env.API_KEY; // Optional for use with Codehooks.io

const getRequestOptions = (): RequestInit => {
    return API_KEY
        ? { headers: { "x-apikey": API_KEY } }
        : {}; // No headers needed for httpbin
};

async function testConcurrentRequests() {
    console.log("\n[TEST] Sending 5 concurrent requests...");

    const urls = [
        `${BASE_URL}?test=1`,
        `${BASE_URL}?test=2`,
        `${BASE_URL}?test=3`,
        `${BASE_URL}?test=4`,
        `${BASE_URL}?test=5`
    ];

    const promises = urls.map(url => httpClient.fetchWithOptimization(url, getRequestOptions()));
    const results = await Promise.all(promises);
    console.log("[RESULT] Concurrent requests completed");
}

async function testDeduplication() {
    console.log("\n[TEST] Checking request deduplication...");

    const url = `${BASE_URL}?deduplication-test=1`;

    const promises = [
        httpClient.fetchWithOptimization(url, getRequestOptions()),
        httpClient.fetchWithOptimization(url, getRequestOptions()),
        httpClient.fetchWithOptimization(url, getRequestOptions())
    ];

    const results = await Promise.all(promises);
    console.log("[RESULT] Deduplication test completed:");
}

async function testRateLimiting() {
    console.log("\n[TEST] Checking per-host request limit (3 max at a time)...");

    const urls = [
        `${BASE_URL}?limit-test=1`,
        `${BASE_URL}?limit-test=2`,
        `${BASE_URL}?limit-test=3`,
        `${BASE_URL}?limit-test=4`,
        `${BASE_URL}?limit-test=5`
    ];

    const promises = urls.map(url => httpClient.fetchWithOptimization(url, getRequestOptions()));
    const results = await Promise.all(promises);
    console.log("[RESULT] Rate limiting test completed");
}

async function testQueueing() {
    console.log("\n[TEST] Checking if requests beyond limit are queued...");

    const urls = [
        `${BASE_URL}?queue-test=1`,
        `${BASE_URL}?queue-test=2`,
        `${BASE_URL}?queue-test=3`,
        `${BASE_URL}?queue-test=4`,
        `${BASE_URL}?queue-test=5`,
        `${BASE_URL}?queue-test=6`
    ];

    console.log("[INFO] Sending 6 requests; only 3 should be in-flight at once.");

    const promises = urls.map(url => httpClient.fetchWithOptimization(url, getRequestOptions()));
    const results = await Promise.all(promises);
    console.log("[RESULT] Queueing test completed");
}

async function runTests() {
    console.log(`\n[INFO] Running tests against: ${BASE_URL}`);
    if (API_KEY) {
        console.log("[INFO] Using API key authentication.");
    } else {
        console.log("[INFO] No API key provided, using httpbin.org.");
    }

    try {
        await testConcurrentRequests();
        await testDeduplication();
        await testRateLimiting();
        await testQueueing();
    } catch (error) {
        console.error("[ERROR] Test failed:", error);
    }
}

// Run all tests
runTests();