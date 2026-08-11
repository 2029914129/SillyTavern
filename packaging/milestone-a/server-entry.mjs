import process from 'node:process';
import { serverEvents, EVENT_NAMES } from './src/server-events.js';

serverEvents.once(EVENT_NAMES.SERVER_STARTED, ({ url }) => {
    const payload = {
        url: String(url),
        pid: process.pid,
        node: process.version,
        arch: process.arch,
        platform: process.platform,
    };
    console.log('NEWSILLY_SERVER_STARTED ' + JSON.stringify(payload));
});

await import('./server.js');
