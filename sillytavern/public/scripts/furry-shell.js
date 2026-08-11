import {
    chat as currentChatMessages,
    characters,
    getCurrentChatId,
    getPastCharacterChats,
    getRequestHeaders,
    getThumbnailUrl,
    isGenerating,
    main_api,
    openCharacterChat,
    selectCharacterById,
    setCharacterSettingsOverrides,
    this_chid,
} from '../script.js';
import { eventSource, event_types } from './events.js';
import { resolveSecretKey, rotateSecret, secret_state } from './secrets.js';
import { accountsEnabled, currentUser } from './user.js';
import { assignLorebookToChat } from './world-info.js';

const STORAGE_PREFIX = 'new-tavern-workspace';
const WORKSPACE_REQUEST_TIMEOUT = 10000;
const DEFAULT_WORKSPACE = Object.freeze({
    version: 1,
    revision: 0,
    updatedAt: 0,
    characters: {},
});
const NATIVE_PANELS = {
    presets: {
        toggle: '#ai-config-button > .drawer-toggle',
        panel: '#left-nav-panel',
    },
    world: {
        toggle: '#WI-SP-button > .drawer-toggle',
        panel: '#WorldInfo',
    },
    plugins: {
        toggle: '#extensions-settings-button > .drawer-toggle',
        panel: '#rm_extensions_block',
    },
    user: {
        toggle: '#user-settings-button > .drawer-toggle',
        panel: '#user-settings-block',
    },
    advanced: {
        toggle: '#advanced-formatting-button > .drawer-toggle',
        panel: '#AdvancedFormatting',
    },
    backgrounds: {
        toggle: '#backgrounds-drawer-toggle',
        panel: '#Backgrounds',
    },
    persona: {
        toggle: '#persona-management-button > .drawer-toggle',
        panel: '#PersonaManagement',
    },
    api: {
        toggle: '#sys-settings-button > .drawer-toggle',
        panel: '#rm_api_block',
    },
    characters: {
        toggle: '#rightNavHolder > .drawer-toggle',
        panel: '#right-nav-panel',
    },
};
const API_LABELS = {
    textgenerationwebui: '文本补全',
    openai: '聊天补全',
    novel: 'NovelAI',
    koboldhorde: 'AI Horde',
    kobold: 'KoboldAI',
};
const MODEL_CONTROLS = {
    openai: {
        openai: 'model_openai_select',
        claude: 'model_claude_select',
        openrouter: 'model_openrouter_select',
        ai21: 'model_ai21_select',
        makersuite: 'model_google_select',
        vertexai: 'model_vertexai_select',
        mistralai: 'model_mistralai_select',
        custom: 'custom_model_id',
        cohere: 'model_cohere_select',
        perplexity: 'model_perplexity_select',
        groq: 'model_groq_select',
        chutes: 'model_chutes_select',
        siliconflow: 'model_siliconflow_select',
        minimax: 'model_minimax_select',
        electronhub: 'model_electronhub_select',
        nanogpt: 'model_nanogpt_select',
        deepseek: 'model_deepseek_select',
        aimlapi: 'model_aimlapi_select',
        xai: 'model_xai_select',
        pollinations: 'model_pollinations_select',
        moonshot: 'model_moonshot_select',
        fireworks: 'model_fireworks_select',
        cometapi: 'model_cometapi_select',
        azure_openai: 'azure_openai_model',
        zai: 'model_zai_select',
        workers_ai: 'model_workers_ai_select',
    },
    textgenerationwebui: {
        generic: 'generic_model_textgenerationwebui',
        ooba: 'custom_model_textgenerationwebui',
        togetherai: 'model_togetherai_select',
        openrouter: 'openrouter_model',
        infermaticai: 'model_infermaticai_select',
        dreamgen: 'model_dreamgen_select',
        mancer: 'mancer_model',
        vllm: 'vllm_model',
        aphrodite: 'aphrodite_model',
        ollama: 'ollama_model',
        tabby: 'tabby_model',
        llamacpp: 'llamacpp_model',
        featherless: 'featherless_model',
    },
    novel: {
        default: 'model_novel_select',
    },
    koboldhorde: {
        default: 'horde_model',
    },
};
const TEMPERATURE_CONTROLS = {
    kobold: 'temp',
    novel: 'temp_novel',
    openai: 'temp_openai',
    textgenerationwebui: 'temp_textgenerationwebui',
};
const PRESET_CONTROLS = {
    kobold: 'settings_preset',
    novel: 'settings_preset_novel',
    openai: 'settings_preset_openai',
    textgenerationwebui: 'settings_preset_textgenerationwebui',
};
const SHELL_NAV_ORDER = ['messages', 'character-list', 'presets', 'world', 'plugins', 'mine'];

let initialized = false;
let workspace = structuredClone(DEFAULT_WORKSPACE);
let workspaceApiAvailable = true;
let activeMode = 'home';
let activeHomePage = 'messages';
let currentView = { mode: 'home', page: 'messages', root: true };
const viewStack = [];
const sheetStack = [];
let sheetRestoreFocus = null;
let panelRevealToken = 0;
let panelRevealCleanup = null;
let activePanelObserver = null;
let messageFilter = 'all';
let searchQuery = '';
let activeGeneration = null;
let renderTimer = null;
let fullSaveTimer = null;
let workspaceSaveQueue = Promise.resolve();
let characterObserver = null;
let horaeRootObserver = null;
let horaeDrawerObserver = null;
let horaeBridgeBound = false;
let horaePanelOpen = false;
let horaeFocusOrigin = null;
let horaeBackdropTimer = null;
let horaeBackgroundState = [];
let navigationElement = null;
let navigationGesture = null;
let navigationGeometry = null;
let navigationResizeObserver = null;
let navigationResizeFrame = 0;
let navigationReleaseTimer = 0;
let navigationSuppressClickUntil = 0;
const panelExitObservers = new Map();
const storylineCache = new Map();
const loadingStorylines = new Set();

function getStorageKey() {
    const handle = currentUser?.handle || 'default-user';
    return STORAGE_PREFIX + ':' + handle;
}

function ensureWorkspace(value) {
    const result = structuredClone(DEFAULT_WORKSPACE);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return result;
    }

    result.revision = Number.isInteger(value.revision) ? value.revision : 0;
    result.updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
    result.characters = value.characters && typeof value.characters === 'object'
        ? value.characters
        : {};
    return result;
}

function saveWorkspaceLocally() {
    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(workspace));
    } catch (error) {
        console.warn('Unable to save the new tavern workspace locally.', error);
    }
}

function loadLocalWorkspace() {
    try {
        return ensureWorkspace(JSON.parse(localStorage.getItem(getStorageKey()) || 'null'));
    } catch (error) {
        console.warn('Unable to load the new tavern workspace locally.', error);
        return structuredClone(DEFAULT_WORKSPACE);
    }
}

async function requestWorkspace(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WORKSPACE_REQUEST_TIMEOUT);
    try {
        return await fetch(path, { ...options, signal: controller.signal });
    } finally {
        window.clearTimeout(timeout);
    }
}

function markInterruptedGenerations({ persist = true } = {}) {
    if (isGenerating()) {
        return;
    }

    let changed = false;
    for (const characterState of Object.values(workspace.characters)) {
        for (const storylineState of Object.values(characterState.storylines || {})) {
            if (storylineState.status === 'generating' || storylineState.status === 'queued') {
                storylineState.status = 'stopped';
                storylineState.updatedAt = Date.now();
                changed = true;
            }
        }
    }

    if (changed && persist) {
        scheduleFullWorkspaceSave();
    }
}

async function loadWorkspace() {
    const localWorkspace = loadLocalWorkspace();
    try {
        const response = await requestWorkspace('/api/workspace/state', {
            headers: getRequestHeaders(),
            cache: 'no-cache',
        });
        if (!response.ok) {
            workspaceApiAvailable = response.status !== 404;
            workspace = localWorkspace;
            return;
        }

        workspace = ensureWorkspace(await response.json());
        saveWorkspaceLocally();
    } catch (error) {
        workspaceApiAvailable = error?.name === 'AbortError';
        workspace = localWorkspace;
        console.info('Workspace API unavailable. Using local browser storage.', error);
    }
}

function mergeWorkspaces(remote, local) {
    const merged = ensureWorkspace(remote);
    for (const [characterId, localCharacter] of Object.entries(local.characters || {})) {
        const remoteCharacter = merged.characters[characterId] || {};
        merged.characters[characterId] = {
            ...remoteCharacter,
            ...localCharacter,
            storylines: {
                ...(remoteCharacter.storylines || {}),
                ...(localCharacter.storylines || {}),
            },
        };
    }
    return merged;
}

function queueWorkspaceRequest(callback) {
    workspaceSaveQueue = workspaceSaveQueue.then(callback, callback);
    return workspaceSaveQueue;
}

async function saveFullWorkspace() {
    saveWorkspaceLocally();
    if (!workspaceApiAvailable) {
        return;
    }

    return queueWorkspaceRequest(async function () {
        try {
            let response = await requestWorkspace('/api/workspace/state', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(workspace),
            });
            if (response.status === 409) {
                const conflict = await response.json();
                workspace = mergeWorkspaces(conflict.workspace, workspace);
                response = await requestWorkspace('/api/workspace/state', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify(workspace),
                });
            }
            if (!response.ok) {
                throw new Error('Workspace save failed with status ' + response.status);
            }
            workspace = ensureWorkspace(await response.json());
            saveWorkspaceLocally();
        } catch (error) {
            console.warn('Unable to save workspace state to the server.', error);
        }
    });
}

function scheduleFullWorkspaceSave() {
    saveWorkspaceLocally();
    window.clearTimeout(fullSaveTimer);
    fullSaveTimer = window.setTimeout(saveFullWorkspace, 500);
}

async function persistCharacter(characterId, updates) {
    const characterState = getCharacterStateById(characterId);
    Object.assign(characterState, updates);
    saveWorkspaceLocally();
    if (!workspaceApiAvailable) {
        return;
    }

    return queueWorkspaceRequest(async function () {
        try {
            const response = await requestWorkspace('/api/workspace/character', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ characterId, ...updates }),
            });
            if (!response.ok) {
                throw new Error('Character workspace update failed with status ' + response.status);
            }
            workspace = ensureWorkspace(await response.json());
            saveWorkspaceLocally();
        } catch (error) {
            console.warn('Unable to update the character workspace.', error);
        }
    });
}

async function persistStoryline(characterId, storylineId, updates) {
    const storylineState = getStorylineState(characterId, storylineId);
    Object.assign(storylineState, updates, { updatedAt: Date.now() });
    saveWorkspaceLocally();
    if (!workspaceApiAvailable) {
        return;
    }

    return queueWorkspaceRequest(async function () {
        try {
            const response = await requestWorkspace('/api/workspace/storyline', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    characterId,
                    storylineId,
                    storyline: updates,
                }),
            });
            if (!response.ok) {
                throw new Error('Storyline workspace update failed with status ' + response.status);
            }
            workspace = ensureWorkspace(await response.json());
            saveWorkspaceLocally();
        } catch (error) {
            console.warn('Unable to update the storyline workspace.', error);
        }
    });
}

