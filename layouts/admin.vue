<script setup lang="ts">
// Admin shell: sticky topbar + collapsible vertical sidebar (grouped nav) +
// full-width main. Replaces the old horizontal-tabs AdminShell. Pages opt in
// with definePageMeta({ layout: 'admin', middleware: 'admin' }).
const route = useRoute();
const auth = useAuthStore();
const router = useRouter();
const colorMode = useColorMode();
const ui = useUiStore();

// Desktop rail collapse persists across reloads; mobile uses an off-canvas drawer.
const collapsed = useCookie<boolean>('admin_sidebar_collapsed', {
  default: () => false,
});
const mobileOpen = ref(false);
const isMobile = ref(false);
const userOpen = ref(false);

onMounted(() => {
  const mq = window.matchMedia('(max-width: 980px)');
  const apply = () => {
    isMobile.value = mq.matches;
    if (!mq.matches) mobileOpen.value = false;
  };
  apply();
  mq.addEventListener('change', apply);
});

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value;
  else collapsed.value = !collapsed.value;
}

// Close the mobile drawer / user menu when navigating.
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
    userOpen.value = false;
  },
);

interface NavItem {
  to: string;
  label: string;
  icon: string[];
  exact?: boolean;
  live?: boolean;
}
const groups: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      {
        to: '/admin',
        label: 'Dashboard',
        exact: true,
        icon: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
      },
    ],
  },
  {
    title: 'Competição',
    items: [
      {
        to: '/admin/competitions',
        label: 'Competições',
        icon: ['M6 4h12v3a6 6 0 0 1-12 0Z', 'M6 5H3v1a3 3 0 0 0 3 3', 'M18 5h3v1a3 3 0 0 1-3 3', 'M9 19h6', 'M12 13v6'],
      },
      {
        to: '/admin/tournaments',
        label: 'Torneios',
        icon: ['M3 5h18v16H3z', 'M3 9h18', 'M8 3v4', 'M16 3v4'],
      },
      {
        to: '/admin/structure',
        label: 'Estrutura',
        icon: ['M9 3h6v4H9z', 'M3 17h6v4H3z', 'M15 17h6v4h-6z', 'M12 7v3', 'M6 17v-3h12v3'],
      },
    ],
  },
  {
    title: 'Jogos',
    items: [
      {
        to: '/admin/matches',
        label: 'Partidas',
        icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8l3.2 2.3-1.2 3.7h-4l-1.2-3.7z'],
      },
      {
        to: '/admin/live',
        label: 'Controle ao vivo',
        live: true,
        icon: ['M9 8a5 5 0 0 0 0 8', 'M15 8a5 5 0 0 1 0 8', 'M6 5a9 9 0 0 0 0 14', 'M18 5a9 9 0 0 1 0 14', 'M12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z'],
      },
      {
        to: '/admin/palpites',
        label: 'Palpites',
        icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
      },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      {
        to: '/admin/teams',
        label: 'Times',
        icon: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
      },
      {
        to: '/admin/stadiums',
        label: 'Estádios',
        icon: ['M3 9c0-2 4-3 9-3s9 1 9 3-4 3-9 3-9-1-9-3z', 'M3 9v6c0 2 4 3 9 3s9-1 9-3V9', 'M8 11.5v6', 'M16 11.5v6'],
      },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      {
        to: '/admin/content',
        label: 'Painel',
        exact: true,
        icon: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
      },
      {
        to: '/admin/content/feeds',
        label: 'Fontes',
        icon: ['M4 11a9 9 0 0 1 9 9', 'M4 4a16 16 0 0 1 16 16', 'M6 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'],
      },
      {
        to: '/admin/content/tones',
        label: 'Tons',
        icon: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
      },
      {
        to: '/admin/content/categorias',
        label: 'Categorias',
        icon: ['M3 7l9-4 9 4-9 4z', 'M3 7v10l9 4 9-4V7'],
      },
      {
        to: '/admin/content/tags',
        label: 'Tags',
        icon: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
      },
      {
        to: '/admin/content/triagem',
        label: 'Triagem',
        icon: ['M3 4h18l-7 8v6l-4 2v-8z'],
      },
      {
        to: '/admin/content/revisao',
        label: 'Revisão',
        icon: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
      },
      {
        to: '/admin/content/configuracoes',
        label: 'Configurações',
        icon: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        to: '/admin/users',
        label: 'Usuários',
        icon: ['M16 19v-1a4 4 0 0 0-8 0v1', 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
      },
      {
        to: '/admin/campaigns',
        label: 'Campanhas',
        icon: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
      },
    ],
  },
];

