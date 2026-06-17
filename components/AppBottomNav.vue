<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();
const authLink = useAuthLink();
const sheetOpen = ref(false);

const items = computed(() => {
  // Portal nav for logged-out visitors: Início (portal) + Jogos (cross-tournament
  // agenda) + Torneios (→ each tournament's own hub) + login.
  if (!auth.isAuthenticated)
    return [
      { to: '/', label: 'Início', icon: 'home' },
      { to: '/futebol/jogos', label: 'Jogos', icon: 'calendar' },
      { to: '/futebol/torneios', label: 'Torneios', icon: 'trophy' },
      { to: '/login', label: 'Entrar', icon: 'login' },
    ];
  // Logged in: app nav + the avatar (account sheet) as the last item.
  return [
    { to: '/', label: 'Início', icon: 'home' },
    { to: '/futebol/jogos', label: 'Jogos', icon: 'calendar' },
    { to: '/futebol/torneios', label: 'Torneios', icon: 'trophy' },
    { to: '/pools', label: 'Bolões', icon: 'users' },
  ];
});

const ICONS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
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
      :to="it.to === '/login' ? authLink('/login') : it.to"
      class="item"
      :style="{ color: active(it.to) ? 'var(--emerald)' : 'var(--muted)' }"
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[it.icon]" />
      <span>{{ it.label }}</span>
    </NuxtLink>
    <!-- avatar = last item (logged in): opens the account sheet -->
    <button
      v-if="auth.isAuthenticated"
      type="button"
      class="item av-item"
      :style="{ color: sheetOpen ? 'var(--emerald)' : 'var(--muted)' }"
      @click="sheetOpen = true"
    >
      <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="22" />
      <span>Conta</span>
    </button>
  </nav>

  <ClientOnly>
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="sheetOpen" class="sheet-wrap" @click.self="sheetOpen = false">
          <div class="sheet">
            <div class="sheet-handle" />
            <AccountMenu @close="sheetOpen = false" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
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
  background: none;
  border: 0;
  cursor: pointer;
}
.av-item :deep(svg) {
  display: none;
}

/* account bottom sheet */
.sheet-wrap {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 82vh;
  overflow-y: auto;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  border-radius: 20px 20px 0 0;
  padding: 6px 12px calc(16px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}
.sheet-handle {
  width: 42px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 6px auto 8px;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.24s ease;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