function createShell() {
    const shell = document.createElement('div');
    shell.id = 'furry-shell';
    shell.innerHTML = [
        '<div class="furry-shell-surface">',
        '  <header class="furry-home-header">',
        '    <button id="furry-home-back" class="furry-icon-button furry-home-back" type="button" title="返回上一页" aria-label="返回上一页" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>',
        '    <div class="furry-heading">',
        '      <span class="furry-eyebrow">NEW TAVERN</span>',
        '      <h1 id="furry-page-title">我的角色聊天</h1>',
        '    </div>',
        '    <div class="furry-header-actions">',
        '      <button id="furry-search-toggle" class="furry-icon-button" type="button" title="搜索角色" aria-label="搜索角色"><i class="fa-solid fa-magnifying-glass"></i></button>',
        '      <button id="furry-create-character" class="furry-icon-button furry-icon-button-accent" type="button" title="创建角色" aria-label="创建角色"><i class="fa-solid fa-user-plus"></i></button>',
        '    </div>',
        '  </header>',
        '  <main class="furry-main">',
        '    <section id="furry-messages-page" class="furry-page is-active" aria-labelledby="furry-page-title">',
        '      <div id="furry-search-row" class="furry-search-row" hidden>',
        '        <i class="fa-solid fa-magnifying-glass"></i>',
        '        <input id="furry-character-search" type="search" placeholder="搜索角色或故事线" autocomplete="off">',
        '        <button id="furry-search-clear" class="furry-icon-button" type="button" title="清空搜索" aria-label="清空搜索"><i class="fa-solid fa-xmark"></i></button>',
        '      </div>',
        '      <div class="furry-message-toolbar">',
        '        <div class="furry-segmented" role="group" aria-label="消息筛选">',
        '          <button class="is-active" type="button" data-message-filter="all">全部</button>',
        '          <button type="button" data-message-filter="unread">未读</button>',
        '          <button type="button" data-message-filter="generating">生成中</button>',
        '        </div>',
        '        <span id="furry-message-summary" class="furry-summary"></span>',
        '      </div>',
        '      <div id="furry-character-list" class="furry-character-list" aria-live="polite"></div>',
        '    </section>',
        '    <section id="furry-mine-page" class="furry-page" aria-labelledby="furry-page-title">',
        '      <div class="furry-profile-band">',
        '        <div class="furry-profile-avatar"><i class="fa-solid fa-user"></i></div>',
        '        <div class="furry-profile-copy">',
        '          <strong id="furry-profile-name">本地用户</strong>',
        '          <span id="furry-profile-handle">独立数据空间</span>',
        '        </div>',
        '        <button class="furry-icon-button" type="button" data-native-action="account" title="账户设置" aria-label="账户设置"><i class="fa-solid fa-pen"></i></button>',
        '      </div>',
        '      <div class="furry-stats">',
        '        <div><strong id="furry-character-count">0</strong><span>我的角色</span></div>',
        '        <div><strong id="furry-storyline-count">0</strong><span>故事线</span></div>',
        '        <div><strong id="furry-unread-count">0</strong><span>未读</span></div>',
        '      </div>',
        '      <div class="furry-section-title"><h2>账号与设定</h2></div>',
        '      <div class="furry-menu-list">',
        '        <button type="button" data-native-action="account"><i class="fa-solid fa-user-shield"></i><span><strong>个人主页</strong><small>账户资料与登录状态</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="login"><i class="fa-solid fa-right-to-bracket"></i><span><strong>登录或切换账号</strong><small>进入其他用户的独立数据空间</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="register"><i class="fa-solid fa-user-plus"></i><span><strong>注册新账号</strong><small>仅需用户名和密码</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="persona"><i class="fa-solid fa-face-smile"></i><span><strong>User 设定</strong><small>全局与角色绑定 Persona</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="api"><i class="fa-solid fa-key"></i><span><strong>API Key 管理</strong><small>连接、保存并切换多个凭证</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="user"><i class="fa-solid fa-sliders"></i><span><strong>界面与用户设置</strong><small>主题、显示与聊天偏好</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '        <button type="button" data-native-action="advanced"><i class="fa-solid fa-font"></i><span><strong>高级格式与上下文</strong><small>管理指令、上下文模板与回复格式</small></span><i class="fa-solid fa-chevron-right"></i></button>',
        '      </div>',
        '      <div class="furry-section-title"><h2>我的创作</h2><button type="button" data-native-action="create-character">新建</button></div>',
        '      <div class="furry-creation-grid">',
        '        <button type="button" data-native-action="create-character"><i class="fa-solid fa-user-plus"></i><span>创建角色</span></button>',
        '        <button type="button" data-native-action="characters"><i class="fa-solid fa-address-book"></i><span>我的角色</span></button>',
        '        <button type="button" data-native-action="characters"><i class="fa-solid fa-clapperboard"></i><span>我的情景</span></button>',
        '        <button type="button" data-native-action="drafts"><i class="fa-solid fa-file-pen"></i><span>草稿箱</span></button>',
        '      </div>',
        '    </section>',
        '  </main>',
        '</div>',
        '<header id="furry-chat-header" class="furry-chat-header">',
        '  <button id="furry-chat-back" class="furry-icon-button" type="button" title="返回消息" aria-label="返回消息"><i class="fa-solid fa-chevron-left"></i></button>',
        '  <img id="furry-chat-avatar" src="img/ai4.png" alt="">',
        '  <div class="furry-chat-title"><strong id="furry-chat-name">角色聊天</strong><span id="furry-chat-storyline">主故事线</span></div>',
        '  <button id="furry-horae-button" class="furry-icon-button furry-horae-button" type="button" title="时光记忆" aria-label="时光记忆" hidden><i class="fa-regular fa-clock" aria-hidden="true"></i></button>',
        '  <button id="furry-model-button" class="furry-model-button" type="button" title="选择模型"><span id="furry-model-name">模型</span><i class="fa-solid fa-chevron-down"></i></button>',
        '  <button id="furry-chat-menu" class="furry-icon-button" type="button" title="聊天设置" aria-label="聊天设置"><i class="fa-solid fa-ellipsis"></i></button>',
        '</header>',
        '<nav id="furry-bottom-nav" class="furry-bottom-nav" aria-label="主导航">',
        '  <span id="furry-nav-liquid-indicator" class="furry-nav-liquid-indicator" aria-hidden="true"></span>',
        '  <button class="is-active" type="button" data-shell-page="messages" title="消息" aria-label="消息" aria-current="page"><span><i class="fa-solid fa-message"></i><b id="furry-nav-unread" hidden></b></span><em>消息</em></button>',
        '  <button type="button" data-shell-page="character-list" title="角色卡列表" aria-label="角色卡列表"><span><i class="fa-solid fa-address-book"></i></span><em>角色卡</em></button>',
        '  <button type="button" data-shell-page="presets" title="预设" aria-label="预设"><span><i class="fa-solid fa-sliders"></i></span><em>预设</em></button>',
        '  <button type="button" data-shell-page="world" title="世界书" aria-label="世界书"><span><i class="fa-solid fa-book-atlas"></i></span><em>世界书</em></button>',
        '  <button type="button" data-shell-page="plugins" title="插件" aria-label="插件"><span><i class="fa-solid fa-puzzle-piece"></i></span><em>插件</em></button>',
        '  <button type="button" data-shell-page="mine" title="我的" aria-label="我的"><span><i class="fa-solid fa-user"></i></span><em>我的</em></button>',
        '</nav>',
        '<div id="furry-sheet-backdrop" class="furry-sheet-backdrop" hidden>',
        '  <section class="furry-sheet" role="dialog" aria-modal="true" aria-labelledby="furry-sheet-title">',
        '    <div class="furry-sheet-handle"></div>',
        '    <header><button id="furry-sheet-back" class="furry-icon-button" type="button" title="返回上一页" aria-label="返回上一页"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><h2 id="furry-sheet-title"></h2><button id="furry-sheet-close" class="furry-icon-button" type="button" title="关闭" aria-label="关闭"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>',
        '    <div id="furry-sheet-content" class="furry-sheet-content"></div>',
        '  </section>',
        '</div>',
    ].join('');
    document.body.append(shell);
    document.body.classList.add('furry-shell-enabled', 'furry-shell-home');
    document.getElementById('preloader')?.remove();
}

function dismissBootstrap() {
    window.clearTimeout(window.__newTavernBootstrapTimer);
    document.body.classList.remove('furry-shell-booting');
    const bootstrap = document.getElementById('furry-shell-bootstrap');
    if (!bootstrap) {
        return;
    }
    bootstrap.setAttribute('aria-busy', 'false');
    bootstrap.classList.add('is-leaving');
    window.setTimeout(() => bootstrap.remove(), 140);
}

function getHoraeSettings() {
    try {
        return typeof window.Horae?.getSettings === 'function'
            ? window.Horae.getSettings()
            : null;
    } catch {
        return null;
    }
}

function ensureHoraeTheme() {
    if (document.getElementById('furry-horae-theme')) {
        return;
    }
    const link = document.createElement('link');
    link.id = 'furry-horae-theme';
    link.rel = 'stylesheet';
    link.href = 'css/furry-horae.css';
    document.head.append(link);
}

function ensureHoraeBackdrop() {
    let backdrop = document.getElementById('furry-horae-backdrop');
    if (backdrop) {
        return backdrop;
    }
    backdrop = document.createElement('div');
    backdrop.id = 'furry-horae-backdrop';
    backdrop.className = 'furry-horae-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', closeHoraePanel);
    document.body.append(backdrop);
    return backdrop;
}

function getHoraePanel() {
    return document.getElementById('horae_drawer_content');
}

function hasVisibleHoraeModal() {
    return Array.from(document.querySelectorAll('.horae-modal')).some(element => {
        return element instanceof HTMLElement && element.getClientRects().length > 0;
    });
}

