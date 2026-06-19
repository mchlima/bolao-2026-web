/**
 * Shared SSE bus. ONE EventSource per app multiplexes every component's room
 * subscriptions: useRealtime(rooms, onEvent) registers a subscriber; the manager
 * connects to the UNION of all rooms and dispatches each event to the callbacks
 * whose rooms include it. Collapses N per-component connections (often several to
 * the same room — e.g. a match page's tabs) into one open stream. Resilient to the
 * ways a mobile stream dies: EventSource auto-reconnects (we resync on reopen), we
 * refetch + reopen when the app returns to the foreground, and a watchdog reopens a
 * silently-dead stream. Heartbeat pings are ignored (but prove liveness).
 *
 * Gating: a subscriber whose rooms() returns [] (e.g. an inactive tab) contributes
 * nothing to the union and receives nothing — so a hidden tab costs zero.
 *
 * Public API is unchanged: components still call useRealtime(rooms, onEvent).
 */
interface Sub {
  rooms: Set<string>;
  cb: () => void;
}

let base = '';
let es: EventSource | null = null;
let lastBeat = 0; // ms of the last message/ping — liveness for the watchdog
let watchdog: ReturnType<typeof setInterval> | undefined;
let reopen: ReturnType<typeof setTimeout> | undefined;
let roomsKey = ''; // the rooms the live stream is currently opened for
const subs = new Set<Sub>();

function unionRooms(): string[] {
  const s = new Set<string>();
  for (const sub of subs) for (const r of sub.rooms) s.add(r);
  return [...s].sort();
}

// An event names its room — fire only the callbacks watching it.
function dispatch(room: string): void {
  for (const sub of subs) if (sub.rooms.has(room)) sub.cb();
}
function dispatchAll(): void {
  for (const sub of subs) sub.cb();
}

function closeStream(): void {
  es?.close();
  es = null;
}

function openStream(): void {
  closeStream();
  const list = unionRooms();
  roomsKey = list.join(',');
  if (!list.length) return;
  lastBeat = Date.now();
  // withCredentials sends the `bolao-token` cookie so the server can identify
  // the user for presence (logged-out clients just connect anonymously).
  es = new EventSource(`${base}/events?rooms=${encodeURIComponent(roomsKey)}`, {
    withCredentials: true,
  });
  let opened = false;
  es.onopen = () => {
    lastBeat = Date.now();
    if (opened) dispatchAll(); // resync after a reconnect (not the first open)
    opened = true;
  };
  es.onmessage = (ev) => {
    lastBeat = Date.now();
    try {
      const d = JSON.parse(ev.data);
      if (d?.ping) return;
      if (typeof d?.room === 'string') {
        dispatch(d.room);
        return;
      }
    } catch {
      /* non-JSON: still treat as a change signal */
    }
    dispatchAll();
  };
}

// Coalesce a burst of (un)mounts — e.g. a match page mounting 4 tab subscribers at
// once — into a single reconnect, and skip it entirely when the union is unchanged
// (a tab toggling a room another tab still holds keeps the stream open as-is).
function reconcile(): void {
  if (unionRooms().join(',') === roomsKey) return;
  if (reopen) clearTimeout(reopen);
  reopen = setTimeout(openStream, 50);
}

function resync(): void {
  dispatchAll();
  openStream();
}

function onVisible(): void {
  if (document.visibilityState === 'visible') resync();
}
// Foreground safety net: the server pings every 30s, so no traffic for >70s means
// the stream died without an error (Cloudflare/proxy drop, network blip) — reopen.
function tick(): void {
  if (document.visibilityState === 'visible' && es && Date.now() - lastBeat > 70_000) resync();
}

function start(): void {
  if (watchdog) return; // already running
  document.addEventListener('visibilitychange', onVisible);
  watchdog = setInterval(tick, 30_000);
}
function stop(): void {
  if (subs.size > 0) return; // still in use
  closeStream();
  roomsKey = '';
  if (reopen) clearTimeout(reopen);
  document.removeEventListener('visibilitychange', onVisible);
  if (watchdog) clearInterval(watchdog);
  watchdog = undefined;
}

export function useRealtime(rooms: () => string[], onEvent: () => void) {
  if (import.meta.server) return;
  base = useRuntimeConfig().public.apiBase;
  const sub: Sub = { rooms: new Set(), cb: onEvent };
  const sync = () => {
    sub.rooms = new Set(rooms().filter(Boolean));
    reconcile();
  };
  onMounted(() => {
    start();
    subs.add(sub);
    sync();
  });
  onBeforeUnmount(() => {
    subs.delete(sub);
    reconcile();
    stop();
  });
  // React to a subscriber changing its rooms (e.g. a tab going active/inactive).
  watch(() => rooms().join(','), sync);
}
