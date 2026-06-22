<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();
// On the auth screens the page already offers Entrar/Criar conta, so the header
// CTA is redundant noise — hide it there.
const onAuthPage = computed(() => route.path === '/entrar' || route.path === '/cadastro');
const authLink = useAuthLink();
const menuOpen = ref(false);
const notifications = useNotificationsStore();
const { toggleDrawer } = useNavDrawer();
// Pilar Bolão: logado vai pros seus bolões; anônimo cai na landing de conversão.
const bolaoTarget = computed(() => (auth.isAuthenticated ? '/boloes' : '/bolao-da-copa-do-mundo-2026'));
</script>

<template>
  <header class="header">
    <div class="container bar">
      <button class="burger" aria-label="Abrir menu" @click="toggleDrawer">
        <AppIcon name="menu" :size="22" :stroke="2.2" />
      </button>

      <NuxtLink to="/" class="brand">
        <span class="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
        </span>
        <span class="title">
          <span class="name">Cravei</span>
          <span class="sub">Copa 2026</span>
        </span>
      </NuxtLink>

      <!-- Atalho dos 3 pilares (desktop). A árvore completa fica no drawer. -->
      <nav class="topnav">
        <NuxtLink to="/noticias" class="nav-link">Notícias</NuxtLink>
        <NuxtLink to="/futebol/agenda" class="nav-link">Jogos</NuxtLink>
        <NuxtLink :to="bolaoTarget" class="nav-link">Bolão</NuxtLink>
      </nav>

      <div class="actions">
        <template v-if="auth.isAuthenticated">
          <div class="menu">
            <button class="avatar" @click="menuOpen = !menuOpen" aria-label="Conta">
              <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="38" />
              <span v-if="notifications.unread" class="av-badge">
                {{ notifications.unread > 9 ? '9+' : notifications.unread }}
              </span>
            </button>
            <div v-if="menuOpen" class="dropdown" @click.stop>
              <AccountMenu @close="menuOpen = false" />
            </div>
          </div>
        </template>
        <template v-else-if="!onAuthPage">
          <div class="auth-cta">
            <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold">Criar conta</NuxtLink>
            <NuxtLink :to="authLink('/entrar')" class="btn">Entrar</NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(14px);
  background: color-mix(in srgb, var(--bg-base) 82%, transparent);
  border-bottom: 1px solid var(--border);
}
.bar {
  height: 62px;
  display: flex;
  align-items: center;
  gap: 18px;
}
.burger {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-left: -6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s;
}
.burger:hover {
  background: var(--bg-surface);
  border-color: var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--grad-trophy);
  display: grid;
  place-items: center;
  box-shadow: 0 6px 18px -6px rgba(224, 33, 138, 0.6);
}
.title {
  line-height: 1;
}
.name {
  display: block;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}
.sub {
  display: block;
  font-size: 10.5px;
  color: var(--muted);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 2px;
}
.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.auth-cta {
  display: flex;
  align-items: center;
  gap: 9px;
}
.tgl {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  cursor: pointer;
  flex: none;
  transition: color 0.15s, border-color 0.15s;
}
.tgl:hover {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
/* On phones the bottom nav carries "Entrar" and the hero carries "Criar conta",
   so the header auth buttons are redundant noise — keep just brand + theme. */
@media (max-width: 560px) {
  .auth-cta {
    display: none;
  }
}
.topnav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}
.nav-link {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  padding: 7px 11px;
  border-radius: 9px;
  transition: color 0.13s, background 0.13s;
}
.nav-link:hover {
  color: var(--text);
  background: var(--bg-surface);
}
.nav-link.router-link-active {
  color: var(--text);
  background: var(--bg-surface);
}
@media (max-width: 640px) {
  .topnav {
    display: none;
  }
}
.menu {
  position: relative;
}
.avatar {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  border-radius: 50%;
  cursor: pointer;
  display: block;
}
.av-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  box-sizing: border-box;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--scarlet, #e8362b);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-surface);
  pointer-events: none;
}
.dropdown {
  position: absolute;
  right: 0;
  top: 46px;
  width: 224px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 8px;
  z-index: 60;
}
/* On mobile the bottom nav carries the fast loop and the drawer (hambúrguer) holds
   the full tree. The header becomes a SLIM, NON-STICKY bar (logo + hambúrguer +
   avatar/CTA) — non-sticky on purpose so it doesn't collide with the page
   sub-headers that stick at top:0 inside <main> (tournament .thead, match board). */
@media (max-width: 720px) {
  .header {
    position: static;
  }
  .bar {
    height: 54px;
    gap: 12px;
  }
  /* On the immersive match screen, drop the bar entirely (the "Voltar" is the way out). */
  body.match-screen .header {
    display: none;
  }
}
</style>
