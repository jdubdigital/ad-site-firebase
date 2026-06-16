const runtimeUpdateType = 'AD_ARCHIVE_RUNTIME_UPDATE';
const runtimeLogType = 'AD_ARCHIVE_RUNTIME_LOG';
const runtimeReadyType = 'AD_ARCHIVE_RUNTIME_READY';
const impressionThreshold = 50;
const impressionDelayMs = 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getVisiblePercent(rect, viewportWidth, viewportHeight) {
  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const totalArea = Math.max(1, rect.width * rect.height);

  return clamp((visibleWidth * visibleHeight * 100) / totalArea, 0, 100);
}

function createRuntimePayload(slot, visibleTimeMs, options = {}) {
  const rect = slot.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const visiblePercent = getVisiblePercent(rect, viewportWidth, viewportHeight);
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const creativeFramePercentY = clamp((viewportHeight - rect.top) / Math.max(1, viewportHeight + rect.height), 0, 1);

  return {
    type: runtimeUpdateType,
    scrollX,
    scrollY,
    scrollTop: scrollY,
    scrollLeft: scrollX,
    viewportWidth,
    viewportHeight,
    pageWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
    pageHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
    windowWidth: viewportWidth,
    windowHeight: viewportHeight,
    adTop: rect.top,
    adBottom: rect.bottom,
    adLeft: rect.left,
    adRight: rect.right,
    adWidth: rect.width,
    adHeight: rect.height,
    creativeWidth: options.creativeWidth || rect.width,
    creativeHeight: options.creativeHeight || rect.height,
    creativeScale: options.creativeScale || 1,
    adPageTop: rect.top + scrollY,
    adPageLeft: rect.left + scrollX,
    creativeFramePercentY,
    creativeFramePercentX: clamp((viewportWidth - rect.left) / Math.max(1, viewportWidth + rect.width), 0, 1),
    visiblePercent,
    isVisible: visiblePercent > 0,
    visibleTimeMs,
    timestamp: Date.now()
  };
}

export function createAdRuntime({ iframe, slot, creativeWidth, creativeHeight, creativeScale, onUpdate, onLog, onImpression, onBridgeReady }) {
  let frame = iframe;
  let adSlot = slot;
  let raf = 0;
  let destroyed = false;
  let visibleTimeMs = 0;
  let lastVisibleTick = null;
  let viewableStartedAt = null;
  let impressionFired = false;

  function emitLog(log) {
    onLog?.({
      source: 'runtime',
      timestamp: Date.now(),
      ...log
    });
  }

  function postUpdate(payload) {
    try {
      frame?.contentWindow?.postMessage(payload, '*');
    } catch (error) {
      emitLog({
        level: 'warning',
        api: 'runtime',
        method: 'postMessage',
        message: error?.message || 'Unable to post runtime update.'
      });
    }
  }

  function tick() {
    raf = 0;
    if (destroyed || !frame || !adSlot) return;

    const now = Date.now();
    const payload = createRuntimePayload(adSlot, visibleTimeMs, {
      creativeWidth,
      creativeHeight,
      creativeScale
    });

    if (payload.isVisible) {
      if (lastVisibleTick) visibleTimeMs += now - lastVisibleTick;
      lastVisibleTick = now;
    } else {
      lastVisibleTick = null;
    }

    payload.visibleTimeMs = visibleTimeMs;

    if (payload.visiblePercent >= impressionThreshold) {
      viewableStartedAt = viewableStartedAt || now;
      if (!impressionFired && now - viewableStartedAt >= impressionDelayMs) {
        impressionFired = true;
        emitLog({
          level: 'info',
          api: 'runtime',
          method: 'impression',
          message: 'Simulated impression fired after 50% viewability for 1 second.'
        });
        onImpression?.(payload);
      }
    } else {
      viewableStartedAt = null;
    }

    postUpdate(payload);
    onUpdate?.(payload);
  }

  function queueUpdate() {
    if (destroyed || raf) return;
    raf = window.requestAnimationFrame(tick);
  }

  function handleMessage(event) {
    if (event.source !== frame?.contentWindow) return;
    const data = event.data || {};

    if (data.type === runtimeLogType) {
      onLog?.({
        source: 'creative',
        timestamp: Date.now(),
        ...data
      });
      return;
    }

    if (data.type === runtimeReadyType) {
      onBridgeReady?.(data);
      onLog?.({
        source: 'creative',
        level: 'info',
        api: 'runtime',
        method: 'ready',
        message: 'Creative runtime bridge initialized.',
        timestamp: Date.now()
      });
    }
  }

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
  window.addEventListener('message', handleMessage);
  document.addEventListener('visibilitychange', queueUpdate);

  queueUpdate();

  return {
    update: queueUpdate,
    destroy() {
      destroyed = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', queueUpdate);
      window.removeEventListener('resize', queueUpdate);
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', queueUpdate);
    }
  };
}
