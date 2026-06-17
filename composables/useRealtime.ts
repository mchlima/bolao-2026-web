/**
 * Public SSE subscription. Opens one EventSource to the API for the given rooms
 * and calls onEvent (which refetches) on any server event. Resilient to the ways
 * a mobile stream dies: EventSource auto-reconnects (we resync on reopen), we
 * refetch + reopen when the app returns to the foreground, and a watchdog reopens
 * a silently-dead stream. Heartbeat pings are ignored (but prove liveness).
 */
export function useRealtime(rooms: () => string[], onEvent: () => void) {
  if (import.meta.server) return;
  const base = useRuntimeConfig().public.apiBase;
  let es: EventSource | null = null;
  let lastBeat = 0; // ms of the last message/ping — liveness for the watchdog
  let watchdog: ReturnType<typeof setInterval> | undefined;

  function close() {
    es?.close();
    es = null;
  }

  function connect() {
    close();
    const list = rooms().filter(Boolean);
    if (!list.length) return;
    lastBeat = Date.now();
    es = new EventSource(`${base}/events?rooms=${encodeURIComponent(list.join(','))}`);
    let opened = false;
    es.onopen = () => {
      lastBeat = Date.now();
      if (opened) onEvent(); // resync after a reconnect (not the first open)
      opened = true;
    };
    es.onmessage = (ev) => {
      lastBeat = Date.now();
      try {
        if (JSON.parse(ev.data)?.ping) return;
      } catch {
        /* non-JSON: still treat as a change signal */
      }
      onEvent();
    };
  }

  // Refetch the data AND reopen a fresh stream — used whenever the connection may
  // have missed events (foreground return, watchdog).
  function resync() {
    onEvent();
    connect();
  }

  // Mobile browsers freeze (and often silently drop) the EventSource while the app
  // is backgrounded — a kickoff/goal signal fired meanwhile is missed, and on
  // resume the stream can sit in a zombie OPEN state that never fires onopen, so
  // it's never recovered. On returning to the foreground, resync.
  function onVisible() {
    if (document.visibilityState === 'visible') resync();
  }

  // Foreground safety net: the server pings every 30s, so no traffic for >70s means
  // the stream died without an error event (Cloudflare/proxy drop, network blip).
  // Reopen + refetch so a live match keeps updating without a manual refresh.
  function tick() {
    if (document.visibilityState === 'visible' && es && Date.now() - lastBeat > 70_000) resync();
  }

  onMounted(() => {
    connect();
    document.addEventListener('visibilitychange', onVisible);
    watchdog = setInterval(tick, 30_000);
  });
  onBeforeUnmount(() => {
    close();
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(watchdog);
  });
  watch(() => rooms().join(','), connect);
}
