<script setup lang="ts">
// Headless: keeps the notifications unread badge live app-wide. Loads the count
// when authenticated and refreshes it (and the list, if already open) whenever
// the per-user SSE room pings. Also drives the Web Push opt-in as soon as the
// app opens (once logged in — a subscription must bind to an account). Mounted
// once in the default layout.
const auth = useAuthStore();
const store = useNotificationsStore();
const follows = useFollowsStore();
const push = usePush();

// Browsers only show the notification permission MODAL in response to a user
// gesture — calling requestPermission() on load just gets Chrome's silent
// "quiet UI" (no popup, permission stays default). So: if already granted, we
// (re)subscribe immediately (no prompt); if still undecided, we arm the prompt
// on the first tap/click/keypress; if denied, we leave it alone (no nagging).
let armed = false;
function armPushOptIn() {
  if (!import.meta.client || armed || !('Notification' in window)) return;
  armed = true;
  if (Notification.permission === 'granted') {
    void push.autoEnable(); // silently (re)register the subscription
    return;
  }
  if (Notification.permission !== 'default') return; // denied → don't nag
  const fire = () => {
    window.removeEventListener('pointerdown', fire, true);
    window.removeEventListener('keydown', fire, true);
    void push.autoEnable(); // called within the gesture → the modal shows
  };
  window.addEventListener('pointerdown', fire, true);
  window.addEventListener('keydown', fire, true);
}

watch(
  () => auth.isAuthenticated,
  (on) => {
    if (on) {
      store.refreshUnread();
      armPushOptIn();
    } else {
      store.reset();
      follows.reset();
    }
  },
  { immediate: true },
);

useRealtime(
  () => (auth.user?.id ? [`user:${auth.user.id}`] : []),
  () => {
    store.refreshUnread();
    if (store.loaded) store.fetchList();
  },
);
</script>

<template>
  <span style="display: none" aria-hidden="true" />
</template>
