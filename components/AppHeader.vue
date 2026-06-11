<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();
const colorMode = useColorMode();
const menuOpen = ref(false);

const initials = computed(() => {
  const n = auth.user?.name?.trim();
  if (!n) return 'VC';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
});

const ui = useUiStore();
const ZONES = [
  { v: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { v: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { v: 'America/Mexico_City', label: 'Cidade do México (GMT-6)' },
  { v: 'America/New_York', label: 'Nova York (GMT-4)' },
  { v: 'Europe/Lisbon', label: 'Lisboa (GMT+1)' },
  { v: 'UTC', label: 'UTC' },
];
async function setTz(e: Event) {
  await auth.setTimezone((e.target as HTMLSelectElement).value);
  ui.toast('success', 'Fuso horário atualizado');
}

const themes = [
  { key: 'system', title: 'Sistema' },
  { key: 'light', title: 'Claro' },
  { key: 'dark', title: 'Escuro' },
] as const;

function logout() {
  auth.logout();
  menuOpen.value = false;
  router.push('/');
}
</script>

<template>
  <header class="header">
    <div class="container bar">
      <NuxtLink to="/" class="brand">
        <span class="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
        </span>
        <span class="title">
          <span class="name">Amigos do Bolão</span>
          <span class="sub">Copa 2026</span>
        </span>
      </NuxtLink>

      <div class="actions">
        <NuxtLink to="/howto" class="howto-link">Como funciona</NuxtLink>
        <template v-if="auth.isAuthenticated">
          <div class="menu">
            <button class="avatar" @click="menuOpen = !menuOpen">{{ initials }}</button>
            <div v-if="menuOpen" class="dropdown" @click.stop>
              <div class="who">
                <div class="who-name">{{ auth.user?.name }}</div>
                <div class="who-email">{{ auth.user?.email }}</div>
              </div>
              <div class="theme-block">
                <div class="theme-lbl">Tema</div>
                <div class="seg">
                  <button
                    v-for="t in themes"
                    :key="t.key"
                    class="seg-btn"
                    :class="{ on: colorMode.preference === t.key }"
                    :title="t.title"
                    @click="colorMode.preference = t.key"
                  >
                    {{ t.title }}
                  </button>
                </div>
              </div>
              <div class="theme-block">
                <div class="theme-lbl">Fuso horário</div>
                <select class="tz-select" :value="auth.user?.timezone" @change="setTz">
                  <option v-for="z in ZONES" :key="z.v" :value="z.v">{{ z.label }}</option>
                </select>
              </div>
              <div class="sep" />
              <NuxtLink to="/howto" class="row" @click="menuOpen = false">Como funciona</NuxtLink>
              <NuxtLink to="/predictions" class="row" @click="menuOpen = false">Meus palpites</NuxtLink>
              <NuxtLink v-if="auth.isAdmin" to="/admin" class="row" @click="menuOpen = false">Área admin</NuxtLink>
              <button class="row danger" @click="logout">Sair</button>
            </div>
          </div>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn btn-gold">Entrar</NuxtLink>
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
  gap: 14px;
}
.howto-link {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
}
.howto-link:hover {
  color: var(--text);
}
@media (max-width: 560px) {
  .howto-link {
    display: none;
  }
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
  width: 224px;
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
}
.theme-block {
  padding: 8px 10px 4px;
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
.tz-select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
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
</style>
