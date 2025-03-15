import async from "async";
import fetch, { RequestInit as NodeFetchRequestInit } from "node-fetch";

type QueueTask = {
    url: string;
    options: NodeFetchRequestInit;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
};

class OptimizedHttpClient {
    // Now we store promise of parsed data (e.g. JSON) instead of a Response
    private inFlightRequests: Map<string, Promise<any>> = new Map();
    private requestQueue: Map<string, async.QueueObject<QueueTask>> = new Map();
    private MAX_CONCURRENT_REQUESTS = 3;

    private getHostKey(url: string): string {
        const { host } = new URL(url);  // If invalid, URL() will throw 
        return host;
    }

    constructor() {
        console.log("[INFO] HTTP Client Initialized with async.queue");
    }

    async fetchWithOptimization(url: string, options: RequestInit = {}): Promise<any> {
        const urlString = url;

        // Ensure the body is undefined if it's null
        if (options.body === null) {
            options.body = undefined;
        }

        // Check if an identical call is already ongoing
        if (this.inFlightRequests.has(urlString)) {
            console.log(`[DEBUG] Reusing existing call: ${urlString}`);
            // Return the *same* promise containing parsed data
            return this.inFlightRequests.get(urlString)!;
        }

        const hostKey = this.getHostKey(urlString);

        // Ensure that there is a queue for this hostKey
        if (!this.requestQueue.has(hostKey)) {
            const queue = async.queue(async (task: QueueTask, callback) => {
                try {
                    console.log(`[DEBUG] Starting request: ${task.url}`);
                    const response = await fetch(task.url, task.options);

                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }

                    // *** Parse the response body here
                    const data = await response.json();

                    console.log(`[DEBUG] Request successful: ${task.url}`);
                    // *** Resolve each Task with the parsed JSON
                    task.resolve(data);
                } catch (error) {
                    console.error(`[ERROR] Request failed: ${task.url}`, error);
                    task.reject(error);
                } finally {
                    // Clean up
                    this.inFlightRequests.delete(task.url);
                    callback();
                    console.log(`[DEBUG] Task completed: ${task.url}`);
                }
            }, this.MAX_CONCURRENT_REQUESTS);

            // Drain event
            queue.drain(() => {
                console.log(`[INFO] All tasks have been processed for host: ${hostKey}`);
            });

            this.requestQueue.set(hostKey, queue);
        }

        // Return a promise that gets resolved when the task is executed
        // but store the "in flight" promise for reuse
        return new Promise<any>((outerResolve, outerReject) => {
            // 1) Create the inner promise that goes onto the queue
            const queuePromise = new Promise<any>((innerResolve, innerReject) => {
                this.requestQueue.get(hostKey)!.push({
                    url: urlString,
                    options: options as NodeFetchRequestInit,
                    resolve: innerResolve,
                    reject: innerReject,
                });
            });

            // 2) Store that inner promise in the map
            this.inFlightRequests.set(urlString, queuePromise);

            // 3) When the inner promise finishes, settle the outer promise
            queuePromise
                .then((parsedData) => outerResolve(parsedData))
                .catch((error) => outerReject(error));
        });
    }
}

export const httpClient = new OptimizedHttpClient();