function getHoraeFocusableElements(panel) {
    return Array.from(panel.querySelectorAll([
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter(element => {
        return element instanceof HTMLElement
            && !element.hidden
            && element.getClientRects().length > 0;
    });
}

function setHoraeBackgroundInert(isInert) {
    if (isInert) {
        horaeBackgroundState = ['furry-shell', 'sheld']
            .map(id => document.getElementById(id))
            .filter(element => element instanceof HTMLElement)
            .map(element => ({ element, inert: element.inert }));
        horaeBackgroundState.forEach(({ element }) => {
            element.inert = true;
        });
        return;
    }
    horaeBackgroundState.forEach(({ element, inert }) => {
        if (element.isConnected) {
            element.inert = inert;
        }
    });
    horaeBackgroundState = [];
}

function setHoraePanelState(isOpen, { restoreFocus = true } = {}) {
    getHoraePanel()?.setAttribute('aria-hidden', String(!isOpen));
    if (horaePanelOpen === isOpen) {
        return;
    }
    horaePanelOpen = isOpen;
    const backdrop = ensureHoraeBackdrop();
    window.clearTimeout(horaeBackdropTimer);
    if (isOpen) {
        horaeFocusOrigin = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        document.body.classList.add('furry-horae-open');
        backdrop.hidden = false;
        requestAnimationFrame(() => backdrop.classList.add('is-open'));
        setHoraeBackgroundInert(true);
        requestAnimationFrame(() => {
            const panel = getHoraePanel();
            const closeButton = document.getElementById('furry-horae-close');
            (closeButton || panel)?.focus({ preventScroll: true });
        });
        return;
    }

    document.body.classList.remove('furry-horae-open');
    backdrop.classList.remove('is-open');
    horaeBackdropTimer = window.setTimeout(() => {
        if (!horaePanelOpen) {
            backdrop.hidden = true;
        }
    }, 170);
    setHoraeBackgroundInert(false);
    if (restoreFocus) {
        const proxy = document.getElementById('furry-horae-button');
        const focusTarget = proxy && !proxy.hidden ? proxy : horaeFocusOrigin;
        requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
    }
    horaeFocusOrigin = null;
}

function closeHoraePanel() {
    const panel = getHoraePanel();
    if (!panel?.classList.contains('openDrawer')) {
        return;
    }
    const toggle = document.querySelector('#horae_drawer > .drawer-toggle, #horae_drawer .drawer-toggle');
    if (toggle instanceof HTMLElement) {
        toggle.click();
    }
}

function onHoraeKeydown(event) {
    if (!horaePanelOpen || hasVisibleHoraeModal()) {
        return;
    }
    const panel = getHoraePanel();
    if (!panel) {
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeHoraePanel();
        return;
    }
    if (event.key !== 'Tab') {
        return;
    }

    const focusable = getHoraeFocusableElements(panel);
    if (!focusable.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function decorateHoraePanel() {
    const panel = getHoraePanel();
    if (!(panel instanceof HTMLElement)) {
        return null;
    }
    ensureHoraeTheme();
    ensureHoraeBackdrop();
    if (!panel.classList.contains('furry-horae-panel')) {
        panel.classList.add('furry-horae-panel');
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', String(!panel.classList.contains('openDrawer')));
    panel.setAttribute('tabindex', '-1');

    const header = panel.querySelector(':scope > .drawer-header');
    const title = header?.querySelector('.horae-title');
    if (title) {
        title.id ||= 'furry-horae-title';
        panel.setAttribute('aria-labelledby', title.id);
    }
    if (header && !header.querySelector('#furry-horae-close')) {
        const closeButton = document.createElement('button');
        closeButton.id = 'furry-horae-close';
        closeButton.className = 'furry-horae-close';
        closeButton.type = 'button';
        closeButton.title = '关闭时光记忆';
        closeButton.setAttribute('aria-label', '关闭时光记忆');
        closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        closeButton.addEventListener('click', closeHoraePanel);
        header.append(closeButton);
    }
    return panel;
}

function syncHoraePanelState() {
    const panel = decorateHoraePanel();
    setHoraePanelState(Boolean(panel?.classList.contains('openDrawer')));
}

function syncHoraeButton() {
    const button = document.getElementById('furry-horae-button');
    if (!button) {
        return;
    }

    const drawer = document.getElementById('horae_drawer');
    const toggle = drawer?.querySelector('.drawer-toggle');
    const sourceIcon = document.getElementById('horae_drawer_icon');
    const settings = getHoraeSettings();
    const horaeAvailable = Boolean(window.Horae)
        && settings !== null
        && typeof settings === 'object';
    const isVisible = document.body.classList.contains('furry-shell-chat')
        && horaeAvailable
        && Boolean(toggle)
        && settings.showTopIcon !== false;

    button.hidden = !isVisible;
    button.disabled = !isVisible;
    if (!isVisible) {
        button.classList.remove('has-update');
        return;
    }

    const title = sourceIcon?.getAttribute('title')
        || sourceIcon?.getAttribute('data-i18n-title')
        || '时光记忆';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.classList.toggle('has-update', sourceIcon?.classList.contains('horae-cardprofile-has-update') === true);
}

function observeHoraeDrawer() {
    const drawer = document.getElementById('horae_drawer');
    if (!drawer) {
        horaeDrawerObserver?.disconnect();
        horaeDrawerObserver = null;
        setHoraePanelState(false);
        syncHoraeButton();
        return;
    }

    horaeDrawerObserver?.disconnect();
    horaeDrawerObserver = new MutationObserver((records) => {
        if (!drawer.isConnected) {
            horaeDrawerObserver?.disconnect();
            horaeDrawerObserver = null;
            setHoraePanelState(false);
            syncHoraeButton();
            return;
        }
        const panelWasReplaced = records.some(record => record.type === 'childList'
            && record.target === drawer
            && [
                ...Array.from(record.addedNodes),
                ...Array.from(record.removedNodes),
            ].some(node => node instanceof Element
                && (node.id === 'horae_drawer_content' || Boolean(node.querySelector?.('#horae_drawer_content')))));
        if (panelWasReplaced) {
            observeHoraeDrawer();
            return;
        }
        syncHoraePanelState();
        syncHoraeButton();
    });
    horaeDrawerObserver.observe(drawer, {
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'title', 'data-i18n-title'],
        childList: true,
    });
    const panel = getHoraePanel();
    if (panel) {
        horaeDrawerObserver.observe(panel, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden'],
        });
    }
    const sourceIcon = document.getElementById('horae_drawer_icon');
    if (sourceIcon) {
        horaeDrawerObserver.observe(sourceIcon, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'title', 'data-i18n-title'],
        });
    }
    syncHoraePanelState();
    syncHoraeButton();
}

function startHoraeRootObserver() {
    if (horaeRootObserver || !document.body) {
        return;
    }

    const containsHoraeNode = node => {
        if (!(node instanceof Element || node instanceof DocumentFragment)) {
            return false;
        }
        return node.matches?.('#horae_drawer, #horae_drawer_icon')
            || Boolean(node.querySelector?.('#horae_drawer, #horae_drawer_icon'));
    };

    horaeRootObserver = new MutationObserver((records) => {
        const hasHoraeMutation = records.some(record => [
            ...Array.from(record.addedNodes),
            ...Array.from(record.removedNodes),
        ].some(containsHoraeNode));
        if (!hasHoraeMutation) {
            return;
        }
        observeHoraeDrawer();
    });
    const observationRoot = document.getElementById('top-settings-holder') || document.body;
    horaeRootObserver.observe(observationRoot, {
        childList: true,
        subtree: observationRoot === document.body,
    });
    observeHoraeDrawer();
}

function stopHoraeObservers() {
    horaeRootObserver?.disconnect();
    horaeDrawerObserver?.disconnect();
    horaeRootObserver = null;
    horaeDrawerObserver = null;
    setHoraePanelState(false, { restoreFocus: false });
}

function bindHoraeBridge() {
    if (horaeBridgeBound) {
        syncHoraeButton();
        return;
    }
    horaeBridgeBound = true;

    const button = document.getElementById('furry-horae-button');
    button?.addEventListener('click', () => {
        const toggle = document.querySelector('#horae_drawer > .drawer-toggle, #horae_drawer .drawer-toggle');
        if (toggle instanceof HTMLElement) {
            toggle.click();
        }
        syncHoraeButton();
    });
    const horaeSyncEvents = [
        'horae:settingsChanged',
        event_types.EXTENSION_SETTINGS_LOADED,
        event_types.EXTENSIONS_FIRST_LOAD,
    ].filter(Boolean);
    horaeSyncEvents.forEach(eventName => eventSource.on(eventName, syncHoraeButton));
    document.addEventListener('keydown', onHoraeKeydown, true);
    startHoraeRootObserver();
    syncHoraeButton();
    window.addEventListener('pagehide', event => {
        if (event.persisted) {
            return;
        }
        horaeSyncEvents.forEach(eventName => eventSource.removeListener(eventName, syncHoraeButton));
        document.removeEventListener('keydown', onHoraeKeydown, true);
        stopHoraeObservers();
        document.getElementById('furry-horae-backdrop')?.remove();
    }, { once: true });
}

function bindShellEvents() {
    const bottomNavigation = document.getElementById('furry-bottom-nav');
    bottomNavigation.addEventListener('click', onNavigationClick);
    bindNavigationGestures(bottomNavigation);
    document.getElementById('furry-home-back').addEventListener('click', navigateBack);
    document.getElementById('furry-character-list').addEventListener('click', onCharacterListClick);
    document.getElementById('furry-search-toggle').addEventListener('click', toggleSearch);
    document.getElementById('furry-search-clear').addEventListener('click', clearSearch);
    document.getElementById('furry-character-search').addEventListener('input', onSearchInput);
    document.getElementById('furry-create-character').addEventListener('click', openCreateCharacter);
    document.querySelector('.furry-message-toolbar').addEventListener('click', onMessageFilterClick);
    document.getElementById('furry-mine-page').addEventListener('click', onMineActionClick);
    document.getElementById('furry-chat-back').addEventListener('click', navigateBack);
    bindHoraeBridge();
    document.getElementById('furry-model-button').addEventListener('click', openModelSheet);
    document.getElementById('furry-chat-menu').addEventListener('click', openChatMenuSheet);
    document.getElementById('furry-sheet-back').addEventListener('click', backSheet);
    document.getElementById('furry-sheet-close').addEventListener('click', closeSheet);
    document.getElementById('furry-sheet-backdrop').addEventListener('click', function (event) {
        if (event.target === this) {
            backSheet();
        }
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && sheetStack.length) {
            event.preventDefault();
            backSheet();
        }
    });
    window.addEventListener('furry-shell:navigate-back', navigateBack);
    document.addEventListener('change', function (event) {
        if (event.target.matches('#main_api, #chat_completion_source, #textgen_type, #connection_profiles, select[id*="model"], input[id*="model"]')) {
            syncChatHeader();
        }
    });
    window.addEventListener('pagehide', event => {
        if (event.persisted) {
            return;
        }
        window.removeEventListener('furry-shell:navigate-back', navigateBack);
        stopActivePanelObserver();
        cleanupNavigationGestures();
        clearAllPanelExitStates();
    }, { once: true });
}

function subscribeToSillyTavernEvents() {
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, scheduleRender);
    eventSource.on(event_types.CHARACTER_EDITED, clearStorylineCacheAndRender);
    eventSource.on(event_types.CHARACTER_DELETED, onCharacterDeleted);
    eventSource.on(event_types.CHARACTER_RENAMED, onCharacterRenamed);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHAT_CREATED, clearCurrentCharacterStorylines);
    eventSource.on(event_types.CHAT_DELETED, onChatDeleted);
    eventSource.on(event_types.CHAT_RENAMED, onChatRenamed);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    eventSource.on(event_types.GENERATION_STOPPED, onGenerationStopped);
    eventSource.on(event_types.CONNECTION_PROFILE_LOADED, syncChatHeader);
    eventSource.on(event_types.MAIN_API_CHANGED, syncChatHeader);
    eventSource.on(event_types.CHATCOMPLETION_MODEL_CHANGED, syncChatHeader);
    eventSource.on(event_types.ONLINE_STATUS_CHANGED, syncChatHeader);
}

function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderMessages, 80);
}

function clearStorylineCacheAndRender() {
    storylineCache.clear();
    scheduleRender();
}

function clearCurrentCharacterStorylines() {
    const character = characters[this_chid];
    if (character) {
        storylineCache.delete(getCharacterId(character));
    }
    scheduleRender();
}

function onCharacterRenamed(oldAvatar, newAvatar) {
    const oldId = String(oldAvatar || '');
    const newId = String(newAvatar || '');
    if (oldId && newId && oldId !== newId && workspace.characters[oldId]) {
        const oldState = workspace.characters[oldId];
        const newState = workspace.characters[newId] || {};
        workspace.characters[newId] = {
            ...newState,
            ...oldState,
            storylines: {
                ...(newState.storylines || {}),
                ...(oldState.storylines || {}),
            },
        };
        delete workspace.characters[oldId];
        scheduleFullWorkspaceSave();
    }
    storylineCache.delete(oldId);
    storylineCache.delete(newId);
    scheduleRender();
}

function onCharacterDeleted({ character } = {}) {
    const characterId = character ? getCharacterId(character) : '';
    if (characterId && workspace.characters[characterId]) {
        delete workspace.characters[characterId];
        scheduleFullWorkspaceSave();
    }
    storylineCache.delete(characterId);
    scheduleRender();
}

function onChatRenamed({ avatarId, oldFileName, newFileName } = {}) {
    const characterId = String(avatarId || '');
    const oldId = normalizeStorylineId(oldFileName);
    const newId = normalizeStorylineId(newFileName);
    const characterState = workspace.characters[characterId];
    if (characterState && oldId && newId && oldId !== newId && characterState.storylines?.[oldId]) {
        const storylineState = characterState.storylines[oldId];
        const characterName = characters.find(character => getCharacterId(character) === characterId)?.name;
        characterState.storylines[newId] = {
            ...characterState.storylines[newId],
            ...storylineState,
            displayName: formatStorylineName(newId, characterName),
            updatedAt: Date.now(),
        };
        delete characterState.storylines[oldId];
        if (characterState.defaultStorylineId === oldId) {
            characterState.defaultStorylineId = newId;
        }
        scheduleFullWorkspaceSave();
    }
    storylineCache.delete(characterId);
    scheduleRender();
}

function onChatDeleted(fileName) {
    const storylineId = normalizeStorylineId(fileName);
    if (!storylineId) {
        clearCurrentCharacterStorylines();
        return;
    }

    const currentCharacter = characters[this_chid];
    const currentCharacterId = currentCharacter ? getCharacterId(currentCharacter) : '';
    const candidates = currentCharacterId
        ? [currentCharacterId]
        : Object.keys(workspace.characters).filter(characterId => workspace.characters[characterId].storylines?.[storylineId]);
    if (candidates.length === 1 && removeStorylineState(candidates[0], storylineId)) {
        scheduleFullWorkspaceSave();
    }
    for (const characterId of candidates) {
        storylineCache.delete(characterId);
    }
    scheduleRender();
}

function removeStorylineState(characterId, storylineId) {
    const characterState = workspace.characters[characterId];
    if (!characterState?.storylines?.[storylineId]) {
        return false;
    }
    delete characterState.storylines[storylineId];
    if (characterState.defaultStorylineId === storylineId) {
        characterState.defaultStorylineId = null;
    }
    return true;
}

function getCharacterId(character) {
    return String(character?.avatar || character?.name || 'unknown-character');
}

function getCharacterState(character) {
    return getCharacterStateById(getCharacterId(character));
}

function getCharacterStateById(characterId) {
    if (!workspace.characters[characterId]) {
        workspace.characters[characterId] = {
            defaultStorylineId: null,
            collapsed: true,
            storylines: {},
        };
    }
    const characterState = workspace.characters[characterId];
    characterState.storylines ||= {};
    characterState.collapsed = characterState.collapsed !== false;
    return characterState;
}

function getStorylineState(characterId, storylineId) {
    const characterState = getCharacterStateById(characterId);
    if (!characterState.storylines[storylineId]) {
        characterState.storylines[storylineId] = {
            displayName: null,
            priority: 0,
            lastReadMessage: -1,
            unreadCount: 0,
            status: 'idle',
            error: null,
            modelProfileId: null,
            presetId: null,
            personaId: null,
            worldBookIds: [],
            updatedAt: Date.now(),
        };
    }
    return characterState.storylines[storylineId];
}

function getStorylineId(chat) {
    return normalizeStorylineId(chat?.file_id || chat?.file_name);
}

function normalizeStorylineId(value) {
    return String(value || '').replace(/\.jsonl$/i, '');
}

