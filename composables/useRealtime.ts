/**
 * Shared SSE bus — ONE EventSource per DEVICE (not per tab).
 *
 * Within a tab, useRealtime(rooms, onEvent) registers a subscriber and the manager
 * multiplexes every component's room subscriptions into the union of all rooms.
 *
 * Across tabs of the same browser, a single tab is elected "leader" (via the Web
 * Locks API) and is the only one that opens an EventSource — to the union of the
 * rooms wanted by ALL tabs. The leader relays each event over a BroadcastChannel so
 * every tab dispatches to its own subscribers. Followers open no connection. When
 * the leader tab closes/crashes the lock releases and another tab takes over.
 *
 * Leadership prefers a VISIBLE tab: if the leader is backgrounded while another tab
 * is in the foreground, it yields (browsers throttle/freeze background tabs, which
 * would stall a leader's stream). When every tab is hidden the leader stays put —
 * nobody needs live updates anyway, and we wake/resync on the next focus.
 *
 * Net effect: N tabs on one device = 1 server connection, so the admin "online"
 * count reflects devices, not tabs. Multiple devices still = multiple connections.
 *
 * Resilience (owned by the leader): EventSource auto-reconnects (we resync on
 * reopen), we refetch + reopen when the app returns to the foreground (any tab's
 * focus wakes the leader), and a watchdog reopens a silently-dead stream. Heartbeat
 * pings are ignored (but prove liveness).
 *
 * Gating: a subscriber whose rooms() returns [] (e.g. an inactive tab) contributes
 * nothing to the union and receives nothing — so a hidden tab costs zero.
 *
 * Fallback: without BroadcastChannel + Web Locks the bus degrades to one
 * EventSource per tab (the previous behavior). Public API is unchanged.
 */
interface Sub {
  rooms: Set<string>;
  cb: () => void;
}

// Cross-tab bus messages (BroadcastChannel does not echo to the sender).
type BusMsg =
  | { t: 'ev'; room: string } // leader → relays a room-scoped event
  | { t: 'evAll' } // leader → relays a "refresh everything" signal
  | { t: 'rooms'; id: string; rooms: string; v: boolean } // a tab's local rooms (csv) + visibility
  | { t: 'query' } // leader → asks every tab to (re)announce its rooms
  | { t: 'vis'; id: string; v: boolean } // a tab's visibility changed
  | { t: 'wake' } // a tab focused → ask the leader to resync
  | { t: 'bye'; id: string }; // a tab is unloading → drop it

let base = '';
const subs = new Set<Sub>();

// --- live stream (held only by the leader / direct mode) ---
let es: EventSource | null = null;
let lastBeat = 0; // ms of the last message/ping — liveness for the watchdog
let watchdog: ReturnType<typeof setInterval> | undefined;
let reopen: ReturnType<typeof setTimeout> | undefined;
let roomsKey = ''; // the rooms the live stream is currently opened for

// --- cross-tab coordination ---
type Mode = 'direct' | 'leader' | 'follower';
let mode: Mode = 'direct';
let inited = false;
let crossTab = false;
let bc: BroadcastChannel | null = null;
const tabId =
  (globalThis.crypto?.randomUUID?.() as string | undefined) ?? String(Math.random()).slice(2);
let sentRoomsKey = ' '; // last local rooms csv we announced to peers (≠ '' sentinel)
const peerRooms = new Map<string, string>(); // other tabId → its local rooms (csv)
const peerVisible = new Map<string, boolean>(); // other tabId → is it foreground?
let pendingPeers: Map<string, { rooms: string; v: boolean }> | null = null; // in-flight query rebuild
let leaderRelease: (() => void) | null = null; // resolve() of the held lock → releasing it yields
let yieldTimer: ReturnType<typeof setTimeout> | undefined;

function isVisible(): boolean {
  return document.visibilityState === 'visible';
}
function hasVisiblePeer(): boolean {
  for (const v of peerVisible.values()) if (v) return true;
  return false;
}

function unionRooms(): string[] {
  const s = new Set<string>();
  for (const sub of subs) for (const r of sub.rooms) s.add(r);
  return [...s].sort();
}

// What the open stream should cover: this tab's rooms, plus every peer's when we're
// the leader. (Direct mode has no peers, so this is just the local union.)
function effectiveRooms(): string[] {
  const s = new Set<string>(unionRooms());
  if (mode === 'leader')
    for (const csv of peerRooms.values()) for (const r of csv.split(',')) if (r) s.add(r);
  return [...s].sort();
}

// An event names its room — fire only the callbacks watching it.
function dispatch(room: string): void {
  for (const sub of subs) if (sub.rooms.has(room)) sub.cb();
}
function dispatchAll(): void {
  for (const sub of subs) sub.cb();
}

