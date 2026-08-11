const PANEL_META = {
    'left-nav-panel': {
        key: 'presets',
        icon: 'fa-sliders',
        title: '预设与生成参数',
        subtitle: '管理预设、上下文与生成设置',
        root: true,
    },
    WorldInfo: {
        key: 'world',
        icon: 'fa-book-atlas',
        title: '世界书',
        subtitle: '管理全局、角色与故事线知识',
        root: true,
    },
    rm_extensions_block: {
        key: 'plugins',
        icon: 'fa-puzzle-piece',
        title: '插件管理',
        subtitle: '配置内置功能与第三方扩展',
        root: true,
    },
    'user-settings-block': {
        key: 'user',
        icon: 'fa-user-gear',
        title: '用户与界面设置',
        subtitle: '调整主题、显示、聊天与交互偏好',
    },
    AdvancedFormatting: {
        key: 'advanced',
        icon: 'fa-font',
        title: '高级格式与上下文',
        subtitle: '管理指令、上下文模板与回复格式',
    },
    Backgrounds: {
        key: 'backgrounds',
        icon: 'fa-panorama',
        title: '背景管理',
        subtitle: '上传、选择并整理聊天背景',
    },
    PersonaManagement: {
        key: 'persona',
        icon: 'fa-face-smile',
        title: 'User 设定',
        subtitle: '管理全局、角色与故事线 Persona',
    },
    rm_api_block: {
        key: 'api',
        icon: 'fa-key',
        title: 'API 与 Key 管理',
        subtitle: '添加、编辑并切换用户自己的连接凭证',
    },
    'right-nav-panel': {
        key: 'characters',
        icon: 'fa-address-book',
        title: '角色与情景',
        subtitle: '创建、编辑并管理角色卡内容',
    },
};

const HIDDEN_CHAT_OPTION_IDS = [
    'option_toggle_AN',
    'option_toggle_CFG',
    'option_toggle_logprobs',
    'option_new_bookmark',
];

const TOOL_GROUPS = [
    {
        key: 'files',
        title: '数据与附件',
        icon: 'fa-folder-open',
        containers: ['data_bank_wand_container', 'attach_file_wand_container', 'gallery_wand_container'],
    },
    {
        key: 'creation',
        title: '创作工具',
        icon: 'fa-wand-magic-sparkles',
        containers: ['sd_wand_container', 'caption_wand_container', 'prompt_inspector_wand_container', 'notebook_wand_container'],
    },
    {
        key: 'media',
        title: '媒体与交流',
        icon: 'fa-headphones',
        containers: ['tts_wand_container', 'screen_share_wand_container', 'translate_wand_container'],
    },
    {
        key: 'utilities',
        title: '实用工具',
        icon: 'fa-toolbox',
        containers: ['emulatorjs_wand_container', 'chess_wand_container', 'token_counter_wand_container', 'dice_wand_container', 'objective_wand_container'],
    },
];

const DISCLOSURE_STORAGE_KEY = 'furry-native-disclosures-v1';
let nativePanelsInitialized = false;
let shellReadyObserver = null;
let bodyUiObserver = null;
let toolMenuReadyObserver = null;
let themeUnsubscribe = null;
const nativePanelObservers = new Set();
const auxiliaryObservers = new Set();
const nativeUiAbortController = new AbortController();
const { signal: nativeUiSignal } = nativeUiAbortController;

function readDisclosureState() {
    try {
        const state = JSON.parse(localStorage.getItem(DISCLOSURE_STORAGE_KEY) || '{}');
        return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    } catch {
        return {};
    }
}

