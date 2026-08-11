import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

const FILE_NAME = 'workspace.json';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_CHARACTERS = 5000;
const MAX_STORYLINES_PER_CHARACTER = 2000;
const STATUS_VALUES = new Set(['idle', 'queued', 'generating', 'completed', 'failed', 'stopped']);

export const router = express.Router();

router.use((request, response, next) => {
    const contentLength = Number(request.get('content-length'));
    if (request.method === 'POST' && Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE) {
        return response.status(413).json({ error: 'Workspace state is too large' });
    }

    return next();
});

function createDefaultWorkspace() {
    return {
        version: 1,
        revision: 0,
        updatedAt: Date.now(),
        characters: {},
    };
}

function getWorkspacePath(request) {
    return path.join(request.user.directories.root, FILE_NAME);
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeKey(value) {
    return Boolean(value) && value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

function cleanString(value, maxLength = 512) {
    return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function cleanIdentifier(value, maxLength = 512) {
    return typeof value === 'string' && value.length <= maxLength && isSafeKey(value) ? value : null;
}

function cleanStringArray(value, maxItems = 64) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => typeof item === 'string')
        .slice(0, maxItems)
        .map(item => item.slice(0, 512));
}

function cleanStoryline(value = {}) {
    const status = STATUS_VALUES.has(value.status) ? value.status : 'idle';
    return {
        displayName: cleanString(value.displayName, 120),
        priority: Number.isFinite(value.priority) ? Number(value.priority) : 0,
        lastReadMessage: Number.isInteger(value.lastReadMessage) ? Math.max(-1, value.lastReadMessage) : -1,
        unreadCount: Number.isInteger(value.unreadCount) ? Math.max(0, value.unreadCount) : 0,
        status,
        error: cleanString(value.error, 1000),
        modelProfileId: cleanString(value.modelProfileId, 256),
        presetId: cleanString(value.presetId, 256),
        personaId: cleanString(value.personaId, 512),
        worldBookIds: cleanStringArray(value.worldBookIds),
        updatedAt: Number.isFinite(value.updatedAt) ? Number(value.updatedAt) : Date.now(),
    };
}

function cleanCharacter(value = {}) {
    const storylines = {};
    if (isRecord(value.storylines)) {
        for (const [storylineId, storyline] of Object.entries(value.storylines).slice(0, MAX_STORYLINES_PER_CHARACTER)) {
            const cleanStorylineId = cleanIdentifier(storylineId);
            if (cleanStorylineId && isRecord(storyline)) {
                storylines[cleanStorylineId] = cleanStoryline(storyline);
            }
        }
    }

    return {
        defaultStorylineId: cleanString(value.defaultStorylineId, 512),
        collapsed: value.collapsed !== false,
        storylines,
    };
}

function cleanWorkspace(value) {
    const workspace = createDefaultWorkspace();
    if (!isRecord(value)) {
        return workspace;
    }

    workspace.revision = Number.isInteger(value.revision) ? Math.max(0, value.revision) : 0;
    workspace.updatedAt = Number.isFinite(value.updatedAt) ? Math.max(0, Number(value.updatedAt)) : workspace.updatedAt;
    if (isRecord(value.characters)) {
        for (const [characterId, character] of Object.entries(value.characters).slice(0, MAX_CHARACTERS)) {
            const cleanCharacterId = cleanIdentifier(characterId);
            if (cleanCharacterId && isRecord(character)) {
                workspace.characters[cleanCharacterId] = cleanCharacter(character);
            }
        }
    }

    return workspace;
}

function readWorkspace(request) {
    const filePath = getWorkspacePath(request);
    if (!fs.existsSync(filePath)) {
        return createDefaultWorkspace();
    }

    try {
        return cleanWorkspace(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
        console.warn('Failed to read workspace state:', error);
        return createDefaultWorkspace();
    }
}

function writeWorkspace(request, value) {
    const workspace = cleanWorkspace(value);
    workspace.revision += 1;
    workspace.updatedAt = Date.now();
    const serialized = JSON.stringify(workspace, null, 4);

    if (Buffer.byteLength(serialized, 'utf8') > MAX_FILE_SIZE) {
        const error = new Error('Workspace state is too large');
        error.code = 'WORKSPACE_TOO_LARGE';
        throw error;
    }

    writeFileAtomicSync(getWorkspacePath(request), serialized, 'utf8');
    return workspace;
}

router.get('/state', (request, response) => {
    return response.json(readWorkspace(request));
});

router.post('/state', (request, response) => {
    try {
        if (!isRecord(request.body) || !Number.isInteger(request.body.revision)) {
            return response.status(400).json({ error: 'Invalid workspace state' });
        }

        const current = readWorkspace(request);
        if (Number.isInteger(request.body.revision) && request.body.revision !== current.revision) {
            return response.status(409).json({ error: 'Workspace state changed', workspace: current });
        }

        return response.json(writeWorkspace(request, request.body));
    } catch (error) {
        if (error?.code === 'WORKSPACE_TOO_LARGE') {
            return response.status(413).json({ error: error.message });
        }

        console.error('Failed to save workspace state:', error);
        return response.sendStatus(500);
    }
});

router.post('/character', (request, response) => {
    try {
        const characterId = cleanIdentifier(request.body?.characterId);
        if (!characterId) {
            return response.status(400).json({ error: 'Missing characterId' });
        }

        const workspace = readWorkspace(request);
        const current = workspace.characters[characterId] ?? cleanCharacter();
        workspace.characters[characterId] = cleanCharacter({
            ...current,
            defaultStorylineId: request.body.defaultStorylineId ?? current.defaultStorylineId,
            collapsed: request.body.collapsed ?? current.collapsed,
        });
        return response.json(writeWorkspace(request, workspace));
    } catch (error) {
        if (error?.code === 'WORKSPACE_TOO_LARGE') {
            return response.status(413).json({ error: error.message });
        }

        console.error('Failed to update workspace character:', error);
        return response.sendStatus(500);
    }
});

router.post('/storyline', (request, response) => {
    try {
        const characterId = cleanIdentifier(request.body?.characterId);
        const storylineId = cleanIdentifier(request.body?.storylineId);
        if (!characterId || !storylineId || !isRecord(request.body?.storyline)) {
            return response.status(400).json({ error: 'Invalid storyline update' });
        }

        const workspace = readWorkspace(request);
        const character = workspace.characters[characterId] ?? cleanCharacter();
        character.storylines[storylineId] = cleanStoryline({
            ...(character.storylines[storylineId] ?? {}),
            ...request.body.storyline,
            updatedAt: Date.now(),
        });
        workspace.characters[characterId] = character;
        return response.json(writeWorkspace(request, workspace));
    } catch (error) {
        if (error?.code === 'WORKSPACE_TOO_LARGE') {
            return response.status(413).json({ error: error.message });
        }

        console.error('Failed to update workspace storyline:', error);
        return response.sendStatus(500);
    }
});