// Leader relays events to follower tabs (no-op in direct mode).
function relay(room: string): void {
  bc?.postMessage({ t: 'ev', room } satisfies BusMsg);
}
function relayAll(): void {
  bc?.postMessage({ t: 'evAll' } satisfies BusMsg);
}
function announceVis(): void {
  bc?.postMessage({ t: 'vis', id: tabId, v: isVisible() } satisfies BusMsg);
}

function closeStream(): void {
  es?.close();
  es = null;
}

// Stable per-browser id, persisted and shared across tabs. The server counts
// presence by (user, device), so even while several tabs each briefly hold a
// stream during leader election — or in the no-Web-Locks fallback (one stream
// per tab) — they collapse to a single device instead of inflating the count.
// Falls back to a per-session id if storage/crypto is unavailable (private mode).
let deviceId = '';
function getDeviceId(): string {
  if (deviceId) return deviceId;
  const fresh = (): string =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const saved = localStorage.getItem('bolao-device-id');
    if (saved) return (deviceId = saved);
    const id = fresh();
    localStorage.setItem('bolao-device-id', id);
    return (deviceId = id);
  } catch {
    return (deviceId ||= fresh());
  }
}

function openStream(): void {
  closeStream();
  if (mode === 'follower') {
    roomsKey = ''; // followers never hold a connection — the leader does
    return;
  }
  const list = effectiveRooms();
  roomsKey = list.join(',');
  if (!list.length) return;
  lastBeat = Date.now();
  // withCredentials sends the `bolao-token` cookie so the server can identify
  // the user for presence (logged-out clients just connect anonymously).
  es = new EventSource(
    `${base}/events?rooms=${encodeURIComponent(roomsKey)}&did=${encodeURIComponent(getDeviceId())}`,
    { withCredentials: true },
  );
  let opened = false;
  es.onopen = () => {
    lastBeat = Date.now();
    if (opened) {
      dispatchAll(); // resync after a reconnect (not the first open)
      relayAll();
    }
    opened = true;
  };
  es.onmessage = (ev) => {
    lastBeat = Date.now();
    try {
      const d = JSON.parse(ev.data);
      if (d?.ping) return;
      if (typeof d?.room === 'string') {
        dispatch(d.room);
        relay(d.room);
        return;
      }
    } catch {
      /* non-JSON: still treat as a change signal */
    }
    dispatchAll();
    relayAll();
  };
}

// Coalesce a burst of (un)mounts — e.g. a match page mounting 4 tab subscribers at
// once — into a single reconnect, and skip it entirely when the union is unchanged.
// Also announces our local rooms (+ visibility) so the leader can aggregate them.
function reconcile(): void {
  const localKey = unionRooms().join(',');
  if (bc && localKey !== sentRoomsKey) {
    sentRoomsKey = localKey;
    bc.postMessage({ t: 'rooms', id: tabId, rooms: localKey, v: isVisible() } satisfies BusMsg);
  }
  if (mode === 'follower') return; // the leader owns the stream
  if (effectiveRooms().join(',') === roomsKey) return;
  if (reopen) clearTimeout(reopen);
  reopen = setTimeout(openStream, 50);
}

function resync(): void {
  dispatchAll();
  if (mode === 'follower') {
    bc?.postMessage({ t: 'wake' } satisfies BusMsg); // nudge the (maybe backgrounded) leader
    return;
  }
  relayAll();
  openStream();
}

function onVisChange(): void {
  announceVis();
  if (isVisible()) resync();
  else maybeYield(); // backgrounded: hand leadership to a foreground tab if any
}

// Foreground safety net: the server pings every 30s, so no traffic for >70s means
// the stream died without an error (Cloudflare/proxy drop, network blip) — reopen.
// The leader also re-polls peers here to drop tabs that closed without notice.
function tick(): void {
  if (document.visibilityState === 'visible' && es && Date.now() - lastBeat > 70_000) resync();
  if (mode === 'leader') leaderQuery();
}

// Leader: ask every tab for its rooms + visibility and rebuild the peer maps from
// the replies, which naturally drops tabs that have since closed.
function leaderQuery(): void {
  if (!bc) return;
  pendingPeers = new Map();
  bc.postMessage({ t: 'query' } satisfies BusMsg);
  setTimeout(() => {
    if (!pendingPeers) return;
    peerRooms.clear();
    peerVisible.clear();
    for (const [k, { rooms, v }] of pendingPeers) {
      peerRooms.set(k, rooms);
      peerVisible.set(k, v);
    }
    pendingPeers = null;
    if (!isVisible() && hasVisiblePeer()) maybeYield();
    reconcile();
  }, 400);
}