function active(it: NavItem) {
  return it.exact ? route.path === it.to : route.path.startsWith(it.to);
}

const initials = computed(() => {
  const n = auth.user?.name?.trim();
  if (!n) return 'VC';
  const p = n.split(/\s+/);
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
});
const themes = [
  { key: 'system', title: 'Sistema' },
  { key: 'light', title: 'Claro' },
  { key: 'dark', title: 'Escuro' },
] as const;
function logout() {
  auth.logout();
  userOpen.value = false;
  router.push('/');
}
</script>

<template>
  <div class="adm" :class="{ collapsed, 'drawer-open': mobileOpen }">
    <!-- Topbar -->
    <header class="topbar">
      <button class="icon-btn toggle" aria-label="Alternar menu" @click="toggleSidebar">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <NuxtLink to="/admin" class="brand">
        <span class="logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z" /><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6" /></svg>
        </span>
        <span class="brand-txt">
          <span class="brand-name">Cravei</span>
          <span class="brand-sub">Painel admin</span>
        </span>
      </NuxtLink>

      <div class="top-actions">
        <NuxtLink to="/home" class="ghost-link">Ver site</NuxtLink>
        <div class="menu">
          <button class="avatar" aria-label="Conta" @click="userOpen = !userOpen">{{ initials }}</button>
          <div v-if="userOpen" class="dropdown" @click.stop>
            <div class="who">
              <div class="who-name">{{ auth.user?.name }}</div>
              <div class="who-email">{{ auth.user?.email }}</div>
            </div>
            <div class="sep" />
            <div class="theme-block">
              <div class="theme-lbl">Tema</div>
              <div class="seg">
                <button v-for="t in themes" :key="t.key" class="seg-btn" :class="{ on: colorMode.preference === t.key }" @click="colorMode.preference = t.key">{{ t.title }}</button>
              </div>
            </div>
            <div class="sep" />
            <NuxtLink to="/home" class="row" @click="userOpen = false">Voltar ao site</NuxtLink>
            <button class="row danger" @click="logout">Sair</button>
          </div>
        </div>
      </div>
    </header>

    <div class="body">
      <!-- Sidebar -->
      <aside class="sidebar">
        <nav class="nav">
          <div v-for="(g, gi) in groups" :key="gi" class="group">
            <div v-if="g.title" class="group-title">{{ g.title }}</div>
            <NuxtLink
              v-for="it in g.items"
              :key="it.to"
              :to="it.to"
              class="nav-item"
              :class="{ on: active(it), live: it.live }"
              :title="collapsed ? it.label : undefined"
            >
              <span class="nav-ic">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in it.icon" :key="i" :d="d" /></svg>
                <span v-if="it.live" class="live-dot" />
              </span>
              <span class="nav-label">{{ it.label }}</span>
            </NuxtLink>
          </div>
        </nav>
      </aside>

      <!-- Mobile drawer backdrop -->
      <div class="backdrop" @click="mobileOpen = false" />

      <!-- Main -->
      <main class="main">
        <slot />
      </main>
    </div>

    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.adm {
  min-height: 100vh;
  background: var(--bg-base);
  --sidebar-w: 248px;
  --rail-w: 68px;
  --topbar-h: 60px;
}
/* ── Topbar ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: color-mix(in srgb, var(--bg-base) 85%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  cursor: pointer;
}
.icon-btn:hover {
  border-color: var(--muted);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--grad-trophy);
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 6px 18px -6px rgba(224, 33, 138, 0.55);
}
.brand-txt {
  line-height: 1;
  min-width: 0;
}
.brand-name {
  display: block;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.brand-sub {
  display: block;
  font-size: 10px;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-top: 3px;
}
.top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.ghost-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid var(--border);
}
.ghost-link:hover {
  color: var(--text);
  border-color: var(--muted);
}
.menu {
  position: relative;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--grad-pitch);
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.dropdown {
  position: absolute;
  right: 0;
  top: 46px;
  width: 230px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 8px;
  z-index: 60;
}
.who {
  padding: 8px 10px 10px;
}
.who-name {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14px;
}
.who-email {
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
}
.theme-block {
  padding: 6px 10px 4px;
}
.theme-lbl {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 7px;
}
.seg {
  display: flex;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}
.seg-btn {
  flex: 1;
  padding: 7px 2px;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  background: transparent;
}
.seg-btn.on {
  color: #0a0e14;
  background: var(--gold);
}
.sep {
  height: 1px;
  background: var(--border);
  margin: 8px 6px;
}
.row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border: none;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
}
.row:hover {
  background: var(--bg-base);
}
.row.danger {
  color: var(--scarlet);
  font-weight: 700;
}
/* ── Body / sidebar / main ── */
.body {
  display: flex;
  align-items: stretch;
}
.sidebar {
  flex: none;
  width: var(--sidebar-w);
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
  position: sticky;
  top: var(--topbar-h);
  align-self: flex-start;
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  transition: width 0.18s ease;
}
.adm.collapsed .sidebar {
  width: var(--rail-w);
}
.nav {
  padding: 14px 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
}
.group + .group {
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
.group-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 6px 10px 4px;
  white-space: nowrap;
}
.adm.collapsed .group-title {
  opacity: 0;
  height: 0;
  padding: 0;
  overflow: hidden;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border-radius: 10px;
  color: var(--muted);
  font-weight: 700;
  font-size: 13.5px;
  white-space: nowrap;
}
.nav-item:hover {
  color: var(--text);
  background: var(--bg-base);
}
.nav-item.on {
  color: #fff;
  background: var(--grad-pitch);
}
.nav-item.live.on {
  background: var(--grad-live);
}
.nav-item.live {
  color: var(--scarlet);
}
.nav-ic {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}
.live-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 2px var(--bg-surface);
  animation: live-pulse 1.3s ease-out infinite;
}
.nav-item.on .live-dot {
  background: #fff;
  box-shadow: 0 0 0 2px transparent;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(232, 54, 43, 0.6); }
  70% { box-shadow: 0 0 0 5px rgba(232, 54, 43, 0); }
  100% { box-shadow: 0 0 0 0 rgba(232, 54, 43, 0); }
}
.adm.collapsed .nav-label {
  display: none;
}
.adm.collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}
.main {
  flex: 1;
  min-width: 0;
  padding: 22px 26px 56px;
}
.backdrop {
  display: none;
}
/* ── Mobile: off-canvas drawer ── */
@media (max-width: 980px) {
  .sidebar {
    position: fixed;
    top: var(--topbar-h);
    left: 0;
    z-index: 45;
    width: var(--sidebar-w) !important;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow);
  }
  .adm.drawer-open .sidebar {
    transform: translateX(0);
  }
  /* On mobile the rail collapse doesn't apply — always show labels in the drawer. */
  .adm.collapsed .nav-label {
    display: inline;
  }
  .adm.collapsed .group-title {
    opacity: 1;
    height: auto;
    padding: 6px 10px 4px;
  }
  .adm.collapsed .nav-item {
    justify-content: flex-start;
    padding: 9px 10px;
  }
  .adm.drawer-open .backdrop {
    display: block;
    position: fixed;
    inset: var(--topbar-h) 0 0 0;
    z-index: 44;
    background: rgba(10, 14, 20, 0.5);
  }
  .main {
    padding: 18px 16px 56px;
  }
}
@media (max-width: 560px) {
  .brand-sub {
    display: none;
  }
  .ghost-link {
    display: none;
  }
}
</style>
