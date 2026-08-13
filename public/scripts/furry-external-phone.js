const PHONE_CONTAINER_ID = 'mobile-phone-container';
const PHONE_TRIGGER_ID = 'mobile-phone-trigger';
const PHONE_ASPECT_RATIO = 375 / 737;
const VIEWPORT_PADDING = 8;

let bodyObserver = null;
let resizeFrame = 0;

function getViewport() {
    const viewport = window.visualViewport;
    return {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: Math.max(1, viewport?.width ?? window.innerWidth),
        height: Math.max(1, viewport?.height ?? window.innerHeight),
    };
}

function updateViewportVariables(viewport) {
    const root = document.documentElement;
    const availableHeight = Math.max(1, viewport.height - VIEWPORT_PADDING * 2);
    const responsiveWidth = viewport.width <= 720
        ? Math.min(300, viewport.width * 0.8)
        : Math.min(375, viewport.width * 0.7);
    const frameWidth = Math.max(96, Math.min(responsiveWidth, availableHeight * PHONE_ASPECT_RATIO));

    root.style.setProperty('--furry-external-phone-vv-width', `${viewport.width}px`);
    root.style.setProperty('--furry-external-phone-vv-height', `${viewport.height}px`);
    root.style.setProperty('--furry-external-phone-vv-left', `${viewport.left}px`);
    root.style.setProperty('--furry-external-phone-vv-top', `${viewport.top}px`);
    root.style.setProperty('--furry-external-phone-frame-width', `${frameWidth}px`);
}

function isRendered(element) {
    if (!element?.isConnected) {
        return false;
    }
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function moveIntoViewport(element, viewport) {
    if (!isRendered(element)) {
        return;
    }

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return;
    }

    const minLeft = viewport.left + VIEWPORT_PADDING;
    const minTop = viewport.top + VIEWPORT_PADDING;
    const maxRight = viewport.left + viewport.width - VIEWPORT_PADDING;
    const maxBottom = viewport.top + viewport.height - VIEWPORT_PADDING;
    let deltaX = 0;
    let deltaY = 0;

    if (rect.left < minLeft) {
        deltaX = minLeft - rect.left;
    } else if (rect.right > maxRight) {
        deltaX = maxRight - rect.right;
    }
    if (rect.top < minTop) {
        deltaY = minTop - rect.top;
    } else if (rect.bottom > maxBottom) {
        deltaY = maxBottom - rect.bottom;
    }
    if (!deltaX && !deltaY) {
        return;
    }

    const parentRect = element.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    element.style.left = `${rect.left + deltaX - parentRect.left}px`;
    element.style.top = `${rect.top + deltaY - parentRect.top}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
}

function markPhoneNodes() {
    const container = document.getElementById(PHONE_CONTAINER_ID);
    const trigger = document.getElementById(PHONE_TRIGGER_ID);
    container?.setAttribute('data-furry-global-layer', 'external-phone');
    trigger?.setAttribute('data-furry-global-layer', 'external-phone');
}

function refreshPhoneLayer() {
    resizeFrame = 0;
    const viewport = getViewport();
    updateViewportVariables(viewport);
    markPhoneNodes();

    const trigger = document.getElementById(PHONE_TRIGGER_ID);
    const frame = document.querySelector(`#${PHONE_CONTAINER_ID} > .mobile-phone-frame`);
    moveIntoViewport(trigger, viewport);
    moveIntoViewport(frame, viewport);
}

function schedulePhoneLayerRefresh() {
    if (resizeFrame) {
        return;
    }
    resizeFrame = window.requestAnimationFrame(refreshPhoneLayer);
}

function mutationTouchesPhone(mutations) {
    return mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
        return node instanceof HTMLElement && (node.id === PHONE_CONTAINER_ID || node.id === PHONE_TRIGGER_ID);
    }));
}

function destroyExternalPhoneLayer() {
    bodyObserver?.disconnect();
    bodyObserver = null;
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    window.removeEventListener('resize', schedulePhoneLayerRefresh);
    window.removeEventListener('orientationchange', schedulePhoneLayerRefresh);
    window.visualViewport?.removeEventListener('resize', schedulePhoneLayerRefresh);
    window.visualViewport?.removeEventListener('scroll', schedulePhoneLayerRefresh);
    window.removeEventListener('pagehide', handlePageHide);
}

function handlePageHide(event) {
    if (!event.persisted) {
        destroyExternalPhoneLayer();
    }
}

function initExternalPhoneLayer() {
    window.__furryExternalPhoneLayer?.destroy?.();

    bodyObserver = new MutationObserver(mutations => {
        if (mutationTouchesPhone(mutations)) {
            schedulePhoneLayerRefresh();
        }
    });
    bodyObserver.observe(document.body, { childList: true });

    window.addEventListener('resize', schedulePhoneLayerRefresh, { passive: true });
    window.addEventListener('orientationchange', schedulePhoneLayerRefresh, { passive: true });
    window.visualViewport?.addEventListener('resize', schedulePhoneLayerRefresh, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedulePhoneLayerRefresh, { passive: true });
    window.addEventListener('pagehide', handlePageHide);

    window.__furryExternalPhoneLayer = {
        refresh: schedulePhoneLayerRefresh,
        destroy: destroyExternalPhoneLayer,
    };
    schedulePhoneLayerRefresh();
}

initExternalPhoneLayer();
