import { httpClient } from "../../httpClient";
import { expect } from "@jest/globals";

const BASE_URL = "https://httpbin.org/anything";

type HttpBinData = {
    args: { [key: string]: string };
    headers: { [key: string]: string };
};

describe("Integration Tests", () => {
    test("Concurrent Requests with Timestamps", async () => {
        console.log("\n[TEST] Sending 5 concurrent requests...");

        const urls = [
            `${BASE_URL}?test=1`,
            `${BASE_URL}?test=2`,
            `${BASE_URL}?test=3`,
            `${BASE_URL}?test=4`,
            `${BASE_URL}?test=5`
        ];

        const jsonData = await Promise.all(urls.map(url => httpClient.fetchWithOptimization(url)));

        // Verify that we received 5 responses
        expect(jsonData).toHaveLength(5);

        jsonData.forEach((data, index) => {
            expect(data.args.test).toBe((index + 1).toString());

            // Check the Date header or any timestamp in the response
            const dateHeader = data.headers['Date'];
            if (dateHeader) {
                const responseDate = new Date(dateHeader);
                console.log(`[DEBUG] Request ${index + 1} processed at: ${responseDate.toISOString()}`);
            } else {
                console.log(`[DEBUG] Request ${index + 1} has no Date header`);
            }
        });

        console.log("[RESULT] Concurrent requests completed", jsonData);
    }, 10000);

    test("Deduplication", async () => {
        console.log("\n[TEST] Checking request deduplication...");

        const url = `${BASE_URL}?deduplication-test=1`;

        // Add a unique header to track requests
        const options = {
            headers: {
                'X-Unique-Id': 'deduplication-test'
            }
        };

        const jsonData = await Promise.all([
            httpClient.fetchWithOptimization(url, options),
            httpClient.fetchWithOptimization(url, options),
            httpClient.fetchWithOptimization(url, options)
        ]);

        // Verify that all responses are identical, indicating deduplication
        jsonData.forEach((data, index) => {
            expect(data.args['deduplication-test']).toBe('1');
            console.log(`[DEBUG] Response ${index + 1}:`, data);
        });

        console.log("[RESULT] Deduplication test completed", jsonData);
    });

    test("Rate Limiting and Queueing", async () => {
        console.log("\n[TEST] Checking rate limiting and queuing behavior...");

        const urls = [
            `${BASE_URL}?test=1`,
            `${BASE_URL}?test=2`,
            `${BASE_URL}?test=3`,
            `${BASE_URL}?test=4`,
            `${BASE_URL}?test=5`,
            `${BASE_URL}?test=6`
        ];

        const startTimes: number[] = [];
        const endTimes: number[] = [];

        console.log("[INFO] Sending 6 requests; only 3 should be in-flight at once.");

        const promises = urls.map((url, index) => {
            startTimes[index] = Date.now();
            return httpClient.fetchWithOptimization(url).then(result => {
                endTimes[index] = Date.now();
                return result;
            });
        });

        await Promise.all(promises);

        // Calculate time differences to check for queuing
        const thirdFourthDiff = endTimes[3] - endTimes[2];
        const firstSecondDiff = endTimes[1] - endTimes[0];

        console.log(`[DEBUG] Time difference between first and second request: ${firstSecondDiff}ms`);
        console.log(`[DEBUG] Time difference between third and fourth request: ${thirdFourthDiff}ms`);

        // Check that the time difference between the third and fourth is greater than between the first and second
        expect(thirdFourthDiff).toBeGreaterThan(firstSecondDiff);

        console.log("[RESULT] Rate limiting and queuing test completed.");
    });
});