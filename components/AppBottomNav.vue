<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();

const items = computed(() => {
  // App-only nav: hidden for logged-out visitors (they only see the landing).
  if (!auth.isAuthenticated) return [];
  const base = [
    { to: '/tournaments', label: 'Torneios', icon: 'home' },
    { to: '/predictions', label: 'Palpites', icon: 'ticket' },
    { to: '/howto', label: 'Como funciona', icon: 'book' },
  ];
  if (auth.isAdmin) base.push({ to: '/admin', label: 'Admin', icon: 'cog' });
  return base;
});

const ICONS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5"/>',
  ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M14 6v12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 22H20v-5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V19a2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 11H4.5a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1Z"/>',
};

function active(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to);
}
</script>

<template>
  <nav v-if="items.length" class="bnav">
    <NuxtLink
      v-for="it in items"
      :key="it.to"
      :to="it.to"
      class="item"
      :style="{ color: active(it.to) ? 'var(--emerald)' : 'var(--muted)' }"
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[it.icon]" />
      <span>{{ it.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bnav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 45;
  background: color-mix(in srgb, var(--bg-base) 92%, transparent);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--border);
  display: none;
  padding: 7px 6px calc(7px + env(safe-area-inset-bottom));
}
@media (max-width: 720px) {
  .bnav {
    display: flex;
  }
}
.item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 0;
  font-size: 10.5px;
  font-weight: 700;
}
</style>
