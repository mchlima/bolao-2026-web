/**
 * Public SSE subscription. Opens one EventSource to the API for the given rooms
 * and calls onEvent (which refetches) on any server event. Reconnects are
 * handled by EventSource; on reconnect we resync. Heartbeat pings are ignored.
 */
export function useRealtime(rooms: () => string[], onEvent: () => void) {
  if (import.meta.server) return;
  const base = useRuntimeConfig().public.apiBase;
  let es: EventSource | null = null;

  function close() {
    es?.close();
    es = null;
  }

  function connect() {
    close();
    const list = rooms().filter(Boolean);
    if (!list.length) return;
    es = new EventSource(`${base}/events?rooms=${encodeURIComponent(list.join(','))}`);
    let opened = false;
    es.onopen = () => {
      if (opened) onEvent(); // resync after a reconnect (not the first open)
      opened = true;
    };
    es.onmessage = (ev) => {
      try {
        if (JSON.parse(ev.data)?.ping) return;
      } catch {
        /* non-JSON: still treat as a change signal */
      }
      onEvent();
    };
  }

  onMounted(connect);
  onBeforeUnmount(close);
  watch(() => rooms().join(','), connect);
}