function getDefaultStorylineId(character, chats) {
    const characterState = getCharacterState(character);
    const configured = characterState.defaultStorylineId;
    const hasLoadedStorylines = storylineCache.has(getCharacterId(character));
    if (configured && (!hasLoadedStorylines || !chats.length || chats.some(chat => getStorylineId(chat) === configured))) {
        return configured;
    }
    const prioritized = [...chats].sort((left, right) => {
        const leftPriority = Number(getStorylineState(getCharacterId(character), getStorylineId(left)).priority) || 0;
        const rightPriority = Number(getStorylineState(getCharacterId(character), getStorylineId(right)).priority) || 0;
        return rightPriority - leftPriority;
    })[0];
    if (prioritized) {
        const prioritizedId = getStorylineId(prioritized);
        const priority = Number(getStorylineState(getCharacterId(character), prioritizedId).priority) || 0;
        if (priority > 0) {
            return prioritizedId;
        }
    }
    const current = String(character.chat || '').replace(/\.jsonl$/i, '');
    if (current) {
        return current;
    }
    return chats[0] ? getStorylineId(chats[0]) : '';
}

function isCurrentStoryline(characterIndex, storylineId) {
    return String(this_chid) === String(characterIndex)
        && String(getCurrentChatId() || '').replace(/\.jsonl$/i, '') === storylineId;
}

function syncStorylineMetadata(character, characterIndex, chat) {
    const characterId = getCharacterId(character);
    const storylineId = getStorylineId(chat);
    if (!storylineId) {
        return false;
    }

    const storylineState = getStorylineState(characterId, storylineId);
    const messageCount = Math.max(0, Number(chat.chat_items) || 0);
    const latestMessageIndex = messageCount - 1;
    let changed = false;
    if (storylineState.lastReadMessage < 0) {
        storylineState.lastReadMessage = latestMessageIndex;
        changed = true;
    } else if (latestMessageIndex > storylineState.lastReadMessage) {
        if (isCurrentStoryline(characterIndex, storylineId) && activeMode === 'chat') {
            storylineState.lastReadMessage = latestMessageIndex;
            storylineState.unreadCount = 0;
        } else {
            storylineState.unreadCount = Math.max(
                Number(storylineState.unreadCount) || 0,
                latestMessageIndex - storylineState.lastReadMessage,
            );
        }
        changed = true;
    }
    if (!storylineState.displayName) {
        storylineState.displayName = formatStorylineName(storylineId, character.name);
        changed = true;
    }
    if (changed) {
        storylineState.updatedAt = Number(chat.last_mes) || Date.now();
    }
    return changed;
}

async function loadStorylines(characterIndex) {
    const character = characters[characterIndex];
    if (!character) {
        return [];
    }
    const characterId = getCharacterId(character);
    if (storylineCache.has(characterId)) {
        return storylineCache.get(characterId);
    }
    if (loadingStorylines.has(characterId)) {
        return [];
    }

    loadingStorylines.add(characterId);
    try {
        const chats = await getPastCharacterChats(characterIndex);
        const normalized = chats.length ? chats : createFallbackStoryline(character);
        const didChange = normalized.some(chat => syncStorylineMetadata(character, characterIndex, chat));
        storylineCache.set(characterId, normalized);
        if (didChange) {
            scheduleFullWorkspaceSave();
        }
        scheduleRender();
        return normalized;
    } catch (error) {
        console.error('Unable to load storylines for ' + character.name, error);
        storylineCache.set(characterId, createFallbackStoryline(character));
        scheduleRender();
        return storylineCache.get(characterId);
    } finally {
        loadingStorylines.delete(characterId);
    }
}

function createFallbackStoryline(character) {
    const chatId = String(character.chat || '').replace(/\.jsonl$/i, '');
    if (!chatId) {
        return [];
    }
    return [{
        file_id: chatId,
        file_name: chatId + '.jsonl',
        chat_items: 0,
        mes: '',
        last_mes: character.date_last_chat || 0,
    }];
}

function renderMessages() {
    const list = document.getElementById('furry-character-list');
    if (!list) {
        return;
    }
    characterObserver?.disconnect();
    list.replaceChildren();

    const matchingCharacters = characters
        .map((character, index) => ({ character, index }))
        .filter(item => matchesCurrentFilters(item, activeHomePage === 'character-list'));
    if (!matchingCharacters.length) {
        list.append(createEmptyState());
    } else {
        const fragment = document.createDocumentFragment();
        for (const item of matchingCharacters) {
            fragment.append(createCharacterCard(item.character, item.index));
        }
        list.append(fragment);
    }

    const summary = matchingCharacters.length === characters.length
        ? characters.length + ' 个角色'
        : matchingCharacters.length + ' / ' + characters.length + ' 个角色';
    document.getElementById('furry-message-summary').textContent = summary;
    updateGlobalCounters();
    renderMineSummary();
    observeCharacterCards();
}

function matchesCurrentFilters(item, ignoreStatusFilter = false) {
    const character = item.character;
    const characterId = getCharacterId(character);
    const chats = storylineCache.get(characterId) || createFallbackStoryline(character);
    const query = searchQuery.toLocaleLowerCase('zh-CN');
    const textMatches = !query
        || character.name?.toLocaleLowerCase('zh-CN').includes(query)
        || chats.some(chat => {
            const storylineState = getStorylineState(characterId, getStorylineId(chat));
            return storylineState.displayName?.toLocaleLowerCase('zh-CN').includes(query);
        });
    if (!textMatches) {
        return false;
    }

    if (ignoreStatusFilter) {
        return true;
    }

    const summary = getCharacterSummary(character, item.index, chats);
    if (messageFilter === 'unread') {
        return summary.unreadCount > 0;
    }
    if (messageFilter === 'generating') {
        return summary.generatingCount > 0;
    }
    return true;
}

function createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'furry-empty-state';
    const icon = document.createElement('i');
    icon.className = activeHomePage === 'character-list'
        ? 'fa-solid fa-address-book'
        : 'fa-solid fa-comments';
    const title = document.createElement('strong');
    title.textContent = characters.length
        ? activeHomePage === 'character-list' ? '没有匹配的角色卡' : '没有符合条件的角色'
        : '还没有角色卡';
    const description = document.createElement('span');
    description.textContent = characters.length ? '调整筛选或搜索内容' : '创建或导入角色后会显示在这里';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'furry-primary-button';
    button.innerHTML = '<i class="fa-solid fa-user-plus"></i><span>创建角色</span>';
    button.addEventListener('click', openCreateCharacter);
    empty.append(icon, title, description, button);
    return empty;
}

function createCharacterCard(character, characterIndex) {
    const characterId = getCharacterId(character);
    const characterState = getCharacterState(character);
    const chats = storylineCache.get(characterId) || createFallbackStoryline(character);
    const defaultId = getDefaultStorylineId(character, chats);
    const defaultChat = chats.find(chat => getStorylineId(chat) === defaultId) || chats[0];
    const summary = getCharacterSummary(character, characterIndex, chats);
    const card = document.createElement('article');
    card.className = 'furry-character-card';
    card.dataset.characterIndex = String(characterIndex);
    card.dataset.characterId = characterId;
    const isCurrent = String(this_chid) === String(characterIndex);
    card.classList.toggle('is-current', isCurrent);
    if (!characterState.collapsed) {
        card.classList.add('is-expanded');
    }

    const mainButton = document.createElement('button');
    mainButton.type = 'button';
    mainButton.className = 'furry-character-main';
    mainButton.dataset.action = 'open-default';
    mainButton.dataset.storylineId = defaultId;
    if (isCurrent) {
        mainButton.setAttribute('aria-current', 'true');
    }

    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'furry-character-avatar';
    const avatar = document.createElement('img');
    avatar.src = getCharacterAvatar(character);
    avatar.alt = character.name || '角色头像';
    avatar.addEventListener('error', function () {
        this.src = 'img/ai4.png';
    }, { once: true });
    avatarWrap.append(avatar);
    if (summary.generatingCount > 0) {
        const pulse = document.createElement('i');
        pulse.className = 'furry-generating-pulse';
        avatarWrap.append(pulse);
    }

    const copy = document.createElement('span');
    copy.className = 'furry-character-copy';
    const nameRow = document.createElement('span');
    nameRow.className = 'furry-character-name-row';
    const name = document.createElement('strong');
    name.textContent = character.name || '未命名角色';
    nameRow.append(name);
    if (isCurrent) {
        nameRow.append(createStatusChip('当前', 'current'));
    }
    if (summary.generatingCount > 0) {
        const generatingLabel = summary.generatingCount > 1
            ? summary.generatingCount + ' 条生成中'
            : '生成中';
        nameRow.append(createStatusChip(generatingLabel, 'generating'));
    }
    if (summary.unreadCount > 0) {
        nameRow.append(createStatusChip(String(summary.unreadCount), 'unread'));
    }

    const storylineLabel = document.createElement('span');
    storylineLabel.className = 'furry-character-storyline';
    storylineLabel.textContent = getStorylineDisplayName(characterId, defaultId, character.name);
    const preview = document.createElement('span');
    preview.className = 'furry-character-preview';
    preview.textContent = getPlainText(defaultChat?.mes) || character.data?.creator_notes || '点击进入主故事线';
    copy.append(nameRow, storylineLabel, preview);

    const time = document.createElement('time');
    time.textContent = formatRelativeTime(defaultChat?.last_mes || character.date_last_chat);
    mainButton.append(avatarWrap, copy, time);

    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className = 'furry-expand-button';
    expandButton.dataset.action = 'toggle-storylines';
    expandButton.title = characterState.collapsed ? '展开故事线' : '折叠故事线';
    expandButton.setAttribute('aria-label', expandButton.title);
    expandButton.setAttribute('aria-expanded', String(!characterState.collapsed));
    expandButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    card.append(mainButton, expandButton);

    const storylines = createStorylineList(character, characterIndex, chats, defaultId);
    storylines.hidden = characterState.collapsed;
    card.append(storylines);
    return card;
}

function createStatusChip(label, type) {
    const chip = document.createElement('span');
    chip.className = 'furry-status-chip is-' + type;
    chip.textContent = label;
    return chip;
}

function createStorylineList(character, characterIndex, chats, defaultId) {
    const characterId = getCharacterId(character);
    const container = document.createElement('div');
    container.className = 'furry-storyline-list';
    if (loadingStorylines.has(characterId)) {
        const loading = document.createElement('div');
        loading.className = 'furry-storyline-loading';
        loading.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>载入故事线</span>';
        container.append(loading);
        return container;
    }
    if (!chats.length) {
        const empty = document.createElement('div');
        empty.className = 'furry-storyline-loading';
        empty.textContent = '尚未创建故事线';
        container.append(empty);
        return container;
    }

    const sorted = [...chats].sort((left, right) => {
        const leftId = getStorylineId(left);
        const rightId = getStorylineId(right);
        if (leftId === defaultId) return -1;
        if (rightId === defaultId) return 1;
        const leftPriority = Number(getStorylineState(characterId, leftId).priority) || 0;
        const rightPriority = Number(getStorylineState(characterId, rightId).priority) || 0;
        return rightPriority - leftPriority || Number(right.last_mes || 0) - Number(left.last_mes || 0);
    });
    for (const chat of sorted) {
        const storylineId = getStorylineId(chat);
        const storylineState = getStorylineState(characterId, storylineId);
        const row = document.createElement('div');
        row.className = 'furry-storyline-row';
        if (storylineId === defaultId) {
            row.classList.add('is-default');
        }

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'furry-storyline-open';
        openButton.dataset.action = 'open-storyline';
        openButton.dataset.storylineId = storylineId;
        const icon = document.createElement('i');
        icon.className = isCurrentStoryline(characterIndex, storylineId)
            ? 'fa-solid fa-comment-dots'
            : 'fa-solid fa-message';
        const copy = document.createElement('span');
        const title = document.createElement('strong');
        title.textContent = getStorylineDisplayName(characterId, storylineId, character.name);
        const detail = document.createElement('small');
        detail.textContent = (Number(chat.chat_items) || 0) + ' 条消息 · ' + formatRelativeTime(chat.last_mes);
        copy.append(title, detail);
        openButton.append(icon, copy);
        if (isActiveStorylineStatus(storylineState.status) || activeGeneration?.storylineId === storylineId) {
            const statusLabel = storylineState.status === 'queued' ? '排队中' : '生成中';
            openButton.append(createStatusChip(statusLabel, 'generating'));
        } else if (storylineState.unreadCount > 0) {
            openButton.append(createStatusChip(String(storylineState.unreadCount), 'unread'));
        }

        const defaultButton = document.createElement('button');
        defaultButton.type = 'button';
        defaultButton.className = 'furry-storyline-default';
        defaultButton.dataset.action = 'set-default';
        defaultButton.dataset.storylineId = storylineId;
        defaultButton.title = storylineId === defaultId ? '当前默认故事线' : '设为默认故事线';
        defaultButton.setAttribute('aria-label', defaultButton.title);
        defaultButton.innerHTML = '<i class="fa-' + (storylineId === defaultId ? 'solid' : 'regular') + ' fa-star"></i>';
        row.append(openButton, defaultButton);
        container.append(row);
    }
    return container;
}

