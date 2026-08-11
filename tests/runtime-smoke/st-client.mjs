import process from 'node:process';
import { performance } from 'node:perf_hooks';

const baseUrl = process.env.ST_BASE_URL || 'http://127.0.0.1:18125';
const timeoutMs = Number(process.env.ST_TIMEOUT_MS || 120_000);
const startedAt = performance.now();

function getResponseCookies(response) {
    return response.headers.getSetCookie()
        .map(value => value.split(';', 1)[0])
        .join('; ');
}

async function waitForHealth() {
    let lastError;

    while (performance.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/login`, {
                cache: 'no-store',
                redirect: 'manual',
            });
            if (response.status >= 200 && response.status < 400) {
                return {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    status: response.status,
                    cookie: getResponseCookies(response),
                };
            }
            lastError = new Error(`Health endpoint returned ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`SillyTavern health check timed out: ${lastError?.message || 'unknown error'}`);
}

async function getText(pathname, cookie) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        cache: 'no-store',
        headers: cookie ? { cookie } : undefined,
    });
    if (!response.ok) {
        throw new Error(`${pathname} returned ${response.status}`);
    }
    return await response.text();
}

async function testAuthenticatedPing(sessionCookie) {
    const csrfResponse = await fetch(`${baseUrl}/csrf-token`, {
        cache: 'no-store',
        headers: sessionCookie ? { cookie: sessionCookie } : undefined,
    });
    if (!csrfResponse.ok) {
        throw new Error(`CSRF endpoint returned ${csrfResponse.status}`);
    }

    const { token } = await csrfResponse.json();
    const responseCookie = getResponseCookies(csrfResponse);
    const cookie = responseCookie || sessionCookie;
    const response = await fetch(`${baseUrl}/api/ping`, {
        method: 'POST',
        headers: {
            'cookie': cookie,
            'x-csrf-token': token,
        },
    });

    if (response.status !== 204) {
        throw new Error(`/api/ping returned ${response.status}: ${await response.text()}`);
    }

    return response.status;
}

const health = await waitForHealth();
const sessionCookie = health.cookie;
const versionResponse = await fetch(`${baseUrl}/version`, {
    cache: 'no-store',
    headers: sessionCookie ? { cookie: sessionCookie } : undefined,
});
if (!versionResponse.ok) {
    throw new Error(`Authenticated version endpoint returned ${versionResponse.status}`);
}
const version = await versionResponse.json();
const indexHtml = await getText('/', sessionCookie);
const mobileCss = await getText('/css/mobile-styles.css', sessionCookie);
const horaeCss = await getText('/css/furry-horae.css', sessionCookie);
const horaeManifestText = await getText('/scripts/extensions/third-party/SillyTavern-Horae/manifest.json', sessionCookie);
const horaeScript = await getText('/scripts/extensions/third-party/SillyTavern-Horae/index.js', sessionCookie);
const horaeManifest = JSON.parse(horaeManifestText);
const pingStatus = await testAuthenticatedPing(sessionCookie);

if (!indexHtml.includes('SillyTavern')) {
    throw new Error('Main HTML did not contain the SillyTavern marker');
}
if (!mobileCss.includes('@media')) {
    throw new Error('Mobile CSS did not contain responsive rules');
}
if (!horaeCss.includes('furry-horae')) {
    throw new Error('Custom Horae CSS marker was not found');
}
if (horaeManifest.version !== '1.15.1' || horaeScript.length < 10_000) {
    throw new Error('Horae 1.15.1 assets were incomplete');
}

console.log(JSON.stringify({
    health,
    version,
    pingStatus,
    assets: {
        indexBytes: Buffer.byteLength(indexHtml),
        mobileCssBytes: Buffer.byteLength(mobileCss),
        horaeCssBytes: Buffer.byteLength(horaeCss),
        horaeVersion: horaeManifest.version,
        horaeScriptBytes: Buffer.byteLength(horaeScript),
    },
}, null, 2));
