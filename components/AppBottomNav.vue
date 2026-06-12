<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();

const items = computed(() => {
  // App-only nav: hidden for logged-out visitors (they only see the landing).
  if (!auth.isAuthenticated) return [];
  const base = [
    { to: '/home', label: 'Início', icon: 'home' },
    { to: '/tournaments', label: 'Torneios', icon: 'trophy' },
    { to: '/pools', label: 'Bolões', icon: 'users' },
    { to: '/predictions', label: 'Palpites', icon: 'ticket' },
    { to: '/howto', label: 'Como', icon: 'book' },
  ];
  // Admin lives only in the avatar dropdown (AppHeader), not in the app nav.
  return base;
});

const ICONS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M14 6v12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 22H20v-5"/>',
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
