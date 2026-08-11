import crypto from 'node:crypto';

import storage from 'node-persist';
import express from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getIpAddress, retryAfter } from '../express-common.js';
import { color, Cache, getConfigValue } from '../util.js';
import { DEFAULT_USER } from '../constants.js';
import {
    KEY_PREFIX,
    UserAccountError,
    getAccountVersion,
    getPasswordHash,
    getPasswordSalt,
    getUserAvatar,
    normalizeUserHandle,
    registerUserAccount,
    toKey,
} from '../users.js';

const DISCREET_LOGIN = getConfigValue('enableDiscreetLogin', false, 'boolean');
const ENABLE_REGISTRATION = getConfigValue('enableUserRegistration', false, 'boolean');
const PREFER_REAL_IP_HEADER = getConfigValue('rateLimiting.preferRealIpHeader', false, 'boolean');
const LOGIN_POINTS = getConfigValue('rateLimiting.accountsLoginMaxAttempts', 5, 'number');
const RECOVER_POINTS = getConfigValue('rateLimiting.accountsRecoverMaxAttempts', 5, 'number');
const REGISTER_POINTS = getConfigValue('rateLimiting.accountsRegistrationMaxAttempts', 5, 'number');
const MFA_CACHE = new Cache(5 * 60 * 1000);

const generateRecoveryCode = () => Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join('');

export const router = express.Router();
const loginLimiter = new RateLimiterMemory({
    points: LOGIN_POINTS > 0 ? LOGIN_POINTS : Number.MAX_SAFE_INTEGER,
    duration: 60,
});
const recoverLimiter = new RateLimiterMemory({
    points: RECOVER_POINTS > 0 ? RECOVER_POINTS : Number.MAX_SAFE_INTEGER,
    duration: 300,
});
const registerLimiter = new RateLimiterMemory({
    points: REGISTER_POINTS > 0 ? REGISTER_POINTS : Number.MAX_SAFE_INTEGER,
    duration: 3600,
});

router.post('/list', async (_request, response) => {
    try {
        if (DISCREET_LOGIN) {
            return response.sendStatus(204);
        }

        /** @type {import('../users.js').User[]} */
        const users = await storage.values(x => x.key.startsWith(KEY_PREFIX));

        /** @type {Promise<import('../users.js').UserViewModel>[]} */
        const viewModelPromises = users
            .filter(x => x.enabled)
            .map(user => new Promise(async (resolve) => {
                getUserAvatar(user.handle).then(avatar =>
                    resolve({
                        handle: user.handle,
                        name: user.name,
                        created: user.created,
                        avatar: avatar,
                        password: !!user.password,
                    }),
                );
            }));

        const viewModels = await Promise.all(viewModelPromises);
        viewModels.sort((x, y) => (x.created ?? 0) - (y.created ?? 0));
        return response.json(viewModels);
    } catch (error) {
        console.error('User list failed:', error);
        return response.sendStatus(500);
    }
});

router.get('/registration-status', (_request, response) => {
    return response.json({ enabled: ENABLE_REGISTRATION });
});

router.post('/register', async (request, response) => {
    if (!ENABLE_REGISTRATION) {
        return response.status(403).json({ error: '当前服务器未开放注册。', code: 'registration_disabled' });
    }

    if (!request.session) {
        console.error('Registration failed: Session not available');
        return response.sendStatus(500);
    }

    const ip = getIpAddress(request, PREFER_REAL_IP_HEADER);

    try {
        await registerLimiter.consume(ip);

        const username = String(request.body?.username ?? request.body?.handle ?? '');
        const password = String(request.body?.password ?? '');
        const { user, bootstrapped } = await registerUserAccount({ username, password });

        request.session.handle = user.handle;
        request.session.version = getAccountVersion(user);
        console.info('Registration successful:', user.handle, 'from', ip, 'at', new Date().toLocaleString());

        return response.status(201).json({
            handle: user.handle,
            name: user.name,
            admin: user.admin,
            bootstrapped,
        });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.warn('Registration failed: Rate limited from', ip);
            return retryAfter(response, error).status(429).json({
                error: '注册次数过多，请稍后再试。',
                code: 'registration_rate_limited',
            });
        }

        if (error instanceof UserAccountError) {
            return response.status(error.status).json({ error: error.message, code: error.code });
        }

        console.error('Registration failed:', error);
        return response.status(500).json({ error: '注册失败，请稍后重试。', code: 'registration_failed' });
    }
});

