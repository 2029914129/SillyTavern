import process from 'node:process';
import { performance } from 'node:perf_hooks';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:18124';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20_000);
const startedAt = performance.now();

async function waitForHealth() {
    let lastError;

    while (performance.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
            if (response.ok) {
                return {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    body: await response.json(),
                };
            }
            lastError = new Error(`Health check returned ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Health check timed out: ${lastError?.message || 'unknown error'}`);
}

async function testStream() {
    const response = await fetch(`${baseUrl}/stream`, { cache: 'no-store' });
    if (!response.ok || !response.body) {
        throw new Error(`Stream request failed with ${response.status}`);
    }

    const decoder = new TextDecoder();
    const chunks = [];
    const streamStartedAt = performance.now();

    for await (const chunk of response.body) {
        chunks.push({
            elapsedMs: Math.round(performance.now() - streamStartedAt),
            text: decoder.decode(chunk, { stream: true }),
        });
    }

    const text = chunks.map(chunk => chunk.text).join('');
    if (text !== 'chunk-1\nchunk-2\nchunk-3\n' || chunks.length < 2) {
        throw new Error(`Unexpected stream result: ${JSON.stringify(chunks)}`);
    }

    return chunks;
}

async function testWebSocket() {
    const socketUrl = baseUrl.replace(/^http/, 'ws') + '/ws';

    return await new Promise((resolve, reject) => {
        const socket = new WebSocket(socketUrl);
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('WebSocket test timed out'));
        }, timeoutMs);

        socket.addEventListener('open', () => socket.send('milestone-a'));
        socket.addEventListener('message', event => {
            clearTimeout(timer);
            const message = String(event.data);
            socket.close();
            if (message !== 'echo:milestone-a') {
                reject(new Error(`Unexpected WebSocket message: ${message}`));
                return;
            }
            resolve(message);
        });
        socket.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error('WebSocket connection failed'));
        });
    });
}

const health = await waitForHealth();
const stream = await testStream();
const webSocket = await testWebSocket();

console.log(JSON.stringify({ health, stream, webSocket }, null, 2));