function getCharacterSummary(character, characterIndex, chats) {
    const characterId = getCharacterId(character);
    let unreadCount = 0;
    let generatingCount = 0;
    for (const chat of chats) {
        const storylineId = getStorylineId(chat);
        const storylineState = getStorylineState(characterId, storylineId);
        unreadCount += Math.max(0, Number(storylineState.unreadCount) || 0);
        if (isActiveStorylineStatus(storylineState.status)) {
            generatingCount++;
        }
    }
    if (activeGeneration?.characterIndex === characterIndex && generatingCount === 0) {
        generatingCount = 1;
    }
    return { unreadCount, generatingCount };
}

function isActiveStorylineStatus(status) {
    return status === 'generating' || status === 'queued';
}

function observeCharacterCards() {
    const root = document.querySelector('.furry-main');
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.furry-character-card').forEach(card => {
            loadStorylines(Number(card.dataset.characterIndex));
        });
        return;
    }
    characterObserver = new IntersectionObserver(function (entries) {
        for (const entry of entries) {
            if (!entry.isIntersecting) {
                continue;
            }
            characterObserver.unobserve(entry.target);
            loadStorylines(Number(entry.target.dataset.characterIndex));
        }
    }, { root, rootMargin: '240px 0px' });
    document.querySelectorAll('.furry-character-card').forEach(card => characterObserver.observe(card));
}

function onCharacterListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    const card = event.target.closest('.furry-character-card');
    if (!actionButton || !card) {
        return;
    }
    const characterIndex = Number(card.dataset.characterIndex);
    const storylineId = actionButton.dataset.storylineId || '';
    switch (actionButton.dataset.action) {
        case 'open-default':
        case 'open-storyline':
            openStoryline(characterIndex, storylineId);
            break;
        case 'toggle-storylines':
            toggleStorylines(characterIndex);
            break;
        case 'set-default':
            setDefaultStoryline(characterIndex, storylineId);
            break;
    }
}

async function toggleStorylines(characterIndex) {
    const character = characters[characterIndex];
    if (!character) {
        return;
    }
    const characterId = getCharacterId(character);
    const characterState = getCharacterState(character);
    const collapsed = !characterState.collapsed;
    characterState.collapsed = collapsed;
    renderMessages();
    if (!collapsed) {
        await loadStorylines(characterIndex);
    }
    persistCharacter(characterId, { collapsed });
}

function setDefaultStoryline(characterIndex, storylineId) {
    const character = characters[characterIndex];
    if (!character || !storylineId) {
        return;
    }
    const characterId = getCharacterId(character);
    getCharacterState(character).defaultStorylineId = storylineId;
    renderMessages();
    persistCharacter(characterId, { defaultStorylineId: storylineId });
    toastr.success('已设为默认故事线');
}

async function openStoryline(characterIndex, storylineId) {
    const character = characters[characterIndex];
    if (!character) {
        return;
    }
    document.body.classList.add('furry-shell-busy');
    closeNativePanels();
    try {
        await selectCharacterById(characterIndex, { switchMenu: false });
        if (String(this_chid) !== String(characterIndex)) {
            toastr.warning('当前会话仍在生成，暂时无法切换角色。');
            return;
        }
        const currentChat = String(getCurrentChatId() || '').replace(/\.jsonl$/i, '');
        if (storylineId && currentChat !== storylineId) {
            await openCharacterChat(storylineId);
        }
        await applyStorylineConnectionProfile(getCharacterId(character), storylineId || getCurrentChatId());
        showChatView();
        await markCurrentStorylineRead();
        syncChatHeader();
    } catch (error) {
        console.error('Unable to open storyline.', error);
        toastr.error('故事线打开失败，请稍后重试。');
    } finally {
        document.body.classList.remove('furry-shell-busy');
    }
}

async function markCurrentStorylineRead() {
    const character = characters[this_chid];
    const storylineId = String(getCurrentChatId() || '').replace(/\.jsonl$/i, '');
    if (!character || !storylineId) {
        return;
    }
    const characterId = getCharacterId(character);
    const chats = storylineCache.get(characterId) || [];
    const chat = chats.find(item => getStorylineId(item) === storylineId);
    const lastReadMessage = Math.max(
        -1,
        currentChatMessages.length - 1,
        (Number(chat?.chat_items) || 0) - 1,
    );
    const updates = {
        lastReadMessage,
        unreadCount: 0,
    };
    Object.assign(getStorylineState(characterId, storylineId), updates);
    scheduleRender();
    persistStoryline(characterId, storylineId, updates);
}

function viewsEqual(left, right) {
    return left?.mode === right?.mode
        && left?.page === right?.page
        && left?.name === right?.name
        && left?.navigationPage === right?.navigationPage
        && Boolean(left?.root) === Boolean(right?.root);
}

function setCurrentView(nextView, history = 'push') {
    if (history === 'push' && currentView && !viewsEqual(currentView, nextView)) {
        viewStack.push({ ...currentView });
        if (viewStack.length > 40) {
            viewStack.shift();
        }
    }
    currentView = { ...nextView };
    updateBackControls();
}

function updateBackControls() {
    const homeBack = document.getElementById('furry-home-back');
    if (homeBack) {
        homeBack.hidden = currentView.mode !== 'home'
            || currentView.root === true
            || viewStack.length === 0;
    }
}

function stopActivePanelObserver() {
    activePanelObserver?.disconnect();
    activePanelObserver = null;
}

function observeActivePanel(panel, name) {
    stopActivePanelObserver();
    activePanelObserver = new MutationObserver(() => {
        if (activeMode !== 'panel'
            || currentView.mode !== 'panel'
            || currentView.name !== name
            || panel.classList.contains('openDrawer')) {
            return;
        }
        stopActivePanelObserver();
        navigateBack();
    });
    activePanelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
}

function animateHomePageEntry(page, previousPage) {
    const target = page === 'mine'
        ? document.getElementById('furry-mine-page')
        : document.getElementById('furry-messages-page');
    if (!target) {
        return;
    }
    const previousIndex = SHELL_NAV_ORDER.indexOf(previousPage);
    const nextIndex = SHELL_NAV_ORDER.indexOf(page);
    const direction = previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex ? 'back' : 'forward';
    target.classList.remove('is-liquid-forward', 'is-liquid-back');
    void target.offsetWidth;
    target.classList.add(direction === 'back' ? 'is-liquid-back' : 'is-liquid-forward');
    window.setTimeout(() => target.classList.remove('is-liquid-forward', 'is-liquid-back'), 220);
}

function applyView(view) {
    if (view.mode === 'chat') {
        showChatView({ history: 'none' });
        return;
    }
    if (view.mode === 'panel') {
        showNativePanel(view.name, view.navigationPage || view.name, null, {
            history: 'none',
            root: view.root === true,
        });
        return;
    }
    showHomePage(view.page || 'messages', { history: 'none', root: view.root !== false });
}

function navigateBack() {
    if (sheetStack.length) {
        backSheet();
        return;
    }
    if (horaePanelOpen) {
        closeHoraePanel();
        return;
    }
    const previous = viewStack.pop() || { mode: 'home', page: 'messages', root: true };
    applyView(previous);
}

function showChatView({ history = 'push' } = {}) {
    cancelPendingPanelReveal();
    stopActivePanelObserver();
    setCurrentView({ mode: 'chat' }, history);
    activeMode = 'chat';
    panelRevealToken++;
    closeNativePanels();
    closeOtherOpenDrawers();
    document.body.classList.remove('furry-shell-home', 'furry-shell-panel');
    document.body.classList.add('furry-shell-chat');
    setActiveNavigation('messages');
    closeSheet();
    document.getElementById('sheld')?.classList.add('furry-liquid-enter');
    window.setTimeout(() => document.getElementById('sheld')?.classList.remove('furry-liquid-enter'), 220);
    syncHoraeButton();
}

function showHomePage(page, { history = 'push', root = true } = {}) {
    cancelPendingPanelReveal();
    stopActivePanelObserver();
    const previousPage = currentView.mode === 'home' ? currentView.page : activeHomePage;
    setCurrentView({ mode: 'home', page, root }, history);
    activeMode = 'home';
    activeHomePage = page;
    panelRevealToken++;
    closeNativePanels();
    closeOtherOpenDrawers();
    closeSheet();
    document.body.classList.remove('furry-shell-chat', 'furry-shell-panel');
    document.body.classList.add('furry-shell-home');
    const isCharacterPage = page === 'messages' || page === 'character-list';
    document.getElementById('furry-messages-page').classList.toggle('is-active', isCharacterPage);
    document.getElementById('furry-messages-page').classList.toggle('is-character-list', page === 'character-list');
    document.getElementById('furry-mine-page').classList.toggle('is-active', page === 'mine');
    document.getElementById('furry-page-title').textContent = page === 'mine'
        ? '我的'
        : page === 'character-list' ? '角色卡列表' : '我的角色聊天';
    document.getElementById('furry-search-toggle').hidden = !isCharacterPage;
    document.getElementById('furry-create-character').hidden = !isCharacterPage;
    document.querySelector('.furry-segmented').hidden = page === 'character-list';
    setActiveNavigation(page);
    syncHoraeButton();
    if (isCharacterPage) {
        renderMessages();
    } else {
        renderMineSummary();
    }
    animateHomePageEntry(page, previousPage);
}

function onNavigationClick(event) {
    const button = event.target.closest('[data-shell-page]');
    if (!button) {
        return;
    }
    if (performance.now() < navigationSuppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    const page = button.dataset.shellPage;
    activateRootPage(page);
}

function isActiveRootPage(page) {
    if (currentView.root !== true) {
        return false;
    }
    if (currentView.mode === 'home') {
        return currentView.page === page;
    }
    return currentView.mode === 'panel' && currentView.navigationPage === page;
}

function activateRootPage(page) {
    if (!SHELL_NAV_ORDER.includes(page)) {
        return;
    }

    viewStack.length = 0;
    updateBackControls();
    if (isActiveRootPage(page)) {
        setActiveNavigation(page);
        return;
    }

    if (page === 'messages' || page === 'character-list' || page === 'mine') {
        showHomePage(page, { history: 'none', root: true });
        return;
    }
    showNativePanel(page, page, null, { history: 'none', root: true });
}

function getNavigationButtons() {
    if (!navigationElement) {
        return [];
    }
    return Array.from(navigationElement.querySelectorAll(':scope > [data-shell-page]'));
}

function setNavigationIndicatorTransform(position, stretch = 1, direction = 0) {
    const indicator = document.getElementById('furry-nav-liquid-indicator');
    if (!indicator || !Number.isFinite(position)) {
        return;
    }
    const normalizedStretch = Math.max(1, Math.min(1.34, stretch));
    indicator.style.setProperty('--furry-nav-liquid-x', position.toFixed(2) + 'px');
    indicator.style.setProperty('--furry-nav-liquid-scale-x', normalizedStretch.toFixed(3));
    indicator.style.setProperty('--furry-nav-liquid-scale-y', Math.max(0.9, 1 - (normalizedStretch - 1) * 0.3).toFixed(3));
    indicator.style.setProperty('--furry-nav-liquid-origin', direction < 0 ? '100%' : direction > 0 ? '0%' : '50%');
}

function measureNavigationGeometry() {
    const indicator = document.getElementById('furry-nav-liquid-indicator');
    const buttons = getNavigationButtons();
    if (!navigationElement || !indicator || !buttons.length) {
        navigationGeometry = null;
        return;
    }
    if (navigationGesture) {
        resetNavigationGesture();
    }

    const navigationRect = navigationElement.getBoundingClientRect();
    if (!navigationRect.width) {
        navigationGeometry = null;
        return;
    }
    const buttonRects = buttons.map(button => button.getBoundingClientRect());
    const iconRect = buttons[0].querySelector(':scope > span')?.getBoundingClientRect() || buttonRects[0];
    const indicatorWidth = Math.round(Math.max(40, Math.min(60, buttonRects[0].width - 16)));
    const indicatorHeight = 32;
    const positions = buttonRects.map(rect => rect.left - navigationRect.left + (rect.width - indicatorWidth) / 2);
    const indicatorTop = iconRect.top - navigationRect.top + (iconRect.height - indicatorHeight) / 2;
    navigationGeometry = {
        buttons,
        positions,
        min: positions[0],
        max: positions.at(-1),
        step: positions.length > 1 ? Math.abs(positions[1] - positions[0]) : buttonRects[0].width,
    };

    indicator.classList.add('is-measuring');
    indicator.style.width = indicatorWidth + 'px';
    indicator.style.height = indicatorHeight + 'px';
    indicator.style.setProperty('--furry-nav-liquid-y', Math.round(indicatorTop) + 'px');
    const activeIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
    setNavigationIndicatorTransform(positions[activeIndex], 1, 0);
    window.requestAnimationFrame(() => {
        indicator.classList.remove('is-measuring');
        indicator.classList.add('is-ready');
    });
}

function scheduleNavigationMeasure() {
    window.cancelAnimationFrame(navigationResizeFrame);
    navigationResizeFrame = window.requestAnimationFrame(() => {
        navigationResizeFrame = 0;
        measureNavigationGeometry();
    });
}

function syncNavigationIndicator({ animate = true } = {}) {
    const indicator = document.getElementById('furry-nav-liquid-indicator');
    const buttons = getNavigationButtons();
    if (!indicator || !buttons.length) {
        return;
    }
    if (!navigationGeometry || navigationGeometry.buttons.length !== buttons.length) {
        measureNavigationGeometry();
        return;
    }
    const activeIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('is-active')));
    indicator.classList.toggle('is-measuring', !animate);
    setNavigationIndicatorTransform(navigationGeometry.positions[activeIndex], 1, 0);
    if (!animate) {
        window.requestAnimationFrame(() => indicator.classList.remove('is-measuring'));
    }
}

