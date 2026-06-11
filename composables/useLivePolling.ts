/**
 * Polls `refresh` on an interval while `active` is true (client only).
 * Pauses when the tab is hidden to save requests. Used by LIVE screens
 * (contract: bolao-2026-docs/api/contracts.md — polling interval).
 */
export function useLivePolling(
  refresh: () => unknown | Promise<unknown>,
  active: Ref<boolean>,
  intervalMs = 15000,
) {
  if (import.meta.server) return { start() {}, stop() {} };

  let timer: ReturnType<typeof setInterval> | null = null;

  function tick() {
    if (active.value && document.visibilityState === 'visible') {
      void refresh();
    }
  }
  function start() {
    stop();
    timer = setInterval(tick, intervalMs);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function onVisible() {
    if (document.visibilityState === 'visible') tick();
  }

  onMounted(() => {
    start();
    document.addEventListener('visibilitychange', onVisible);
  });
  onBeforeUnmount(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisible);
  });

  return { start, stop };
}

// Default polling cadence for LIVE screens (ms).
export const LIVE_POLL_MS = 15000;