router.post('/login', async (request, response) => {
    try {
        const handle = normalizeUserHandle(request.body?.handle ?? request.body?.username);
        if (!handle) {
            console.warn('Login failed: Missing required fields');
            return response.status(400).json({ error: '请输入有效的用户名。' });
        }

        const ip = getIpAddress(request, PREFER_REAL_IP_HEADER);
        await loginLimiter.consume(ip);

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(handle));

        if (!user) {
            console.error('Login failed: User', handle, 'not found');
            return response.status(403).json({ error: '用户名或密码错误。' });
        }

        if (!user.enabled) {
            console.warn('Login failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: '该账号已被停用。' });
        }

        if (ENABLE_REGISTRATION && user.handle === DEFAULT_USER.handle && !user.password) {
            console.warn('Login failed: Passwordless default user is reserved for registration bootstrap');
            return response.status(403).json({ error: '请先注册管理员账号。' });
        }

        if (user.password && user.password !== getPasswordHash(String(request.body?.password ?? ''), user.salt)) {
            console.warn('Login failed: Incorrect password for', user.handle);
            return response.status(403).json({ error: '用户名或密码错误。' });
        }

        if (!request.session) {
            console.error('Session not available');
            return response.sendStatus(500);
        }

        await loginLimiter.delete(ip);
        request.session.handle = user.handle;
        request.session.version = getAccountVersion(user);
        console.info('Login successful:', user.handle, 'from', ip, 'at', new Date().toLocaleString());
        return response.json({ handle: user.handle });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Login failed: Rate limited from', getIpAddress(request, PREFER_REAL_IP_HEADER));
            return retryAfter(response, error).status(429).send({ error: '登录尝试次数过多，请稍后再试。' });
        }

        console.error('Login failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step1', async (request, response) => {
    try {
        const handle = normalizeUserHandle(request.body?.handle);
        if (!handle) {
            console.warn('Recover step 1 failed: Missing required fields');
            return response.status(400).json({ error: '请输入有效的用户名。' });
        }

        const ip = getIpAddress(request, PREFER_REAL_IP_HEADER);
        await recoverLimiter.consume(ip);

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(handle));

        if (!user) {
            console.error('Recover step 1 failed: User', handle, 'not found');
            return response.status(404).json({ error: '未找到该用户。' });
        }

        if (!user.enabled) {
            console.error('Recover step 1 failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: '该账号已被停用。' });
        }

        const mfaCode = generateRecoveryCode();
        console.log();
        console.log(color.blue(`${user.name}, your password recovery code is: `) + color.magenta(mfaCode));
        console.log();
        MFA_CACHE.set(user.handle, mfaCode);
        return response.sendStatus(204);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Recover step 1 failed: Rate limited from', getIpAddress(request, PREFER_REAL_IP_HEADER));
            return retryAfter(response, error).status(429).send({ error: '找回密码请求过多，请稍后再试。' });
        }

        console.error('Recover step 1 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step2', async (request, response) => {
    try {
        const handle = normalizeUserHandle(request.body?.handle);
        if (!handle || !request.body?.code) {
            console.warn('Recover step 2 failed: Missing required fields');
            return response.status(400).json({ error: '请填写完整的找回信息。' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(handle));
        const ip = getIpAddress(request, PREFER_REAL_IP_HEADER);
        const rateLimit = await recoverLimiter.get(ip);

        if (rateLimit !== null && rateLimit.consumedPoints > recoverLimiter.points) {
            throw rateLimit;
        }

        if (!user) {
            console.error('Recover step 2 failed: User', handle, 'not found');
            return response.status(404).json({ error: '未找到该用户。' });
        }

        if (!user.enabled) {
            console.warn('Recover step 2 failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: '该账号已被停用。' });
        }

        const mfaCode = MFA_CACHE.get(user.handle);

        if (request.body.code !== mfaCode) {
            await recoverLimiter.consume(ip);
            console.warn('Recover step 2 failed: Incorrect code');
            return response.status(403).json({ error: '恢复码不正确。' });
        }

        if (request.body.newPassword) {
            const salt = getPasswordSalt();
            user.password = getPasswordHash(request.body.newPassword, salt);
            user.salt = salt;
            await storage.setItem(toKey(user.handle), user);
        } else {
            user.password = '';
            user.salt = '';
            await storage.setItem(toKey(user.handle), user);
        }

        if (request.session && request.session.handle === user.handle) {
            request.session.version = getAccountVersion(user);
        }

        await recoverLimiter.delete(ip);
        MFA_CACHE.remove(user.handle);
        return response.sendStatus(204);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Recover step 2 failed: Rate limited from', getIpAddress(request, PREFER_REAL_IP_HEADER));
            return retryAfter(response, error).status(429).send({ error: '尝试次数过多，请稍后再试。' });
        }

        console.error('Recover step 2 failed:', error);
        return response.sendStatus(500);
    }
});
