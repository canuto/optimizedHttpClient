import { httpClient } from "../../httpClient";
import fetch from "node-fetch";

jest.mock("node-fetch");
const { Response } = jest.requireActual("node-fetch");

describe("OptimizedHttpClient Unit Tests", () => {
    beforeEach(() => {
        // Clear any existing mock calls and implementations before each test
        (fetch as unknown as jest.Mock).mockClear();
    });

    test("returns parsed JSON data from mocked fetch", async () => {
        // Setup: mock fetch to return a certain response
        const mockData = { foo: "bar" };
        (fetch as unknown as jest.Mock).mockResolvedValue(
            new Response(JSON.stringify(mockData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const url = "https://example.com/test";
        const result = await httpClient.fetchWithOptimization(url);

        // Assertions
        expect(fetch).toHaveBeenCalledTimes(1); // only 1 fetch call
        expect(fetch).toHaveBeenCalledWith(url, {});
        expect(result).toEqual(mockData); // the JSON data you returned
    });

    test("deduplicates simultaneous requests for the same URL", async () => {
        // We'll track how many times fetch is called
        const mockData = { deduped: true };
        (fetch as unknown as jest.Mock).mockResolvedValue(
            new Response(JSON.stringify(mockData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const url = "https://example.com/deduped";
        // Kick off multiple calls simultaneously
        const [r1, r2, r3] = await Promise.all([
            httpClient.fetchWithOptimization(url),
            httpClient.fetchWithOptimization(url),
            httpClient.fetchWithOptimization(url),
        ]);

        // Because all are the same URL, we expect the fetch logic to run only once
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(r1).toEqual(mockData);
        expect(r2).toEqual(mockData);
        expect(r3).toEqual(mockData);
    });

    test("handles HTTP error status codes correctly", async () => {
        // Suppose the server returns 500 
        (fetch as unknown as jest.Mock).mockResolvedValue(
            new Response("", { status: 500 })
        );

        const url = "https://example.com/error";
        await expect(httpClient.fetchWithOptimization(url)).rejects.toThrow(
            /HTTP Error: 500/ // or whatever error message you throw
        );

        // Also verify fetch was called
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});