function setNavigationDragTarget(index) {
    getNavigationButtons().forEach((button, buttonIndex) => {
        button.classList.toggle('is-drag-target', buttonIndex === index);
    });
}

function findNearestNavigationIndex(position) {
    if (!navigationGeometry) {
        return 0;
    }
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    navigationGeometry.positions.forEach((candidate, index) => {
        const distance = Math.abs(candidate - position);
        if (distance < nearestDistance) {
            nearestIndex = index;
            nearestDistance = distance;
        }
    });
    return nearestIndex;
}

function releaseNavigationButton(button, rebound = false) {
    if (!button) {
        return;
    }
    button.classList.remove('is-pressed');
    if (!rebound) {
        return;
    }
    button.classList.remove('is-rebounding');
    void button.offsetWidth;
    button.classList.add('is-rebounding');
    button.addEventListener('animationend', () => button.classList.remove('is-rebounding'), { once: true });
}

function resetNavigationGesture({ rebound = false } = {}) {
    const state = navigationGesture;
    if (!state) {
        return;
    }
    releaseNavigationButton(state.button, rebound);
    navigationElement?.classList.remove('is-pointer-active', 'is-dragging');
    setNavigationDragTarget(-1);
    if (navigationElement?.hasPointerCapture?.(state.pointerId)) {
        try {
            navigationElement.releasePointerCapture(state.pointerId);
        } catch {
            // The browser may have released capture while dispatching pointercancel.
        }
    }
    navigationGesture = null;
}

function onNavigationPointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
    }
    const button = event.target.closest('[data-shell-page]');
    if (!button || !navigationElement?.contains(button)) {
        return;
    }
    if (navigationGesture) {
        resetNavigationGesture();
    }
    if (!navigationGeometry) {
        measureNavigationGeometry();
    }
    const buttons = getNavigationButtons();
    const startIndex = buttons.indexOf(button);
    if (startIndex < 0 || !Number.isFinite(navigationGeometry?.positions[startIndex])) {
        return;
    }
    const now = performance.now();
    navigationGesture = {
        pointerId: event.pointerId,
        button,
        startIndex,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: navigationGeometry.positions[startIndex],
        lastX: event.clientX,
        lastAt: now,
        velocity: 0,
        dragging: false,
    };
    navigationElement.classList.add('is-pointer-active');
    button.classList.add('is-pressed');
}

function onNavigationPointerMove(event) {
    const state = navigationGesture;
    if (!state || state.pointerId !== event.pointerId || !navigationGeometry) {
        return;
    }
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.dragging) {
        if (Math.abs(deltaY) > 7 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
            navigationSuppressClickUntil = performance.now() + 420;
            resetNavigationGesture();
            syncNavigationIndicator({ animate: true });
            return;
        }
        if (Math.abs(deltaX) < 7 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) {
            return;
        }
        state.dragging = true;
        releaseNavigationButton(state.button);
        navigationElement.classList.add('is-dragging');
        try {
            navigationElement.setPointerCapture?.(event.pointerId);
        } catch {
            // Pointer capture is optional; window listeners still complete the gesture.
        }
    }

    if (event.cancelable) {
        event.preventDefault();
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - state.lastAt);
    state.velocity = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastAt = now;
    const position = Math.max(navigationGeometry.min, Math.min(navigationGeometry.max, state.startPosition + deltaX));
    const stretch = 1 + Math.min(0.3, Math.abs(deltaX) / Math.max(1, navigationGeometry.step) * 0.1 + Math.abs(state.velocity) * 0.08);
    setNavigationIndicatorTransform(position, stretch, Math.sign(deltaX));
    setNavigationDragTarget(findNearestNavigationIndex(position));
}

function settleNavigationIndicator(targetIndex, direction) {
    const indicator = document.getElementById('furry-nav-liquid-indicator');
    if (!indicator || !navigationGeometry) {
        return;
    }
    window.clearTimeout(navigationReleaseTimer);
    indicator.classList.add('is-settling');
    setNavigationIndicatorTransform(navigationGeometry.positions[targetIndex], 1.08, direction);
    window.requestAnimationFrame(() => {
        setNavigationIndicatorTransform(navigationGeometry.positions[targetIndex], 1, 0);
    });
    navigationReleaseTimer = window.setTimeout(() => {
        indicator.classList.remove('is-settling');
        navigationReleaseTimer = 0;
    }, 430);
}

function onNavigationPointerUp(event) {
    const state = navigationGesture;
    if (!state || state.pointerId !== event.pointerId) {
        return;
    }
    if (!state.dragging || !navigationGeometry) {
        resetNavigationGesture({ rebound: true });
        return;
    }

    const deltaX = event.clientX - state.startX;
    const position = Math.max(navigationGeometry.min, Math.min(navigationGeometry.max, state.startPosition + deltaX));
    const minimumDistance = navigationGeometry.step * 0.3;
    const releaseVelocity = performance.now() - state.lastAt > 100 ? 0 : state.velocity;
    const isFlick = Math.abs(releaseVelocity) > 0.45 && Math.abs(deltaX) > 12;
    let targetIndex = findNearestNavigationIndex(position);
    if (Math.abs(deltaX) < minimumDistance && !isFlick) {
        targetIndex = state.startIndex;
    } else if (isFlick && targetIndex === state.startIndex) {
        targetIndex = state.startIndex + Math.sign(deltaX || releaseVelocity);
    }
    targetIndex = Math.max(0, Math.min(SHELL_NAV_ORDER.length - 1, targetIndex));
    const direction = Math.sign(targetIndex - state.startIndex || deltaX);
    navigationSuppressClickUntil = performance.now() + 500;
    const targetPage = navigationGeometry.buttons[targetIndex]?.dataset.shellPage;
    if (targetPage) {
        activateRootPage(targetPage);
    }
    resetNavigationGesture();
    settleNavigationIndicator(targetIndex, direction);
}

function onNavigationPointerCancel(event) {
    if (!navigationGesture || navigationGesture.pointerId !== event.pointerId) {
        return;
    }
    navigationSuppressClickUntil = performance.now() + 350;
    resetNavigationGesture();
    syncNavigationIndicator({ animate: true });
}

function bindNavigationGestures(navigation) {
    if (navigationElement === navigation) {
        scheduleNavigationMeasure();
        return;
    }
    if (navigationElement) {
        cleanupNavigationGestures();
    }
    navigationElement = navigation;
    navigation.addEventListener('pointerdown', onNavigationPointerDown);
    window.addEventListener('pointermove', onNavigationPointerMove, { passive: false });
    window.addEventListener('pointerup', onNavigationPointerUp);
    window.addEventListener('pointercancel', onNavigationPointerCancel);
    window.addEventListener('resize', scheduleNavigationMeasure, { passive: true });
    if ('ResizeObserver' in window) {
        navigationResizeObserver = new ResizeObserver(scheduleNavigationMeasure);
        navigationResizeObserver.observe(navigation);
    }
    scheduleNavigationMeasure();
}

function cleanupNavigationGestures() {
    resetNavigationGesture();
    if (navigationElement) {
        navigationElement.removeEventListener('pointerdown', onNavigationPointerDown);
        navigationElement.classList.remove('is-pointer-active', 'is-dragging');
    }
    window.removeEventListener('pointermove', onNavigationPointerMove);
    window.removeEventListener('pointerup', onNavigationPointerUp);
    window.removeEventListener('pointercancel', onNavigationPointerCancel);
    window.removeEventListener('resize', scheduleNavigationMeasure);
    navigationResizeObserver?.disconnect();
    navigationResizeObserver = null;
    window.cancelAnimationFrame(navigationResizeFrame);
    window.clearTimeout(navigationReleaseTimer);
    navigationResizeFrame = 0;
    navigationReleaseTimer = 0;
    navigationGeometry = null;
    navigationGesture = null;
    navigationElement = null;
}