function saveDisclosureState(key, open) {
    try {
        const state = readDisclosureState();
        state[key] = open;
        localStorage.setItem(DISCLOSURE_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable in private or restricted browsing contexts.
    }
}

function stopNativePanelObservers() {
    shellReadyObserver?.disconnect();
    shellReadyObserver = null;
    bodyUiObserver?.disconnect();
    bodyUiObserver = null;
    toolMenuReadyObserver?.disconnect();
    toolMenuReadyObserver = null;
    nativePanelObservers.forEach(observer => observer.disconnect());
    nativePanelObservers.clear();
    auxiliaryObservers.forEach(observer => observer.disconnect());
    auxiliaryObservers.clear();
    themeUnsubscribe?.();
    themeUnsubscribe = null;
    nativeUiAbortController.abort();
}

function returnToPreviousPage() {
    if (document.getElementById('furry-shell')) {
        window.dispatchEvent(new CustomEvent('furry-shell:navigate-back'));
        return;
    }

    document.querySelectorAll('.drawer-content.openDrawer').forEach(panel => {
        const toggle = panel.parentElement?.querySelector(':scope > .drawer-toggle');
        if (toggle instanceof HTMLElement) {
            toggle.click();
        }
    });
}

function createIconButton(className, iconClass, label, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.dataset.furryLiquidPressable = '';
    button.innerHTML = `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>`;
    button.addEventListener('click', onClick, { signal: nativeUiSignal });
    return button;
}

function createPanelHeader(meta) {
    const header = document.createElement('header');
    header.className = `furry-native-panel-header${meta.root ? ' is-root' : ''}`;
    header.dataset.furryGlass = 'elevated';

    if (!meta.root) {
        header.append(createIconButton('furry-native-panel-back', 'fa-chevron-left', '返回上一页', returnToPreviousPage));
    }

    const icon = document.createElement('span');
    icon.className = 'furry-native-panel-icon';
    icon.innerHTML = `<i class="fa-solid ${meta.icon}" aria-hidden="true"></i>`;

    const copy = document.createElement('div');
    copy.className = 'furry-native-panel-copy';
    const title = document.createElement('strong');
    title.textContent = meta.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = meta.subtitle;
    copy.append(title, subtitle);
    header.append(icon, copy);

    if (!meta.root) {
        header.append(createIconButton('furry-native-panel-close', 'fa-xmark', '关闭', returnToPreviousPage));
    }

    return header;
}

function createDisclosure({ key, title, icon, open = false }) {
    const details = document.createElement('details');
    details.className = 'furry-native-disclosure';
    details.dataset.furryDisclosure = key;
    details.dataset.furryGlass = 'surface';

    const storedState = readDisclosureState()[key];
    details.open = typeof storedState === 'boolean' ? storedState : open;

    const summary = document.createElement('summary');
    summary.className = 'furry-native-disclosure-summary';
    summary.innerHTML = [
        `<span class="furry-native-disclosure-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>`,
        `<strong>${title}</strong>`,
        '<i class="fa-solid fa-chevron-down furry-native-disclosure-chevron" aria-hidden="true"></i>',
    ].join('');

    const content = document.createElement('div');
    content.className = 'furry-native-disclosure-content';
    details.append(summary, content);
    details.addEventListener('toggle', () => saveDisclosureState(key, details.open), { signal: nativeUiSignal });
    return { details, content };
}

function appendExistingNodes(target, nodes) {
    nodes.filter(node => node instanceof HTMLElement).forEach(node => target.append(node));
}

function decoratePresetPanel(panel) {
    if (panel.dataset.furryPresetSimplified === 'true') {
        return;
    }

    const configuration = panel.querySelector('#ai_response_configuration');
    const presetBlock = panel.querySelector('#respective-presets-block');
    const commonBlock = panel.querySelector('#common-gen-settings-block');
    const rangeBlock = panel.querySelector('#respective-ranges-and-temps');
    const advancedBlock = panel.querySelector('#advanced-ai-config-block');
    const novelModuleBlock = panel.querySelector('#ai_module_block_novel');
    if (!(configuration instanceof HTMLElement) || !(presetBlock instanceof HTMLElement) || !(commonBlock instanceof HTMLElement)) {
        return;
    }

    panel.dataset.furryPresetSimplified = 'true';
    panel.classList.add('furry-preset-simplified');
    presetBlock.classList.add('furry-preset-common', 'furry-liquid-glass');
    commonBlock.classList.add('furry-preset-common', 'furry-liquid-glass');

    // OpenAI uses a separate range block and hides the generic common block.
    // Keep its three everyday controls in the same visible area without
    // cloning them, so SillyTavern's existing handlers and IDs remain intact.
    const openAiCommonControls = ['#openai_max_context', '#openai_max_tokens', '#stream_toggle']
        .map(selector => panel.querySelector(selector)?.closest('.range-block'))
        .filter((block, index, blocks) => block instanceof HTMLElement && blocks.indexOf(block) === index);
    let openAiCommon = null;
    if (openAiCommonControls.length) {
        openAiCommon = document.createElement('section');
        openAiCommon.id = 'furry-openai-common-settings';
        openAiCommon.className = 'furry-preset-common furry-liquid-glass furry-openai-common-settings';
        openAiCommon.setAttribute('aria-label', '聊天补全常用设置');
        openAiCommonControls.forEach(block => {
            block.classList.add('furry-preset-common-control');
            openAiCommon.append(block);
        });
        commonBlock.after(openAiCommon);

        const syncOpenAiCommonVisibility = () => {
            const active = document.getElementById('main_api')?.value === 'openai';
            openAiCommon.hidden = !active;
            openAiCommon.setAttribute('aria-hidden', String(!active));
        };
        document.addEventListener('change', event => {
            if (event.target instanceof HTMLElement && event.target.id === 'main_api') {
                syncOpenAiCommonVisibility();
            }
        }, { signal: nativeUiSignal });
        syncOpenAiCommonVisibility();
    }

    const advancedGroups = document.createElement('div');
    advancedGroups.className = 'furry-preset-advanced-groups';

    if (rangeBlock instanceof HTMLElement) {
        const sampling = createDisclosure({
            key: 'preset-advanced-sampling',
            title: '高级采样设置',
            icon: 'fa-wave-square',
        });
        sampling.content.append(rangeBlock);
        advancedGroups.append(sampling.details);
    }

    if (advancedBlock instanceof HTMLElement) {
        const compatibility = createDisclosure({
            key: 'preset-prompt-model',
            title: '提示词管理与模型兼容',
            icon: 'fa-diagram-project',
        });
        compatibility.content.append(advancedBlock);
        advancedGroups.append(compatibility.details);
    }

    if (novelModuleBlock instanceof HTMLElement) {
        const other = createDisclosure({
            key: 'preset-other-advanced',
            title: '其他高级选项',
            icon: 'fa-gear',
        });
        other.content.append(novelModuleBlock);
        advancedGroups.append(other.details);
    }

    configuration.append(advancedGroups);
}

function createThemeModeControl() {
    const control = document.createElement('div');
    control.className = 'furry-theme-mode-control';
    control.setAttribute('role', 'radiogroup');
    control.setAttribute('aria-label', '主题模式');

    const modes = [
        { value: 'dark', label: '黑夜模式', icon: 'fa-moon' },
        { value: 'light', label: '白天模式', icon: 'fa-sun' },
    ];

    for (const mode of modes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'furry-theme-mode-button furry-liquid-pressable';
        button.dataset.furryThemeMode = mode.value;
        button.dataset.furryLiquidPressable = '';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.innerHTML = `<i class="fa-solid ${mode.icon}" aria-hidden="true"></i><span>${mode.label}</span>`;
        button.addEventListener('click', () => window.FurryTheme?.setMode?.(mode.value, 'user-settings'), { signal: nativeUiSignal });
        control.append(button);
    }

    return control;
}

function updateThemeModeControl(detail = {}) {
    const activeMode = detail.mode || window.FurryTheme?.getMode?.() || document.documentElement.dataset.furryTheme || 'dark';
    document.querySelectorAll('[data-furry-theme-mode]').forEach(button => {
        const active = button.dataset.furryThemeMode === activeMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', String(active));
    });
}

function connectThemeModeControl() {
    if (themeUnsubscribe || !document.querySelector('[data-furry-theme-mode]')) {
        return;
    }

    if (typeof window.FurryTheme?.subscribe === 'function') {
        themeUnsubscribe = window.FurryTheme.subscribe(updateThemeModeControl, { immediate: true });
    } else {
        updateThemeModeControl();
    }
}

function decorateUserSettingsPanel(panel) {
    if (panel.dataset.furryUserSettingsSimplified === 'true') {
        connectThemeModeControl();
        return;
    }

    const content = panel.querySelector('#user-settings-block-content');
    if (!(content instanceof HTMLElement)) {
        return;
    }

    panel.dataset.furryUserSettingsSimplified = 'true';
    panel.classList.add('furry-user-settings-simplified');

    const originalColumns = Array.from(content.children).filter(node => node instanceof HTMLElement);
    const avatarDisplay = panel.querySelector('[name="AvatarAndChatDisplay"]');
    const characterDisplay = panel.querySelector('[name="CharacterHandlingToggles"]');
    const themeToggles = panel.querySelector('[name="themeToggles"]');
    const chatSettings = panel.querySelector('[name="ChatMessageHandlingToggles"]');
    const miscellaneous = panel.querySelector('[name="MiscellaneousToggles"]');
    const autocomplete = panel.querySelector('[name="AutoCompleteToggle"]');
    const customCss = panel.querySelector('#CustomCSS-block');
    const stscript = panel.querySelector('[name="STscriptToggles"]');

    panel.querySelector('#UI-presets-block')?.classList.add('furry-ordinary-hidden');
    panel.querySelector('#color-picker-block')?.closest('.inline-drawer')?.classList.add('furry-ordinary-hidden');
    panel.querySelector('[name="FontBlurChatWidthBlock"]')?.classList.add('furry-ordinary-hidden');

    const groups = document.createElement('div');
    groups.className = 'furry-settings-groups';

    const theme = createDisclosure({ key: 'settings-theme', title: 'UI 主题', icon: 'fa-circle-half-stroke', open: true });
    theme.content.append(createThemeModeControl());
    groups.append(theme.details);

    const avatar = createDisclosure({ key: 'settings-avatar', title: '头像与角色显示', icon: 'fa-address-card' });
    appendExistingNodes(avatar.content, [avatarDisplay, characterDisplay]);
    groups.append(avatar.details);

    const chat = createDisclosure({ key: 'settings-chat', title: '聊天界面', icon: 'fa-message' });
    appendExistingNodes(chat.content, [chatSettings]);
    groups.append(chat.details);

    const display = createDisclosure({ key: 'settings-message-display', title: '字体与消息显示', icon: 'fa-font' });
    appendExistingNodes(display.content, [themeToggles]);
    groups.append(display.details);

    const interaction = createDisclosure({ key: 'settings-interaction', title: '交互与动画', icon: 'fa-hand-pointer' });
    appendExistingNodes(interaction.content, [miscellaneous, autocomplete]);
    groups.append(interaction.details);

    const other = createDisclosure({ key: 'settings-other', title: '其他界面设置', icon: 'fa-ellipsis' });
    appendExistingNodes(other.content, [customCss, stscript]);
    groups.append(other.details);

    originalColumns.forEach(column => column.classList.add('furry-native-legacy-column'));
    content.prepend(groups);
    connectThemeModeControl();
}

function decoratePanel(panel, meta) {
    panel.dataset.furryNativePanel = meta.key;
    panel.classList.toggle('furry-native-root-panel', Boolean(meta.root));
    if (!panel.querySelector(':scope > .furry-native-panel-header')) {
        panel.prepend(createPanelHeader(meta));
    }

    if (panel.id === 'left-nav-panel') {
        decoratePresetPanel(panel);
    } else if (panel.id === 'user-settings-block') {
        decorateUserSettingsPanel(panel);
    }
}

function createMenuTitle(title, iconClass, closeLabel, closeAction) {
    const titlebar = document.createElement('header');
    titlebar.className = 'furry-chat-menu-titlebar';
    titlebar.dataset.furryGlass = 'elevated';

    const heading = document.createElement('strong');
    heading.innerHTML = `<i class="fa-solid ${iconClass}" aria-hidden="true"></i><span>${title}</span>`;
    const close = createIconButton('furry-chat-menu-close', 'fa-xmark', closeLabel, closeAction);
    titlebar.append(heading, close);
    return titlebar;
}

function insertMenuGroupLabel(container, targetSelector, text) {
    const target = container.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const label = document.createElement('span');
    label.className = 'furry-chat-menu-group-label';
    label.textContent = text;
    target.before(label);
}

function observeMenuVisibility(menu, button) {
    const update = () => {
        const visible = getComputedStyle(menu).display !== 'none';
        button?.classList.toggle('is-active', visible);
        button?.setAttribute('aria-expanded', String(visible));
        menu.setAttribute('aria-hidden', String(!visible));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(menu, { attributes: true, attributeFilter: ['style', 'class'] });
    auxiliaryObservers.add(observer);
}

function decorateOptionsMenu() {
    const menu = document.getElementById('options');
    const content = menu?.querySelector('.options-content');
    const button = document.getElementById('options_button');
    if (!(menu instanceof HTMLElement) || !(content instanceof HTMLElement) || menu.dataset.furryDecorated === 'true') {
        return;
    }

    menu.dataset.furryDecorated = 'true';
    menu.classList.add('furry-chat-actions-menu');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '聊天操作');
    button?.setAttribute('role', 'button');
    button?.setAttribute('aria-label', '聊天操作');
    button?.setAttribute('aria-haspopup', 'dialog');
    if (button instanceof HTMLElement) {
        button.tabIndex = 0;
    }

    HIDDEN_CHAT_OPTION_IDS.forEach(id => document.getElementById(id)?.classList.add('furry-ordinary-hidden'));
    content.prepend(createMenuTitle('聊天操作', 'fa-bars', '关闭聊天操作菜单', () => {
        button?.click();
        button?.focus({ preventScroll: true });
    }));
    insertMenuGroupLabel(content, '#option_convert_to_group', '会话');
    insertMenuGroupLabel(content, '#option_start_new_chat', '聊天记录');
    insertMenuGroupLabel(content, '#option_delete_mes', '消息操作');

    content.querySelectorAll('a').forEach(item => {
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
    });
    observeMenuVisibility(menu, button);
}

function createToolGroup(group) {
    const section = document.createElement('section');
    section.className = 'furry-tool-group';
    section.dataset.furryToolGroup = group.key;

    const heading = document.createElement('h3');
    heading.innerHTML = `<i class="fa-solid ${group.icon}" aria-hidden="true"></i><span>${group.title}</span>`;
    const body = document.createElement('div');
    body.className = 'furry-tool-group-body';
    section.append(heading, body);
    return section;
}

function organizeToolMenu(menu) {
    const groupsHost = menu.querySelector(':scope > .furry-tool-groups');
    if (!(groupsHost instanceof HTMLElement)) {
        return;
    }

    for (const group of TOOL_GROUPS) {
        const section = groupsHost.querySelector(`[data-furry-tool-group="${group.key}"]`);
        const body = section?.querySelector('.furry-tool-group-body');
        if (!(body instanceof HTMLElement)) {
            continue;
        }

        for (const id of group.containers) {
            const container = document.getElementById(id);
            if (container instanceof HTMLElement && container.parentElement !== body) {
                body.append(container);
            }
        }
    }

    const utilities = groupsHost.querySelector('[data-furry-tool-group="utilities"] .furry-tool-group-body');
    if (utilities instanceof HTMLElement) {
        menu.querySelectorAll(':scope > .extension_container').forEach(container => utilities.append(container));
    }

    menu.querySelectorAll('.extension_container > *').forEach(item => {
        if (!(item instanceof HTMLElement)) {
            return;
        }
        item.setAttribute('role', 'button');
        if (!item.hasAttribute('tabindex')) {
            item.tabIndex = 0;
        }
        item.dataset.furryLiquidPressable = '';
    });
}

function decorateToolMenu() {
    const menu = document.getElementById('extensionsMenu');
    const button = document.getElementById('extensionsMenuButton');
    if (!(menu instanceof HTMLElement) || !(button instanceof HTMLElement)) {
        return;
    }

    if (menu.dataset.furryDecorated !== 'true' && !menu.querySelector('.extension_container > *')) {
        if (!toolMenuReadyObserver) {
            toolMenuReadyObserver = new MutationObserver(() => {
                if (!menu.querySelector('.extension_container > *')) {
                    return;
                }
                toolMenuReadyObserver?.disconnect();
                toolMenuReadyObserver = null;
                decorateToolMenu();
            });
            toolMenuReadyObserver.observe(menu, { childList: true, subtree: true });
        }
        return;
    }

    if (menu.dataset.furryDecorated !== 'true') {
        menu.dataset.furryDecorated = 'true';
        menu.classList.add('furry-wand-menu');
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', '魔笔工具');
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', '魔笔工具');
        button.setAttribute('aria-haspopup', 'dialog');
        button.dataset.furryLiquidPressable = '';
        button.tabIndex = 0;

        menu.prepend(createMenuTitle('魔笔工具', 'fa-wand-magic-sparkles', '关闭魔笔工具', () => {
            button.click();
            button.focus({ preventScroll: true });
        }));
        const groupsHost = document.createElement('div');
        groupsHost.className = 'furry-tool-groups';
        TOOL_GROUPS.forEach(group => groupsHost.append(createToolGroup(group)));
        menu.append(groupsHost);
        observeMenuVisibility(menu, button);

        const observer = new MutationObserver(() => organizeToolMenu(menu));
        observer.observe(menu, { childList: true, subtree: true });
        auxiliaryObservers.add(observer);
    }

    organizeToolMenu(menu);
}

function handleAccessibleMenuKeys(event) {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }

    if (event.key === ' ' && !event.repeat && event.target.matches('#options_button, #extensionsMenuButton, #options a, #extensionsMenu .extension_container > *')) {
        event.preventDefault();
        event.target.click();
        return;
    }

    if (event.key !== 'Escape') {
        return;
    }

    const toolMenu = document.getElementById('extensionsMenu');
    const optionsMenu = document.getElementById('options');
    if (toolMenu instanceof HTMLElement && getComputedStyle(toolMenu).display !== 'none') {
        event.preventDefault();
        const button = document.getElementById('extensionsMenuButton');
        button?.click();
        button?.focus({ preventScroll: true });
        return;
    }
    if (optionsMenu instanceof HTMLElement && getComputedStyle(optionsMenu).display !== 'none') {
        event.preventDefault();
        const button = document.getElementById('options_button');
        button?.click();
        button?.focus({ preventScroll: true });
    }
}

