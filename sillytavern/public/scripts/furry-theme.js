(function initializeFurryTheme() {
    'use strict';

    if (window.FurryTheme) {
        return;
    }

    const STORAGE_KEY = 'furry-ui-theme';
    const CHANGE_EVENT = 'furry-theme-change';
    const READY_EVENT = 'furry-theme-ready';
    const SYSTEM_PREFERENCE = 'system';
    const VALID_MODES = new Set(['dark', 'light']);
    const VALID_PREFERENCES = new Set([SYSTEM_PREFERENCE, ...VALID_MODES]);
    const THEME_COLORS = Object.freeze({
        dark: '#17191d',
        light: '#eef1f4',
    });
    const NATIVE_THEME_TOKENS = Object.freeze({
        dark: Object.freeze({
            '--SmartThemeBodyColor': '#f1f4f7',
            '--SmartThemeEmColor': '#b5bdc6',
            '--SmartThemeUnderlineColor': '#68d5a6',
            '--SmartThemeQuoteColor': '#73dbe5',
            '--SmartThemeBlurTintColor': 'rgb(29 34 40 / 92%)',
            '--SmartThemeChatTintColor': 'rgb(23 26 30 / 94%)',
            '--SmartThemeUserMesBlurTintColor': 'rgb(33 59 66 / 88%)',
            '--SmartThemeBotMesBlurTintColor': 'rgb(31 36 42 / 88%)',
            '--SmartThemeShadowColor': 'rgb(4 8 12 / 32%)',
            '--SmartThemeBorderColor': 'rgb(224 235 244 / 17%)',
            '--SmartThemeCheckboxBgColorR': '241',
            '--SmartThemeCheckboxBgColorG': '244',
            '--SmartThemeCheckboxBgColorB': '247',
        }),
        light: Object.freeze({
            '--SmartThemeBodyColor': '#222a31',
            '--SmartThemeEmColor': '#5f6b76',
            '--SmartThemeUnderlineColor': '#2f865f',
            '--SmartThemeQuoteColor': '#167f8c',
            '--SmartThemeBlurTintColor': 'rgb(244 247 249 / 92%)',
            '--SmartThemeChatTintColor': 'rgb(238 241 244 / 94%)',
            '--SmartThemeUserMesBlurTintColor': 'rgb(218 239 242 / 91%)',
            '--SmartThemeBotMesBlurTintColor': 'rgb(250 251 252 / 91%)',
            '--SmartThemeShadowColor': 'rgb(48 61 73 / 16%)',
            '--SmartThemeBorderColor': 'rgb(39 55 68 / 18%)',
            '--SmartThemeCheckboxBgColorR': '34',
            '--SmartThemeCheckboxBgColorG': '42',
            '--SmartThemeCheckboxBgColorB': '49',
        }),
    });
    const root = document.documentElement;
    const systemTheme = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    let preference = readStoredPreference();
    let mode = resolveMode(preference);
    let nativeThemeObserver = null;

    function readStoredPreference() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return VALID_MODES.has(stored) ? stored : SYSTEM_PREFERENCE;
        } catch {
            return SYSTEM_PREFERENCE;
        }
    }

    function resolveMode(value) {
        if (VALID_MODES.has(value)) {
            return value;
        }

        return systemTheme?.matches ? 'dark' : 'light';
    }

    function updateThemeColor(nextMode) {
        const themeColor = document.querySelector('meta[name="theme-color"]');

        if (themeColor) {
            themeColor.setAttribute('content', THEME_COLORS[nextMode]);
        }
    }

    function syncNativeThemeTokens(nextMode) {
        const tokens = NATIVE_THEME_TOKENS[nextMode];
        if (!tokens) {
            return;
        }

        for (const [name, value] of Object.entries(tokens)) {
            if (root.style.getPropertyValue(name).trim() !== value) {
                root.style.setProperty(name, value);
            }
        }
    }

    function observeNativeThemeTokens() {
        if (nativeThemeObserver || typeof MutationObserver !== 'function') {
            return;
        }

        nativeThemeObserver = new MutationObserver(() => syncNativeThemeTokens(mode));
        nativeThemeObserver.observe(root, { attributes: true, attributeFilter: ['style'] });
    }

    function snapshot(source = 'api', previousMode = mode) {
        return Object.freeze({
            mode,
            preference,
            previousMode,
            source,
            isSystem: preference === SYSTEM_PREFERENCE,
        });
    }

    function applyTheme(nextMode, source, emit = true, previousPreference = preference) {
        if (!VALID_MODES.has(nextMode)) {
            return snapshot(source);
        }

        const previousMode = mode;
        const changed = previousMode !== nextMode || previousPreference !== preference;
        mode = nextMode;
        root.dataset.furryTheme = mode;
        root.dataset.furryThemePreference = preference;
        root.style.colorScheme = mode;
        syncNativeThemeTokens(mode);
        updateThemeColor(mode);

        const detail = snapshot(source, previousMode);

        if (emit && changed) {
            window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
        }

        return detail;
    }

    function persistPreference(value) {
        try {
            if (value === SYSTEM_PREFERENCE) {
                window.localStorage.removeItem(STORAGE_KEY);
            } else {
                window.localStorage.setItem(STORAGE_KEY, value);
            }
        } catch {
            // The active page still follows the requested mode when storage is unavailable.
        }
    }

    function setPreference(value, source = 'user') {
        if (!VALID_PREFERENCES.has(value)) {
            throw new TypeError(`Unsupported theme preference: ${String(value)}`);
        }

        const previousPreference = preference;
        preference = value;
        persistPreference(value);
        return applyTheme(resolveMode(value), source, true, previousPreference);
    }

    function setMode(value, source = 'user') {
        if (!VALID_MODES.has(value)) {
            throw new TypeError(`Unsupported theme mode: ${String(value)}`);
        }

        return setPreference(value, source);
    }

    function toggle(source = 'user') {
        return setMode(mode === 'dark' ? 'light' : 'dark', source);
    }

    function subscribe(listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new TypeError('Theme subscriber must be a function.');
        }

        const handler = (event) => listener(event.detail);
        window.addEventListener(CHANGE_EVENT, handler);

        if (options.immediate !== false) {
            listener(snapshot('subscribe'));
        }

        return () => window.removeEventListener(CHANGE_EVENT, handler);
    }

    function handleSystemThemeChange() {
        if (preference === SYSTEM_PREFERENCE) {
            applyTheme(resolveMode(preference), 'system');
        }
    }

    function handleStorageChange(event) {
        if (event.key !== STORAGE_KEY) {
            return;
        }

        const previousPreference = preference;
        preference = VALID_MODES.has(event.newValue) ? event.newValue : SYSTEM_PREFERENCE;
        applyTheme(resolveMode(preference), 'storage', true, previousPreference);
    }

    function handlePageHide(event) {
        if (event.persisted) {
            return;
        }

        nativeThemeObserver?.disconnect();
        nativeThemeObserver = null;
        if (typeof systemTheme?.removeEventListener === 'function') {
            systemTheme.removeEventListener('change', handleSystemThemeChange);
        } else if (typeof systemTheme?.removeListener === 'function') {
            systemTheme.removeListener(handleSystemThemeChange);
        }
        window.removeEventListener('storage', handleStorageChange);
    }

    const api = Object.freeze({
        version: 1,
        storageKey: STORAGE_KEY,
        eventName: CHANGE_EVENT,
        readyEventName: READY_EVENT,
        modes: Object.freeze(['dark', 'light']),
        preferences: Object.freeze([SYSTEM_PREFERENCE, 'dark', 'light']),
        getMode: () => mode,
        getPreference: () => preference,
        getSnapshot: () => snapshot('api'),
        setMode,
        setPreference,
        useSystem: (source = 'user') => setPreference(SYSTEM_PREFERENCE, source),
        toggle,
        subscribe,
    });

    Object.defineProperty(window, 'FurryTheme', {
        value: api,
        configurable: false,
        enumerable: true,
        writable: false,
    });

    applyTheme(mode, 'bootstrap', false);
    observeNativeThemeTokens();
    if (typeof systemTheme?.addEventListener === 'function') {
        systemTheme.addEventListener('change', handleSystemThemeChange);
    } else if (typeof systemTheme?.addListener === 'function') {
        systemTheme.addListener(handleSystemThemeChange);
    }
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pagehide', handlePageHide, { once: true });

    const dispatchReady = () => {
        window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: snapshot('ready') }));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', dispatchReady, { once: true });
    } else {
        dispatchReady();
    }
})();
