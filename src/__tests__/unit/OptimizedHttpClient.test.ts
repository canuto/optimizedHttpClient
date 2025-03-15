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
        expect(fetch).toHaveBeenCalledWith(url, {
            headers: expect.objectContaining({
                'x-callstart': expect.any(String)
            })
        });
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

    test("queues requests beyond the concurrency limit", async () => {
        const mockData = { success: true };

        // Ensure a new Response object is returned for each call
        (fetch as unknown as jest.Mock).mockImplementation(() =>
            Promise.resolve(
                new Response(JSON.stringify(mockData), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            )
        );

        const urls = [
            "https://example.com/test1",
            "https://example.com/test2",
            "https://example.com/test3",
            "https://example.com/test4",
        ];

        const results = await Promise.all(urls.map(url => httpClient.fetchWithOptimization(url)));

        expect(fetch).toHaveBeenCalledTimes(4);
        results.forEach(result => expect(result).toEqual(mockData));
    });

    test("handles non-JSON responses gracefully", async () => {
        (fetch as unknown as jest.Mock).mockResolvedValue(
            new Response("Not JSON", {
                status: 200,
                headers: { "Content-Type": "text/plain" },
            })
        );

        const url = "https://example.com/non-json";
        await expect(httpClient.fetchWithOptimization(url)).rejects.toThrow(
            /Unexpected token/
        );

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("handles network errors gracefully", async () => {
        (fetch as unknown as jest.Mock).mockRejectedValue(new Error("Network Error"));

        const url = "https://example.com/network-error";
        await expect(httpClient.fetchWithOptimization(url)).rejects.toThrow(
            /Network Error/
        );

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("passes custom headers correctly", async () => {
        const mockData = { success: true };
        (fetch as unknown as jest.Mock).mockResolvedValue(
            new Response(JSON.stringify(mockData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const url = "https://example.com/custom-headers";
        const options = {
            headers: {
                "X-Custom-Header": "CustomValue"
            }
        };

        const result = await httpClient.fetchWithOptimization(url, options);

        expect(fetch).toHaveBeenCalledWith(url, options);
        expect(result).toEqual(mockData);
    });
});