function handlePageHide(event) {
    if (event.persisted) {
        return;
    }
    stopNativePanelObservers();
}

function initializeAuxiliaryUi() {
    decorateOptionsMenu();
    decorateToolMenu();
}

function initializeNativePanels() {
    if (nativePanelsInitialized) {
        initializeAuxiliaryUi();
        return;
    }
    nativePanelsInitialized = true;

    for (const [id, meta] of Object.entries(PANEL_META)) {
        const panel = document.getElementById(id);
        if (!(panel instanceof HTMLElement)) {
            continue;
        }

        decoratePanel(panel, meta);
        const observer = new MutationObserver(() => {
            if (panel.classList.contains('openDrawer')) {
                decoratePanel(panel, meta);
            }
        });
        observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
        nativePanelObservers.add(observer);
    }

    document.addEventListener('keydown', handleAccessibleMenuKeys, { signal: nativeUiSignal });
    window.addEventListener('furry-theme-ready', connectThemeModeControl, { signal: nativeUiSignal });
    initializeAuxiliaryUi();

    bodyUiObserver = new MutationObserver(records => {
        const needsRefresh = records.some(record => Array.from(record.addedNodes).some(node => (
            node instanceof HTMLElement
            && (node.id === 'extensionsMenu' || node.querySelector?.('#extensionsMenu'))
        )));
        if (needsRefresh) {
            initializeAuxiliaryUi();
        }
    });
    bodyUiObserver.observe(document.body, { childList: true });
}

function initializeWhenShellIsReady() {
    if (document.getElementById('furry-shell')) {
        initializeNativePanels();
        return;
    }

    shellReadyObserver = new MutationObserver(() => {
        if (!document.getElementById('furry-shell')) {
            return;
        }

        shellReadyObserver.disconnect();
        shellReadyObserver = null;
        initializeNativePanels();
    });
    shellReadyObserver.observe(document.body, { childList: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenShellIsReady, { once: true });
} else {
    initializeWhenShellIsReady();
}

window.addEventListener('pagehide', handlePageHide, { signal: nativeUiSignal });
