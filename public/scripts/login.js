import { initAccessibility } from './a11y.js';

let csrfToken = '';
let discreetLogin = false;
let registrationEnabled = false;
let selectedUser = null;
let manualLogin = false;
let recoveryHandle = '';
let requestInFlight = false;

const viewCopy = {
    login: {
        eyebrow: '账号登录',
        title: '欢迎回来',
        description: '选择账号，或输入登录信息继续。',
    },
    register: {
        eyebrow: '创建账号',
        title: '加入新酒馆',
        description: '只需用户名和密码，即可创建独立空间。',
    },
    recovery: {
        eyebrow: '账号恢复',
        title: '设置新密码',
        description: '输入服务器控制台中显示的恢复码。',
    },
};

const elements = {};

/**
 * Gets a required element by id.
 * @param {string} id Element id
 * @returns {HTMLElement} Element
 */
function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing login element: ${id}`);
    }

    return element;
}

function cacheElements() {
    const ids = [
        'authPage',
        'authPageBack',
        'authTabs',
        'loginTab',
        'registerTab',
        'loginView',
        'registerView',
        'passwordRecoveryBlock',
        'viewEyebrow',
        'viewTitle',
        'viewDescription',
        'serverModeBadge',
        'errorMessage',
        'accountChooser',
        'accountCount',
        'userList',
        'manualLoginButton',
        'backToAccountsButton',
        'loginForm',
        'handleEntryBlock',
        'userHandle',
        'userPassword',
        'passwordEntryBlock',
        'selectedAccount',
        'selectedAvatar',
        'selectedName',
        'selectedHandle',
        'changeAccountButton',
        'recoverPassword',
        'loginButton',
        'registerForm',
        'registerUsername',
        'registerPassword',
        'registerButton',
        'recoveryForm',
        'recoveryCode',
        'newPassword',
        'sendRecovery',
        'cancelRecovery',
    ];

    for (const id of ids) {
        elements[id] = getElement(id);
    }
}

/**
 * Gets a CSRF token from the server.
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken() {
    const response = await fetch('/csrf-token');

    if (!response.ok) {
        throw new Error('无法建立安全连接，请刷新页面重试。');
    }

    const data = await response.json();
    return data.token;
}

/**
 * Gets the public registration state.
 * @returns {Promise<boolean>} Whether registration is enabled
 */
async function getRegistrationStatus() {
    const response = await fetch('/api/users/registration-status', {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('无法读取注册状态。');
    }

    const data = await response.json();
    return data.enabled === true;
}

/**
 * Gets the public user list. A 204 response means discreet login is enabled.
 * @returns {Promise<object[]>} Public users
 */
async function getUserList() {
    const response = await fetch('/api/users/list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
    });

    if (response.status === 204) {
        discreetLogin = true;
        return [];
    }

    if (!response.ok) {
        throw new Error(await getResponseError(response, '无法读取账号列表。'));
    }

    return await response.json();
}

/**
 * Extracts a useful error message from a failed response.
 * @param {Response} response Fetch response
 * @param {string} fallback Fallback message
 * @returns {Promise<string>} Error message
 */
async function getResponseError(response, fallback) {
    try {
        const data = await response.json();

        if (typeof data?.error === 'string' && data.error.trim()) {
            return data.error;
        }
    } catch {
        // The endpoint may return an empty or non-JSON error response.
    }

    if (response.status === 429) {
        return '尝试次数过多，请稍后再试。';
    }

    return fallback;
}

/**
 * Displays a status message.
 * @param {string} message Message text
 * @param {'error'|'success'|'info'} type Message type
 */
function displayStatus(message, type = 'error') {
    elements.errorMessage.textContent = message;
    elements.errorMessage.hidden = !message;
    elements.errorMessage.dataset.type = type;
}

function clearStatus() {
    displayStatus('');
}

/**
 * Updates the active authentication view.
 * @param {'login'|'register'|'recovery'} view View name
 */
function showView(view) {
    const copy = viewCopy[view];
    const isLogin = view === 'login';
    const isRegister = view === 'register';

    elements.loginView.hidden = !isLogin;
    elements.registerView.hidden = !isRegister;
    elements.passwordRecoveryBlock.hidden = view !== 'recovery';
    elements.authTabs.hidden = view === 'recovery';
    elements.loginTab.classList.toggle('is-active', isLogin);
    elements.loginTab.setAttribute('aria-selected', String(isLogin));
    elements.registerTab.classList.toggle('is-active', isRegister);
    elements.registerTab.setAttribute('aria-selected', String(isRegister));
    elements.viewEyebrow.textContent = copy.eyebrow;
    elements.viewTitle.textContent = copy.title;
    elements.viewDescription.textContent = copy.description;
    clearStatus();

    if (isLogin) {
        syncLoginPresentation();
    }
}

function configureRegistration() {
    elements.registerTab.hidden = !registrationEnabled;
    elements.authTabs.classList.toggle('is-single', !registrationEnabled);
    updateModeBadge();
}

function updateModeBadge() {
    const labels = [];

    if (discreetLogin) {
        labels.push('私密登录');
    }

    if (registrationEnabled) {
        labels.push('开放注册');
    }

    elements.serverModeBadge.textContent = labels.join(' · ');
    elements.serverModeBadge.hidden = labels.length === 0;
}

/**
 * Builds the account chooser for normal login mode.
 * @param {object[]} users Public users
 */
function configureUserList(users) {
    elements.userList.replaceChildren();
    elements.accountCount.textContent = users.length > 0 ? `${users.length} 个账号` : '';

    if (users.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-account-list';
        emptyState.innerHTML = '<i class="fa-solid fa-user-slash" aria-hidden="true"></i><span>暂无可选账号</span>';
        elements.userList.append(emptyState);
        elements.manualLoginButton.querySelector('span').textContent = '输入用户名登录';
        return;
    }

    for (const user of users) {
        elements.userList.append(createUserButton(user));
    }
}

/**
 * Creates a public user selector.
 * @param {object} user Public user
 * @returns {HTMLButtonElement} User button
 */
function createUserButton(user) {
    const button = document.createElement('button');
    const avatar = document.createElement('img');
    const identity = document.createElement('span');
    const name = document.createElement('strong');
    const handle = document.createElement('small');
    const indicator = document.createElement('span');
    const icon = document.createElement('i');

    button.type = 'button';
    button.className = 'user-select';
    avatar.className = 'user-avatar';
    avatar.src = user.avatar || 'img/logo.png';
    avatar.alt = '';
    identity.className = 'user-identity';
    name.textContent = user.name || user.handle;
    handle.textContent = `@${user.handle}`;
    indicator.className = 'user-select-indicator';
    icon.className = user.password ? 'fa-solid fa-chevron-right' : 'fa-solid fa-arrow-right-to-bracket';
    icon.setAttribute('aria-hidden', 'true');
    identity.append(name, handle);
    indicator.append(icon);
    button.append(avatar, identity, indicator);
    button.addEventListener('click', () => selectUser(user, button));
    return button;
}

/**
 * Handles a public account selection.
 * @param {object} user Public user
 * @param {HTMLButtonElement} button Clicked button
 * @returns {Promise<void>}
 */
async function selectUser(user, button) {
    if (!user.password) {
        await runWithBusyButton(button, '正在进入', async () => {
            await performLogin(user.handle, '');
        });
        return;
    }

    selectedUser = user;
    manualLogin = false;
    elements.userPassword.value = '';
    syncLoginPresentation();
    elements.userPassword.focus();
}

function syncLoginPresentation() {
    if (discreetLogin || manualLogin) {
        elements.accountChooser.hidden = true;
        elements.loginForm.hidden = false;
        elements.handleEntryBlock.hidden = false;
        elements.backToAccountsButton.hidden = discreetLogin;
        elements.selectedAccount.hidden = true;
        return;
    }

    if (!selectedUser) {
        elements.accountChooser.hidden = false;
        elements.loginForm.hidden = true;
        return;
    }

    elements.accountChooser.hidden = true;
    elements.loginForm.hidden = false;
    elements.handleEntryBlock.hidden = true;
    elements.backToAccountsButton.hidden = true;
    elements.selectedAccount.hidden = false;
    elements.selectedAvatar.src = selectedUser.avatar || 'img/logo.png';
    elements.selectedName.textContent = selectedUser.name || selectedUser.handle;
    elements.selectedHandle.textContent = `@${selectedUser.handle}`;
}

function openManualLogin() {
    selectedUser = null;
    manualLogin = true;
    elements.userHandle.value = '';
    elements.userPassword.value = '';
    syncLoginPresentation();
    elements.userHandle.focus();
}

function returnToAccountChooser() {
    selectedUser = null;
    manualLogin = false;
    elements.userPassword.value = '';
    clearStatus();
    syncLoginPresentation();
}

/**
 * Attempts to log in.
 * @param {string} handle User handle
 * @param {string} password User password
 * @returns {Promise<void>}
 */
async function performLogin(handle, password) {
    const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ handle, password }),
    });

    if (!response.ok) {
        throw new Error(await getResponseError(response, '登录失败，请检查用户名和密码。'));
    }

    const data = await response.json();

    if (!data.handle) {
        throw new Error('服务器未能完成登录，请重试。');
    }

    redirectToHome();
}

/**
 * Creates an account and uses the session returned by the server.
 * @param {string} username Username
 * @param {string} password Password
 * @returns {Promise<void>}
 */
async function performRegistration(username, password) {
    const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        throw new Error(await getResponseError(response, '注册失败，请稍后重试。'));
    }

    const data = await response.json();

    if (!data.handle) {
        throw new Error('账号已创建，但服务器未能建立登录会话。');
    }

    displayStatus('账号创建成功，正在进入酒馆…', 'success');
    await new Promise(resolve => window.setTimeout(resolve, 250));
    redirectToHome();
}

/**
 * Requests a password recovery code.
 * @param {string} handle User handle
 * @returns {Promise<void>}
 */
async function requestRecoveryCode(handle) {
    const response = await fetch('/api/users/recover-step1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ handle }),
    });

    if (!response.ok) {
        throw new Error(await getResponseError(response, '无法发送恢复码，请稍后重试。'));
    }

    recoveryHandle = handle;
    elements.recoveryCode.value = '';
    elements.newPassword.value = '';
    showView('recovery');
    elements.recoveryCode.focus();
}

/**
 * Sets a new password using a recovery code.
 * @param {string} code Recovery code
 * @param {string} newPassword New password
 * @returns {Promise<void>}
 */
async function finishPasswordRecovery(code, newPassword) {
    const response = await fetch('/api/users/recover-step2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
            handle: recoveryHandle,
            code,
            newPassword,
        }),
    });

    if (!response.ok) {
        throw new Error(await getResponseError(response, '密码重置失败，请检查恢复码。'));
    }

    await performLogin(recoveryHandle, newPassword);
}

/**
 * Runs an asynchronous action with a button loading state.
 * @param {HTMLButtonElement} button Button
 * @param {string} loadingLabel Loading label
 * @param {() => Promise<void>} action Action
 * @returns {Promise<void>}
 */
async function runWithBusyButton(button, loadingLabel, action) {
    if (requestInFlight) {
        return;
    }

    requestInFlight = true;
    setButtonBusy(button, true, loadingLabel);
    clearStatus();

    try {
        await action();
    } catch (error) {
        console.error(error);
        displayStatus(error instanceof Error ? error.message : String(error));
    } finally {
        requestInFlight = false;
        setButtonBusy(button, false);
    }
}

/**
 * Toggles a button loading state.
 * @param {HTMLButtonElement} button Button
 * @param {boolean} busy Busy state
 * @param {string} [loadingLabel] Temporary label
 */
function setButtonBusy(button, busy, loadingLabel) {
    const label = button.querySelector('.button-label');

    if (label && !button.dataset.defaultLabel) {
        button.dataset.defaultLabel = label.textContent || '';
    }

    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
    button.setAttribute('aria-busy', String(busy));

    if (label) {
        label.textContent = busy ? loadingLabel || '请稍候' : button.dataset.defaultLabel || '';
    }
}

function redirectToHome() {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('noauto');
    currentUrl.pathname = '/';
    window.location.href = currentUrl.toString();
}

function getCurrentLoginHandle() {
    return selectedUser?.handle || String(elements.userHandle.value).trim();
}

function bindEvents() {
    elements.authPageBack.addEventListener('click', () => {
        const referrer = document.referrer ? new URL(document.referrer) : null;
        if (referrer?.origin === window.location.origin) {
            window.history.back();
            return;
        }
        window.location.assign('/');
    });
    elements.loginTab.addEventListener('click', () => showView('login'));
    elements.registerTab.addEventListener('click', () => {
        if (registrationEnabled) {
            showView('register');
            elements.registerUsername.focus();
        }
    });
    elements.manualLoginButton.addEventListener('click', openManualLogin);
    elements.backToAccountsButton.addEventListener('click', returnToAccountChooser);
    elements.changeAccountButton.addEventListener('click', returnToAccountChooser);

    elements.loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const handle = getCurrentLoginHandle();
        const password = String(elements.userPassword.value);

        if (!handle) {
            displayStatus('请输入用户名。');
            elements.userHandle.focus();
            return;
        }

        await runWithBusyButton(elements.loginButton, '正在登录', async () => {
            await performLogin(handle, password);
        });
    });

    elements.registerForm.addEventListener('submit', async event => {
        event.preventDefault();
        const username = String(elements.registerUsername.value).trim();
        const password = String(elements.registerPassword.value);

        if (!username) {
            displayStatus('请输入用户名。');
            elements.registerUsername.focus();
            return;
        }

        if (password.length < 6) {
            displayStatus('密码至少需要 6 个字符。');
            elements.registerPassword.focus();
            return;
        }

        await runWithBusyButton(elements.registerButton, '正在创建', async () => {
            await performRegistration(username, password);
        });
    });

    elements.recoverPassword.addEventListener('click', async () => {
        const handle = getCurrentLoginHandle();

        if (!handle) {
            displayStatus('请先输入需要恢复的用户名。');
            elements.userHandle.focus();
            return;
        }

        await runWithBusyButton(elements.recoverPassword, '正在发送', async () => {
            await requestRecoveryCode(handle);
        });
    });

    elements.recoveryForm.addEventListener('submit', async event => {
        event.preventDefault();
        const code = String(elements.recoveryCode.value).trim();
        const newPassword = String(elements.newPassword.value);

        if (!/^\d{6}$/.test(code)) {
            displayStatus('请输入六位数字恢复码。');
            elements.recoveryCode.focus();
            return;
        }

        if (newPassword.length < 6) {
            displayStatus('新密码至少需要 6 个字符。');
            elements.newPassword.focus();
            return;
        }

        await runWithBusyButton(elements.sendRecovery, '正在重置', async () => {
            await finishPasswordRecovery(code, newPassword);
        });
    });

    elements.cancelRecovery.addEventListener('click', () => showView('login'));

    document.querySelectorAll('[data-password-target]').forEach(button => {
        button.addEventListener('click', () => togglePasswordVisibility(button));
    });
}

/**
 * Toggles an associated password input.
 * @param {Element} button Toggle button
 */
function togglePasswordVisibility(button) {
    const targetId = button.getAttribute('data-password-target');
    const input = targetId ? document.getElementById(targetId) : null;

    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    const shouldShow = input.type === 'password';
    const icon = button.querySelector('i');
    input.type = shouldShow ? 'text' : 'password';
    button.setAttribute('aria-label', shouldShow ? '隐藏密码' : '显示密码');
    button.setAttribute('title', shouldShow ? '隐藏密码' : '显示密码');
    icon?.classList.toggle('fa-eye', !shouldShow);
    icon?.classList.toggle('fa-eye-slash', shouldShow);
}

async function initialize() {
    initAccessibility();
    cacheElements();
    bindEvents();

    try {
        csrfToken = await getCsrfToken();
        const [registrationResult, userListResult] = await Promise.allSettled([
            getRegistrationStatus(),
            getUserList(),
        ]);

        if (registrationResult.status === 'fulfilled') {
            registrationEnabled = registrationResult.value;
        }

        if (userListResult.status === 'rejected') {
            throw userListResult.reason;
        }

        configureUserList(userListResult.value);
        configureRegistration();
        const requestedView = new URLSearchParams(window.location.search).get('view');
        const initialView = requestedView === 'register' && registrationEnabled ? 'register' : 'login';
        showView(initialView);

        if (registrationResult.status === 'rejected') {
            displayStatus('暂时无法读取注册状态，仍可使用已有账号登录。', 'info');
        }

        if (discreetLogin && initialView === 'login') {
            manualLogin = true;
            syncLoginPresentation();
            elements.userHandle.focus();
        } else if (initialView === 'register') {
            elements.registerUsername.focus();
        }
    } catch (error) {
        console.error('Login page initialization failed:', error);
        displayStatus(error instanceof Error ? error.message : '无法连接服务器，请刷新页面重试。');
    } finally {
        elements.authPage.classList.add('is-ready');
        elements.authPage.setAttribute('aria-busy', 'false');
    }
}

initialize();
