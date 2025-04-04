import async from "async";
import fetch, { RequestInit as NodeFetchRequestInit } from "node-fetch";
import log from 'loglevel';
import { LogLevelDesc } from 'loglevel';

// Set the default log level
const validLogLevels: LogLevelDesc[] = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
const logLevel = process.env.LOG_LEVEL as LogLevelDesc;

if (validLogLevels.includes(logLevel)) {
    log.setLevel(logLevel);
} else {
    log.setLevel('debug');
}

type QueueTask = {
    url: string;
    options: NodeFetchRequestInit;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
};

/**
 * OptimizedHttpClient is a class that manages HTTP requests with optimizations
 * such as deduplication of identical requests and limiting the number of concurrent
 * requests to a specific host.
 */
class OptimizedHttpClient {
    private static instance: OptimizedHttpClient;
    private inFlightRequests: Map<string, Promise<any>> = new Map();
    private requestQueue: Map<string, async.QueueObject<QueueTask>> = new Map();
    private MAX_CONCURRENT_REQUESTS = 3;

    private constructor() {
        log.info("[INFO] HTTP Client Initialized with async.queue");
    }

    public static getInstance(): OptimizedHttpClient {
        if (!OptimizedHttpClient.instance) {
            OptimizedHttpClient.instance = new OptimizedHttpClient();
        }
        return OptimizedHttpClient.instance;
    }

    /**
     * Extracts the host key from a given URL.
     * @param url - The URL from which to extract the host.
     * @returns The host part of the URL.
     */
    private getHostKey(url: string): string {
        const { host } = new URL(url);  // If invalid, URL() will throw 
        return host;
    }

    /**
     * Fetches data from a given URL with optimizations such as deduplication
     * and rate limiting.
     * @param url - The URL to fetch data from.
     * @param options - Optional request options.
     * @returns A promise that resolves with the parsed data.
     */
    async fetchWithOptimization(url: string, options: RequestInit = {}): Promise<any> {
        const urlString = url;

        // Ensure the body is undefined if it's null
        if (options.body === null) {
            options.body = undefined;
        }

        // Check if an identical call is already ongoing
        if (this.inFlightRequests.has(urlString)) {
            log.debug(`[DEBUG] Reusing existing call: ${urlString}`);
            // Return the *same* promise containing parsed data
            return this.inFlightRequests.get(urlString)!;
        }

        const hostKey = this.getHostKey(urlString);

        // Ensure that there is a queue for this hostKey
        if (!this.requestQueue.has(hostKey)) {
            const queue = async.queue(async (task: QueueTask, callback) => {
                try {
                    log.debug(`[DEBUG] Starting request: ${task.url}`);

                    // Set the timestamp when the request actually starts processing
                    const headers = { ...task.options.headers };
                    task.options.headers = {
                        ...headers,
                        'x-callstart': new Date().toISOString()
                    };

                    const response = await fetch(task.url, task.options);

                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }

                    // Parse the response body here
                    const data = await response.json();

                    log.debug(`[DEBUG] Request successful: ${task.url}`);
                    // Resolve each Task with the parsed JSON
                    task.resolve(data);
                } catch (error) {
                    log.error(`[ERROR] Request failed: ${task.url}`, error);
                    task.reject(error);
                } finally {
                    // Clean up
                    this.inFlightRequests.delete(task.url);
                    callback();
                    log.debug(`[DEBUG] Task completed: ${task.url}`);
                }
            }, this.MAX_CONCURRENT_REQUESTS);

            // Drain event
            queue.drain(() => {
                log.info(`[INFO] All tasks have been processed for host: ${hostKey}`);
            });

            this.requestQueue.set(hostKey, queue);
        }

        // Return a promise that gets resolved when the task is executed
        // but store the "in flight" promise for reuse
        return new Promise<any>((outerResolve, outerReject) => {
            // Create the inner promise that goes onto the queue
            const queuePromise = new Promise<any>((innerResolve, innerReject) => {
                this.requestQueue.get(hostKey)!.push({
                    url: urlString,
                    options: options as NodeFetchRequestInit,
                    resolve: innerResolve,
                    reject: innerReject,
                });
            });

            // Store that inner promise in the map
            this.inFlightRequests.set(urlString, queuePromise);

            // When the inner promise finishes, settle the outer promise
            queuePromise
                .then((parsedData) => outerResolve(parsedData))
                .catch((error) => outerReject(error));
        });
    }
}

// Export the singleton instance
export const httpClient = OptimizedHttpClient.getInstance();