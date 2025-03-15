class OptimizedHttpClient {
    private inFlightRequests: Map<string, Promise<Response>> = new Map();
    private hostQueue: Map<string, Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; url: RequestInfo; options?: RequestInit }>> = new Map();
    private hostCounters: Map<string, number> = new Map();
    private MAX_CONCURRENT_REQUESTS = 3;

    private getHostKey(url: RequestInfo): string {
        try {
            const urlString = typeof url === "string" ? url : url.toString();
            const { host } = new URL(urlString);
            return host; // Unique host:port identifier
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }
    }

    async fetchWithOptimization(url: string, options: RequestInit = {}): Promise<Response> {
        const urlString = url; // Directly use url as a string

        if (this.inFlightRequests.has(urlString)) {
            console.log(`[DEBUG] Duplicate request detected, reusing in-flight request: ${urlString}`);
            return this.inFlightRequests.get(urlString)!;
        }

        const hostKey = this.getHostKey(urlString);

        return new Promise((resolve, reject) => {
            const executeRequest = async () => {
                const activeRequests = this.hostCounters.get(hostKey) || 0;

                if (activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
                    console.log(`[DEBUG] Too many active requests (${activeRequests}), queuing request: ${urlString}`);

                    if (!this.hostQueue.has(hostKey)) {
                        this.hostQueue.set(hostKey, []);
                    }

                    this.hostQueue.get(hostKey)!.push({ resolve, reject, url, options });
                    return;
                }

                this.hostCounters.set(hostKey, activeRequests + 1);

                try {
                    const requestPromise = fetch(url, options).then(async (response) => {
                        if (!response.ok) {
                            throw new Error(`HTTP Error: ${response.status}`);
                        }
                        return response;
                    });

                    this.inFlightRequests.set(urlString, requestPromise);

                    const response = await requestPromise;
                    resolve(response);
                } catch (error) {
                    reject(error);
                } finally {
                    this.inFlightRequests.delete(urlString);
                    this.hostCounters.set(hostKey, (this.hostCounters.get(hostKey) || 1) - 1);

                    console.log(`[DEBUG] Request completed: ${urlString}`);

                    const queue = this.hostQueue.get(hostKey);
                    if (queue && queue.length > 0) {
                        console.log(`[DEBUG] Processing queue for ${hostKey}. Queue size: ${queue.length}`);

                        // Dequeue exactly one request at a time in FIFO order
                        const nextRequest = queue.shift();
                        if (nextRequest) {
                            console.log(`[DEBUG] Executing next queued request (FIFO): ${nextRequest.url}`);

                            // Wait for this request to complete before proceeding to the next one
                            (async () => {
                                try {
                                    const response = await this.fetchWithOptimization(nextRequest.url.toString(), nextRequest.options);
                                    nextRequest.resolve(response);
                                } catch (error) {
                                    nextRequest.reject(error);
                                }
                            })();
                        }
                    }
                }
            };

            executeRequest();
        });
    }
}

export const httpClient = new OptimizedHttpClient();