function setActiveNavigation(page) {
    document.querySelectorAll('#furry-bottom-nav [data-shell-page]').forEach(button => {
        const selected = button.dataset.shellPage === page;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    if (!navigationGesture?.dragging) {
        syncNavigationIndicator({ animate: true });
    }
}

function closeNativePanels(except = null) {
    for (const [name, config] of Object.entries(NATIVE_PANELS)) {
        const panel = document.querySelector(config.panel);
        if (name !== except && panel?.classList.contains('openDrawer')) {
            markPanelExiting(panel);
            $(config.toggle).trigger('click');
        }
    }
}

function closeOtherOpenDrawers(exceptPanel = null) {
    document.querySelectorAll('.drawer-content.openDrawer:not(.pinnedOpen)').forEach(panel => {
        if (panel === exceptPanel) {
            return;
        }
        if (panel.id !== 'horae_drawer_content') {
            markPanelExiting(panel);
        }
        const toggle = panel.parentElement?.querySelector(':scope > .drawer-toggle');
        if (toggle instanceof HTMLElement) {
            toggle.click();
        }
    });
}

function clearPanelExitState(panel) {
    const observer = panelExitObservers.get(panel);
    observer?.disconnect();
    panelExitObservers.delete(panel);
    panel?.classList.remove('furry-panel-exiting');
}

function markPanelExiting(panel) {
    if (!(panel instanceof HTMLElement) || panel.id === 'horae_drawer_content') {
        return;
    }
    clearPanelExitState(panel);
    panel.classList.add('furry-panel-exiting');
    const observer = new MutationObserver(() => {
        if (!panel.isConnected || !panel.classList.contains('openDrawer')) {
            clearPanelExitState(panel);
        }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    panelExitObservers.set(panel, observer);
}

function clearAllPanelExitStates() {
    for (const panel of panelExitObservers.keys()) {
        clearPanelExitState(panel);
    }
}

function cancelPendingPanelReveal() {
    const cleanup = panelRevealCleanup;
    panelRevealCleanup = null;
    cleanup?.();
    document.body.classList.remove('furry-shell-panel-pending', 'furry-shell-panel-switching');
}

function revealNativePanelWhenReady(panel, name, revealToken, onReady = null) {
    if (!(panel instanceof HTMLElement)) {
        navigateBack();
        toastr.error('页面打开失败，请稍后重试。');
        return;
    }

    let frame = 0;
    let timeout = 0;
    let observer = null;
    const cleanup = () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
        observer?.disconnect();
        document.body.classList.remove('furry-shell-panel-pending', 'furry-shell-panel-switching');
        if (panelRevealCleanup === cleanup) {
            panelRevealCleanup = null;
        }
    };
    const reveal = () => {
        if (revealToken !== panelRevealToken || activeMode !== 'panel') {
            cleanup();
            return;
        }
        if (!panel.classList.contains('openDrawer')) {
            return;
        }

        cleanup();
        document.body.classList.remove('furry-shell-home', 'furry-shell-chat');
        document.body.classList.add('furry-shell-panel');
        panel.classList.add('furry-liquid-panel-enter');
        window.setTimeout(() => panel.classList.remove('furry-liquid-panel-enter'), 220);
        observeActivePanel(panel, name);
        syncHoraeButton();
        onReady?.();
    };

    observer = new MutationObserver(reveal);
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    frame = window.requestAnimationFrame(reveal);
    timeout = window.setTimeout(() => {
        if (panel.classList.contains('openDrawer')) {
            reveal();
            return;
        }
        cleanup();
        if (revealToken === panelRevealToken && activeMode === 'panel') {
            navigateBack();
            toastr.error('页面打开失败，请稍后重试。');
        }
    }, 1800);
    panelRevealCleanup = cleanup;
}

function showNativePanel(name, navigationPage = name, onReady = null, { history = 'push', root = false } = {}) {
    cancelPendingPanelReveal();
    stopActivePanelObserver();
    if (document.body.classList.contains('furry-shell-panel')) {
        document.body.classList.add('furry-shell-panel-switching');
    }
    setCurrentView({ mode: 'panel', name, navigationPage, root }, history);
    activeMode = 'panel';
    const revealToken = ++panelRevealToken;
    setActiveNavigation(navigationPage);
    const panel = openNativePanel(name, { root });
    revealNativePanelWhenReady(panel, name, revealToken, onReady);
}

function openNativePanel(name, { root = false } = {}) {
    const config = NATIVE_PANELS[name];
    if (!config) {
        return null;
    }
    if (name === 'api') {
        const mainApiControl = document.getElementById('main_api');
        if (mainApiControl instanceof HTMLSelectElement && mainApiControl.value !== 'openai') {
            mainApiControl.value = 'openai';
            mainApiControl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    closeNativePanels(name);
    const panel = document.querySelector(config.panel);
    clearPanelExitState(panel);
    panel?.classList.toggle('furry-root-panel', root);
    closeOtherOpenDrawers(panel);
    if (!panel?.classList.contains('openDrawer')) {
        $(config.toggle).trigger('click');
    }
    return panel;
}

function openCreateCharacter() {
    showNativePanel('characters', 'mine', () => $('#rm_button_create').trigger('click'));
}

function toggleSearch() {
    const row = document.getElementById('furry-search-row');
    row.hidden = !row.hidden;
    if (!row.hidden) {
        document.getElementById('furry-character-search').focus();
    }
}

function clearSearch() {
    const input = document.getElementById('furry-character-search');
    input.value = '';
    searchQuery = '';
    renderMessages();
}

function onSearchInput(event) {
    searchQuery = String(event.target.value || '').trim();
    scheduleRender();
}

function onMessageFilterClick(event) {
    const button = event.target.closest('[data-message-filter]');
    if (!button) {
        return;
    }
    messageFilter = button.dataset.messageFilter;
    document.querySelectorAll('[data-message-filter]').forEach(item => {
        item.classList.toggle('is-active', item === button);
    });
    renderMessages();
}

function onMineActionClick(event) {
    const button = event.target.closest('[data-native-action]');
    if (!button) {
        return;
    }
    switch (button.dataset.nativeAction) {
        case 'account':
            $('#account_button').trigger('click');
            break;
        case 'login':
            window.location.assign('/login?noauto=true');
            break;
        case 'register':
            window.location.assign('/login?noauto=true&view=register');
            break;
        case 'persona':
        case 'api':
        case 'user':
        case 'advanced':
        case 'characters':
            showNativePanel(button.dataset.nativeAction, 'mine');
            break;
        case 'create-character':
            openCreateCharacter();
            break;
        case 'drafts':
            toastr.info('草稿箱会在多会话任务层中接入。');
            break;
    }
}

function onChatChanged() {
    syncChatHeader();
    if (activeMode === 'chat') {
        markCurrentStorylineRead();
    }
    scheduleRender();
}

function onGenerationStarted(_type, _params, isDryRun) {
    if (isDryRun) {
        return;
    }
    const character = characters[this_chid];
    if (!character) {
        return;
    }
    const storylineId = String(getCurrentChatId() || '').replace(/\.jsonl$/i, '');
    const characterId = getCharacterId(character);
    activeGeneration = {
        characterIndex: Number(this_chid),
        characterId,
        storylineId,
    };
    getStorylineState(characterId, storylineId).status = 'generating';
    scheduleRender();
    persistStoryline(characterId, storylineId, { status: 'generating', error: null });
}

function onGenerationEnded() {
    finishGeneration('completed', true);
}

function onGenerationStopped() {
    finishGeneration('stopped', false);
}

function finishGeneration(status, markUnread) {
    if (!activeGeneration) {
        return;
    }
    const finished = activeGeneration;
    activeGeneration = null;
    const storylineState = getStorylineState(finished.characterId, finished.storylineId);
    storylineState.status = status;
    if (markUnread && activeMode !== 'chat') {
        storylineState.unreadCount = Math.max(1, Number(storylineState.unreadCount) || 0);
    }
    storylineCache.delete(finished.characterId);
    scheduleRender();
    persistStoryline(finished.characterId, finished.storylineId, {
        status,
        unreadCount: storylineState.unreadCount,
    });
}

function onMessageReceived() {
    const character = characters[this_chid];
    if (!character) {
        return;
    }
    const characterId = getCharacterId(character);
    const storylineId = String(getCurrentChatId() || '').replace(/\.jsonl$/i, '');
    const storylineState = getStorylineState(characterId, storylineId);
    if (activeMode === 'chat') {
        storylineState.unreadCount = 0;
        storylineState.lastReadMessage = currentChatMessages.length - 1;
    } else {
        storylineState.unreadCount = Math.max(1, Number(storylineState.unreadCount) || 0);
    }
    storylineCache.delete(characterId);
    scheduleRender();
    persistStoryline(characterId, storylineId, {
        lastReadMessage: storylineState.lastReadMessage,
        unreadCount: storylineState.unreadCount,
    });
}

function syncChatHeader() {
    const character = characters[this_chid];
    const avatar = document.getElementById('furry-chat-avatar');
    const name = document.getElementById('furry-chat-name');
    const storyline = document.getElementById('furry-chat-storyline');
    const model = document.getElementById('furry-model-name');
    if (character) {
        const characterId = getCharacterId(character);
        const storylineId = String(getCurrentChatId() || '').replace(/\.jsonl$/i, '');
        avatar.src = getCharacterAvatar(character);
        avatar.alt = character.name || '角色头像';
        name.textContent = character.name || '角色聊天';
        storyline.textContent = getStorylineDisplayName(characterId, storylineId, character.name);
    } else {
        avatar.src = 'img/ai4.png';
        avatar.alt = '';
        name.textContent = '角色聊天';
        storyline.textContent = '尚未选择故事线';
    }
    model.textContent = getCurrentModelName();
    syncHoraeButton();
}

function getActiveModelControl() {
    let subtype = 'default';
    if (main_api === 'openai') {
        subtype = document.getElementById('chat_completion_source')?.value || 'openai';
    } else if (main_api === 'textgenerationwebui') {
        subtype = document.getElementById('textgen_type')?.value || 'generic';
    }
    const controlId = MODEL_CONTROLS[main_api]?.[subtype] || MODEL_CONTROLS[main_api]?.default;
    return controlId ? document.getElementById(controlId) : null;
}

function getCurrentModelName() {
    const control = getActiveModelControl();
    if (control instanceof HTMLSelectElement) {
        const selected = Array.from(control.selectedOptions).find(option => option.value);
        return selected?.textContent?.trim() || API_LABELS[main_api] || '选择模型';
    }
    if (control instanceof HTMLInputElement) {
        return control.value.trim() || API_LABELS[main_api] || '选择模型';
    }
    return API_LABELS[main_api] || 'API 设置';
}

function getConnectionProfileControl() {
    const control = document.getElementById('connection_profiles');
    return control instanceof HTMLSelectElement ? control : null;
}

function getActivePresetControl() {
    const controlId = PRESET_CONTROLS[main_api];
    const control = controlId ? document.getElementById(controlId) : null;
    return control instanceof HTMLSelectElement ? control : null;
}

function getSelectedOptionLabel(control) {
    if (!(control instanceof HTMLSelectElement)) {
        return '';
    }
    return control.selectedOptions[0]?.textContent?.trim() || '';
}

function getCurrentApiSourceName() {
    if (main_api === 'openai') {
        return getSelectedOptionLabel(document.getElementById('chat_completion_source')) || API_LABELS.openai;
    }
    if (main_api === 'textgenerationwebui') {
        return getSelectedOptionLabel(document.getElementById('textgen_type')) || API_LABELS.textgenerationwebui;
    }
    return API_LABELS[main_api] || '当前接口';
}

function getCurrentSecretSelection() {
    const key = resolveSecretKey();
    const secrets = key && Array.isArray(secret_state[key]) ? secret_state[key] : [];
    return { key, secrets };
}

function formatSecretLabel(secret, index) {
    const label = String(secret?.label || '').trim() || `Key ${index + 1}`;
    const maskedValue = String(secret?.value || '').trim();
    return maskedValue ? `${label} · ${maskedValue}` : label;
}

function getCurrentSecretSummary() {
    const { secrets } = getCurrentSecretSelection();
    const activeSecret = secrets.find(secret => secret.active);
    if (activeSecret) {
        return String(activeSecret.label || activeSecret.value || '已选择 Key');
    }
    return secrets.length ? '选择已保存的 Key' : '暂无可切换的 Key';
}

function getCurrentPresetName() {
    const control = getActivePresetControl();
    return getSelectedOptionLabel(control) || '暂无可切换的预设';
}

function addSwitchOnlyBadge(field) {
    const badge = document.createElement('span');
    badge.className = 'furry-switch-only-badge';
    badge.textContent = '仅切换';
    field.querySelector('label')?.append(badge);
}

function createQuickSwitchAction(icon, title, summary, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'furry-wide-action';
    button.innerHTML = '<i class="fa-solid"></i><span><strong></strong><small></small></span><i class="fa-solid fa-chevron-right"></i>';
    button.querySelector('i').classList.add(icon);
    button.querySelector('strong').textContent = title;
    button.querySelector('small').textContent = summary;
    button.addEventListener('click', onClick);
    return button;
}

function openApiKeyQuickSheet() {
    pushSheet('API Key 快捷切换', renderApiKeyQuickSheet);
}

function renderApiKeyQuickSheet(content) {
    const field = createSheetField(getCurrentApiSourceName());
    addSwitchOnlyBadge(field);
    const { key, secrets } = getCurrentSecretSelection();
    if (!key || secrets.length === 0) {
        const unavailable = document.createElement('div');
        unavailable.className = 'furry-sheet-note';
        unavailable.textContent = '当前接口暂无可用的 API Key。';
        field.append(unavailable);
        content.append(field);
        return;
    }

    const select = document.createElement('select');
    for (const [index, secret] of secrets.entries()) {
        select.add(new Option(formatSecretLabel(secret, index), secret.id, false, secret.active));
    }
    select.value = secrets.find(secret => secret.active)?.id || secrets[0].id;
    select.disabled = secrets.length < 2;
    select.addEventListener('change', async function () {
        const selectedId = this.value;
        const previousId = secrets.find(secret => secret.active)?.id || '';
        this.disabled = true;
        this.setAttribute('aria-busy', 'true');
        await rotateSecret(key, selectedId);
        this.removeAttribute('aria-busy');
        const rotated = Array.isArray(secret_state[key])
            && secret_state[key].some(secret => secret.id === selectedId && secret.active);
        this.value = rotated ? selectedId : previousId;
        this.disabled = secrets.length < 2;
        syncChatHeader();
    });
    field.append(select);
    content.append(field);
}

function openPresetQuickSheet() {
    pushSheet('预设快捷切换', renderPresetQuickSheet);
}

function renderPresetQuickSheet(content) {
    const field = createSheetField(getCurrentApiSourceName());
    addSwitchOnlyBadge(field);
    const presetControl = getActivePresetControl();
    if (!presetControl || presetControl.options.length === 0) {
        const unavailable = document.createElement('div');
        unavailable.className = 'furry-sheet-note';
        unavailable.textContent = '当前接口暂无可切换的预设。';
        field.append(unavailable);
        content.append(field);
        return;
    }

    const select = document.createElement('select');
    for (const option of Array.from(presetControl.options)) {
        const shellOption = new Option(option.textContent, option.value, false, option.selected);
        shellOption.disabled = option.disabled;
        select.add(shellOption);
    }
    select.value = presetControl.value;
    select.disabled = select.options.length < 2;
    select.addEventListener('change', function () {
        presetControl.value = this.value;
        presetControl.dispatchEvent(new Event('change', { bubbles: true }));
        this.value = presetControl.value;
        syncChatHeader();
    });
    field.append(select);
    content.append(field);
}

function getCurrentStorylineContext() {
    const character = characters[this_chid];
    const storylineId = normalizeStorylineId(getCurrentChatId());
    if (!character || !storylineId) {
        return null;
    }

    return {
        characterId: getCharacterId(character),
        storylineId,
    };
}

function persistCurrentStorylineProfile(profileId) {
    const context = getCurrentStorylineContext();
    if (!context) {
        return;
    }

    const modelProfileId = profileId || null;
    getStorylineState(context.characterId, context.storylineId).modelProfileId = modelProfileId;
    persistStoryline(context.characterId, context.storylineId, { modelProfileId });
}

async function applyStorylineConnectionProfile(characterId, storylineId) {
    const normalizedStorylineId = normalizeStorylineId(storylineId);
    if (!normalizedStorylineId) {
        return;
    }

    const profileId = getStorylineState(characterId, normalizedStorylineId).modelProfileId;
    const control = getConnectionProfileControl();
    if (!profileId || !control || control.value === profileId) {
        return;
    }
    if (!Array.from(control.options).some(option => option.value === profileId)) {
        return;
    }

    await new Promise(resolve => {
        let timer;
        const finish = () => {
            window.clearTimeout(timer);
            eventSource.removeListener(event_types.CONNECTION_PROFILE_LOADED, finish);
            resolve();
        };
        eventSource.on(event_types.CONNECTION_PROFILE_LOADED, finish);
        timer = window.setTimeout(finish, 2500);
        control.value = profileId;
        control.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function openModelSheet() {
    openRootSheet('模型与生成参数', renderModelSheet);
}

function renderModelSheet(content) {
    const profileControl = getConnectionProfileControl();
    if (profileControl) {
        const profileField = createSheetField('故事线连接配置');
        const profileSelect = document.createElement('select');
        for (const option of Array.from(profileControl.options)) {
            const shellOption = new Option(option.textContent, option.value, false, option.selected);
            shellOption.disabled = option.disabled;
            profileSelect.add(shellOption);
        }
        const context = getCurrentStorylineContext();
        const configuredProfile = context
            ? getStorylineState(context.characterId, context.storylineId).modelProfileId
            : null;
        if (configuredProfile && Array.from(profileSelect.options).some(option => option.value === configuredProfile)) {
            profileSelect.value = configuredProfile;
        }
        profileSelect.addEventListener('change', function () {
            profileControl.value = this.value;
            profileControl.dispatchEvent(new Event('change', { bubbles: true }));
            persistCurrentStorylineProfile(this.value);
        });
        profileField.append(profileSelect);
        content.append(profileField);
    }
    const modelControl = getActiveModelControl();
    const modelField = createSheetField('当前模型');
    if (modelControl instanceof HTMLSelectElement) {
        const select = document.createElement('select');
        for (const option of Array.from(modelControl.options)) {
            if (!option.value) {
                continue;
            }
            const shellOption = new Option(option.textContent, option.value, false, option.selected);
            shellOption.disabled = option.disabled;
            select.add(shellOption);
        }
        select.value = modelControl.value;
        select.addEventListener('change', function () {
            modelControl.value = this.value;
            modelControl.dispatchEvent(new Event('change', { bubbles: true }));
            syncChatHeader();
        });
        modelField.append(select);
    } else if (modelControl instanceof HTMLInputElement) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = modelControl.value;
        input.placeholder = '输入模型名称';
        input.addEventListener('change', function () {
            modelControl.value = this.value;
            modelControl.dispatchEvent(new Event('input', { bubbles: true }));
            modelControl.dispatchEvent(new Event('change', { bubbles: true }));
            syncChatHeader();
        });
        modelField.append(input);
    } else {
        const unavailable = document.createElement('div');
        unavailable.className = 'furry-sheet-note';
        unavailable.textContent = '当前 API 没有可直接选择的模型控件。';
        modelField.append(unavailable);
    }
    content.append(modelField);

    const temperatureControl = document.getElementById(TEMPERATURE_CONTROLS[main_api]);
    if (temperatureControl instanceof HTMLInputElement) {
        const field = createSheetField('热度值');
        const value = document.createElement('output');
        value.textContent = temperatureControl.value;
        field.querySelector('label').append(value);
        const range = document.createElement('input');
        range.type = 'range';
        range.min = temperatureControl.min;
        range.max = temperatureControl.max;
        range.step = temperatureControl.step;
        range.value = temperatureControl.value;
        range.addEventListener('input', function () {
            value.textContent = this.value;
            temperatureControl.value = this.value;
            temperatureControl.dispatchEvent(new Event('input', { bubbles: true }));
        });
        range.addEventListener('change', function () {
            temperatureControl.dispatchEvent(new Event('change', { bubbles: true }));
        });
        field.append(range);
        content.append(field);
    }

    const quickSwitches = document.createElement('div');
    quickSwitches.className = 'furry-quick-switch-list';
    quickSwitches.append(
        createQuickSwitchAction('fa-key', 'API Key 快捷切换', getCurrentSecretSummary(), openApiKeyQuickSheet),
        createQuickSwitchAction('fa-sliders', '预设快捷切换', getCurrentPresetName(), openPresetQuickSheet),
    );
    content.append(quickSwitches);
}

function createSheetField(labelText) {
    const field = document.createElement('div');
    field.className = 'furry-sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    field.append(label);
    return field;
}

function openChatMenuSheet() {
    openRootSheet('当前角色卡', renderChatMenuSheet);
}

function renderChatMenuSheet(content) {
    const actions = [
        ['fa-id-card', '编辑角色卡', '角色描述、开场白与高级定义', openCurrentCharacterEditor],
        ['fa-pen-to-square', '编辑故事线', '单独覆盖情景、示例消息与系统提示词', openStorylineOverrides],
        ['fa-code-branch', '管理故事线', '切换、重命名与管理聊天文件', () => triggerChatOption('#option_select_chat')],
        ['fa-comment-medical', '新建故事线', '基于当前角色创建新聊天', () => triggerChatOption('#option_start_new_chat')],
        ['fa-passport', '故事线世界书', '为当前故事线单独选择世界书', openStorylineLorebook],
        ['fa-book-atlas', '角色卡世界书', '查看或修改整张角色卡绑定的世界书', () => openCharacterTool('#world_button')],
        ['fa-face-smile', '角色 User 设定', '直接选择或编辑当前聊天 Persona', openCharacterPersona],
    ];
    for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'furry-wide-action';
        button.innerHTML = '<i class="fa-solid ' + action[0] + '"></i><span><strong></strong><small></small></span><i class="fa-solid fa-chevron-right"></i>';
        button.querySelector('strong').textContent = action[1];
        button.querySelector('small').textContent = action[2];
        button.addEventListener('click', action[3]);
        content.append(button);
    }
}

function openRootSheet(title, render) {
    sheetStack.length = 0;
    sheetRestoreFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    pushSheet(title, render);
}

function pushSheet(title, render) {
    if (typeof render !== 'function') {
        return;
    }
    if (!sheetStack.length && !sheetRestoreFocus) {
        sheetRestoreFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    }
    sheetStack.push({ title, render });
    renderSheetFrame('forward');
}

function renderSheetFrame(direction) {
    const frame = sheetStack.at(-1);
    if (!frame) {
        closeSheet();
        return;
    }
    const backdrop = document.getElementById('furry-sheet-backdrop');
    const content = document.getElementById('furry-sheet-content');
    const backButton = document.getElementById('furry-sheet-back');
    document.getElementById('furry-sheet-title').textContent = frame.title;
    backButton.title = sheetStack.length > 1 ? '返回上一级' : '返回聊天';
    backButton.setAttribute('aria-label', backButton.title);
    content.replaceChildren();
    frame.render(content);
    content.classList.remove('is-sheet-forward', 'is-sheet-back');
    void content.offsetWidth;
    content.classList.add(direction === 'back' ? 'is-sheet-back' : 'is-sheet-forward');
    backdrop.hidden = false;
    requestAnimationFrame(() => {
        backdrop.classList.add('is-open');
        backButton.focus({ preventScroll: true });
    });
}

function backSheet() {
    if (!sheetStack.length) {
        return;
    }
    if (sheetStack.length === 1) {
        closeSheet();
        return;
    }
    sheetStack.pop();
    renderSheetFrame('back');
}

function closeSheet({ restoreFocus = true } = {}) {
    const backdrop = document.getElementById('furry-sheet-backdrop');
    if (!backdrop || backdrop.hidden) {
        sheetStack.length = 0;
        if (!restoreFocus) {
            sheetRestoreFocus = null;
        }
        return;
    }
    sheetStack.length = 0;
    backdrop.classList.remove('is-open');
    const focusTarget = restoreFocus ? sheetRestoreFocus : null;
    sheetRestoreFocus = null;
    window.setTimeout(() => {
        if (!backdrop.classList.contains('is-open')) {
            backdrop.hidden = true;
            if (focusTarget?.isConnected) {
                focusTarget.focus({ preventScroll: true });
            }
        }
    }, 160);
}

function openCurrentCharacterEditor(onReady = null) {
    closeSheet({ restoreFocus: false });
    showNativePanel('characters', 'messages', () => {
        $('#rm_button_selected_ch').trigger('click');
        onReady?.();
    });
}

function openStorylineOverrides() {
    closeSheet({ restoreFocus: false });
    setCharacterSettingsOverrides();
}

function openStorylineLorebook() {
    closeSheet({ restoreFocus: false });
    assignLorebookToChat({ shiftKey: true, altKey: false });
}

function openCharacterTool(selector) {
    openCurrentCharacterEditor(() => window.setTimeout(() => $(selector).trigger('click'), 80));
}

function openCharacterPersona() {
    closeSheet({ restoreFocus: false });
    showNativePanel('persona', 'messages');
}

function triggerChatOption(selector) {
    closeSheet({ restoreFocus: false });
    $(selector).trigger('click');
}

function renderMineSummary() {
    const name = currentUser?.name || currentUser?.handle || '本地用户';
    const handle = accountsEnabled
        ? '@' + (currentUser?.handle || 'user') + ' · 独立数据空间'
        : '本地模式 · 独立数据空间';
    const storylines = Object.values(workspace.characters).reduce((total, character) => {
        return total + Object.keys(character.storylines || {}).length;
    }, 0);
    const unread = getTotalUnreadCount();
    document.getElementById('furry-profile-name').textContent = name;
    document.getElementById('furry-profile-handle').textContent = handle;
    document.getElementById('furry-character-count').textContent = String(characters.length);
    document.getElementById('furry-storyline-count').textContent = String(storylines);
    document.getElementById('furry-unread-count').textContent = String(unread);
}

function updateGlobalCounters() {
    const unread = getTotalUnreadCount();
    const badge = document.getElementById('furry-nav-unread');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
}

function getTotalUnreadCount() {
    return Object.values(workspace.characters).reduce((characterTotal, character) => {
        return characterTotal + Object.values(character.storylines || {}).reduce((storylineTotal, storyline) => {
            return storylineTotal + Math.max(0, Number(storyline.unreadCount) || 0);
        }, 0);
    }, 0);
}

function getStorylineDisplayName(characterId, storylineId, characterName) {
    if (!storylineId) {
        return '主故事线';
    }
    return getStorylineState(characterId, storylineId).displayName
        || formatStorylineName(storylineId, characterName);
}

function formatStorylineName(storylineId, characterName) {
    let name = String(storylineId || '').replace(/\.jsonl$/i, '').trim();
    const prefix = String(characterName || '').trim();
    if (prefix && name.toLocaleLowerCase('zh-CN').startsWith(prefix.toLocaleLowerCase('zh-CN'))) {
        name = name.slice(prefix.length).replace(/^\s*[-_—]\s*/, '');
    }
    return name || '主故事线';
}

function getCharacterAvatar(character) {
    if (!character?.avatar || character.avatar === 'none') {
        return 'img/ai4.png';
    }
    return getThumbnailUrl('avatar', character.avatar);
}

function getPlainText(value) {
    if (!value) {
        return '';
    }
    const parser = new DOMParser();
    const documentValue = parser.parseFromString('<div>' + String(value) + '</div>', 'text/html');
    return String(documentValue.body.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatRelativeTime(value) {
    if (!value) {
        return '';
    }
    const rawDate = typeof value === 'number' ? value : Date.parse(value);
    const timestamp = Number.isFinite(rawDate) ? rawDate : Number(value);
    if (!Number.isFinite(timestamp)) {
        return '';
    }
    const difference = Date.now() - timestamp;
    if (difference < 60 * 1000) return '刚刚';
    if (difference < 60 * 60 * 1000) return Math.floor(difference / 60000) + ' 分钟前';
    if (difference < 24 * 60 * 60 * 1000) return Math.floor(difference / 3600000) + ' 小时前';
    if (difference < 7 * 24 * 60 * 60 * 1000) return Math.floor(difference / 86400000) + ' 天前';
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(timestamp));
}

async function initFurryShell() {
    if (initialized) {
        return;
    }
    initialized = true;
    createShell();
    bindShellEvents();
    subscribeToSillyTavernEvents();

    workspace = loadLocalWorkspace();
    markInterruptedGenerations({ persist: false });
    renderMessages();
    syncChatHeader();
    dismissBootstrap();

    await loadWorkspace();
    markInterruptedGenerations();
    renderMessages();
    syncChatHeader();
    if (isGenerating() && characters[this_chid]) {
        onGenerationStarted();
    }
}

eventSource.on(event_types.APP_READY, initFurryShell);
