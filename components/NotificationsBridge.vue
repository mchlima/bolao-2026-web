<script setup lang="ts">
// Headless: keeps the notifications unread badge live app-wide. Loads the count
// when authenticated and refreshes it (and the list, if already open) whenever
// the per-user SSE room pings. Mounted once in the default layout.
const auth = useAuthStore();
const store = useNotificationsStore();

watch(
  () => auth.isAuthenticated,
  (on) => {
    if (on) store.refreshUnread();
    else store.reset();
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
