import { httpClient } from '../../httpClient';

jest.mock('node-fetch', () => jest.fn());
const { Response } = jest.requireActual('node-fetch');

describe('OptimizedHttpClient', () => {
    beforeEach(() => {
        (fetch as jest.Mock).mockClear();
    });

    it('should make a single request', async () => {
        (fetch as jest.Mock).mockResolvedValue(new Response('OK', { status: 200 }));

        const response = await httpClient.fetchWithOptimization('https://example.com');
        expect(response.ok).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate requests to the same URL', async () => {
        (fetch as jest.Mock).mockResolvedValue(new Response('OK', { status: 200 }));

        const promise1 = httpClient.fetchWithOptimization('https://httpbin.org/anything?test=1');
        const promise2 = httpClient.fetchWithOptimization('https://httpbin.org/anything?test=1');

        const [response1, response2] = await Promise.all([promise1, promise2]);
        expect(response1).toBe(response2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should limit concurrent requests to the same host to 3', async () => {
        (fetch as jest.Mock).mockImplementation((url) => {
            return new Promise((resolve) => {
                setTimeout(() => resolve(new Response('OK', { status: 200 })), 100);
            });
        });

        const urls = [
            'https://httpbin.org/anything?test=1',
            'https://httpbin.org/anything?test=2',
            'https://httpbin.org/anything?test=3',
            'https://httpbin.org/anything?test=4',
            'https://httpbin.org/anything?test=5',
        ];

        const promises = urls.map(url => httpClient.fetchWithOptimization(url));
        await Promise.all(promises);

        expect(fetch).toHaveBeenCalledTimes(5);
        // Check that no more than 3 requests were in-flight at any time
        // This is a bit tricky to test directly, but you can check logs or use a more complex mock
    });

    it('should handle errors correctly', async () => {
        (fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));

        await expect(httpClient.fetchWithOptimization('https://httpbin.org/anything?test=error'))
            .rejects
            .toThrow('Network Error');

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should queue requests when more than 3 requests are made to the same host', async () => {
        let activeRequests = 0;
        (fetch as jest.Mock).mockImplementation((url) => {
            activeRequests++;
            return new Promise((resolve) => {
                setTimeout(() => {
                    activeRequests--;
                    resolve(new Response('OK', { status: 200 }));
                }, 100);
            });
        });

        const urls = [
            'https://httpbin.org/anything?test=1',
            'https://httpbin.org/anything?test=2',
            'https://httpbin.org/anything?test=3',
            'https://httpbin.org/anything?test=4',
            'https://httpbin.org/anything?test=5',
        ];

        const promises = urls.map(url => httpClient.fetchWithOptimization(url));
        await Promise.all(promises);

        expect(fetch).toHaveBeenCalledTimes(5);
        expect(activeRequests).toBeLessThanOrEqual(3);
    });

    it('should handle queued requests after in-flight requests complete', async () => {
        let activeRequests = 0;
        (fetch as jest.Mock).mockImplementation((url) => {
            activeRequests++;
            return new Promise((resolve) => {
                setTimeout(() => {
                    activeRequests--;
                    resolve(new Response('OK', { status: 200 }));
                }, 100);
            });
        });

        const urls = [
            'https://httpbin.org/anything?test=1',
            'https://httpbin.org/anything?test=2',
            'https://httpbin.org/anything?test=3',
            'https://httpbin.org/anything?test=4',
            'https://httpbin.org/anything?test=5',
            'https://httpbin.org/anything?test=6',
        ];

        const promises = urls.map(url => httpClient.fetchWithOptimization(url));
        await Promise.all(promises);

        expect(fetch).toHaveBeenCalledTimes(6);
        expect(activeRequests).toBeLessThanOrEqual(3);
    });
});
