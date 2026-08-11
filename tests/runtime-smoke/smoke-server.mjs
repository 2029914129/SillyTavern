import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { WebSocketServer } from 'ws';

const host = '127.0.0.1';
const port = Number(process.env.SMOKE_PORT || 8124);
const dataRoot = process.env.SMOKE_DATA_ROOT;

if (!dataRoot) {
    throw new Error('SMOKE_DATA_ROOT is required');
}

const samples = {
    characters: { name: 'Android Gate Character', version: 1 },
    chats: { chat: ['hello', 'world'], version: 1 },
    presets: { temperature: 0.7, version: 1 },
    worlds: { entries: [{ key: 'gate', value: 'passed' }], version: 1 },
};

for (const [directory, value] of Object.entries(samples)) {
    const targetDir = path.join(dataRoot, directory);
    const targetFile = path.join(targetDir, 'milestone-a.json');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, JSON.stringify(value), 'utf8');
    const roundTrip = JSON.parse(await fs.readFile(targetFile, 'utf8'));
    if (JSON.stringify(roundTrip) !== JSON.stringify(value)) {
        throw new Error('Data round-trip mismatch for ' + directory);
    }
}

const server = http.createServer((request, response) => {
    if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            ok: true,
            node: process.version,
            arch: process.arch,
            platform: process.platform,
        }));
        return;
    }

    if (request.url === '/stream') {
        response.writeHead(200, {
            'content-type': 'text/plain; charset=utf-8',
            'transfer-encoding': 'chunked',
            'cache-control': 'no-store',
        });
        response.flushHeaders();
        response.write('chunk-1\n');
        setTimeout(() => {
            response.write('chunk-2\n');
            setTimeout(() => response.end('chunk-3\n'), 50);
        }, 50);
        return;
    }

    response.writeHead(404);
    response.end('not found');
});

const webSocketServer = new WebSocketServer({ server, path: '/ws' });
webSocketServer.on('connection', socket => {
    socket.on('message', data => socket.send('echo:' + data.toString()));
});

server.listen(port, host, () => {
    console.log('NEWSILLY_SMOKE_READY ' + JSON.stringify({
        host,
        port,
        pid: process.pid,
        node: process.version,
        arch: process.arch,
        dataRoot,
    }));
});

const stop = () => {
    webSocketServer.close();
    server.close(() => process.exit(0));
};

process.once('SIGTERM', stop);
process.once('SIGINT', stop);