// Release the lock so another tab leads. We re-request first (joining the back of
// the queue) and release after, so the lock goes to a tab ahead of us — and any
// hidden tab that grabs it will itself yield, so leadership hops to a visible one.
function yieldLeadership(): void {
  if (mode !== 'leader') return;
  const release = leaderRelease;
  leaderRelease = null;
  mode = 'follower';
  closeStream();
  roomsKey = '';
  electLeader();
  release?.();
}

// Debounced: only yield after staying hidden ~1s with a visible peer present, so
// a quick alt-tab doesn't churn the connection.
function maybeYield(): void {
  if (yieldTimer) clearTimeout(yieldTimer);
  if (mode !== 'leader' || isVisible() || !hasVisiblePeer()) return;
  yieldTimer = setTimeout(() => {
    yieldTimer = undefined;
    if (mode === 'leader' && !isVisible() && hasVisiblePeer()) yieldLeadership();
  }, 1000);
}

function becomeLeader(): void {
  if (mode === 'leader') {
    reconcile();
    return;
  }
  mode = 'leader';
  // Don't lead from the background if a foreground tab can: hop the lock onward.
  if (!isVisible() && hasVisiblePeer()) {
    yieldLeadership();
    return;
  }
  reconcile(); // open immediately for what we know…
  leaderQuery(); // …then fold in the other tabs' rooms
}

function electLeader(): void {
  mode = 'follower';
  // Holding the lock = being the leader; the callback's promise resolves only when
  // we choose to yield (or the tab is destroyed/frozen), at which point the next
  // waiting tab's request fulfils and it becomes the leader.
  navigator.locks
    .request(
      'bolao-sse-leader',
      { mode: 'exclusive' },
      () =>
        new Promise<void>((resolve) => {
          leaderRelease = resolve;
          becomeLeader();
        }),
    )
    .catch(() => {
      // Lock API unavailable/failed → degrade this tab to its own connection.
      crossTab = false;
      mode = 'direct';
      reconcile();
    });
}

function onBus(ev: MessageEvent): void {
  const m = ev.data as BusMsg | null;
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'ev':
      dispatch(m.room);
      break;
    case 'evAll':
      dispatchAll();
      break;
    case 'rooms': {
      const known = peerRooms.has(m.id);
      peerRooms.set(m.id, m.rooms);
      peerVisible.set(m.id, m.v);
      pendingPeers?.set(m.id, { rooms: m.rooms, v: m.v });
      if (!known) announceVis(); // help a newcomer learn our visibility
      if (mode === 'leader') {
        if (!isVisible() && m.v) maybeYield();
        reconcile();
      }
      break;
    }
    case 'query':
      bc?.postMessage({
        t: 'rooms',
        id: tabId,
        rooms: unionRooms().join(','),
        v: isVisible(),
      } satisfies BusMsg);
      break;
    case 'vis': {
      const known = peerVisible.has(m.id);
      peerVisible.set(m.id, m.v);
      if (!known) announceVis();
      if (mode === 'leader' && !isVisible() && m.v) maybeYield();
      break;
    }
    case 'wake':
      if (mode === 'leader') resync();
      break;
    case 'bye':
      peerRooms.delete(m.id);
      peerVisible.delete(m.id);
      if (mode === 'leader') reconcile();
      break;
  }
}

function onBye(): void {
  bc?.postMessage({ t: 'bye', id: tabId } satisfies BusMsg);
}

function onPageShow(e: PageTransitionEvent): void {
  // Restored from bfcache: a frozen leader has lost its lock, so re-enter the
  // election and refresh either way.
  if (e.persisted && crossTab) {
    electLeader();
    announceVis();
  }
  resync();
}

function init(): void {
  if (inited) return;
  inited = true;
  crossTab = typeof BroadcastChannel !== 'undefined' && !!navigator.locks?.request;
  if (crossTab) {
    bc = new BroadcastChannel('bolao-sse');
    bc.onmessage = onBus;
  }
  document.addEventListener('visibilitychange', onVisChange);
  window.addEventListener('pagehide', onBye);
  window.addEventListener('pageshow', onPageShow);
  watchdog = setInterval(tick, 30_000);
  if (crossTab) {
    electLeader();
    announceVis();
  }
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
    init();
    subs.add(sub);
    sync();
  });
  onBeforeUnmount(() => {
    subs.delete(sub);
    // reconcile() recomputes the union; if nothing is wanted anymore the leader
    // closes the stream (effective rooms become empty). The bus/lock stay up so
    // this tab keeps relaying for its peers.
    reconcile();
  });
  // React to a subscriber changing its rooms (e.g. a tab going active/inactive).
  watch(() => rooms().join(','), sync);
}
