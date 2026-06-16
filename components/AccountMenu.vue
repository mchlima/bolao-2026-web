<script setup lang="ts">
// Account menu body — shared by the header avatar dropdown (desktop) and the
// bottom-nav avatar sheet (mobile). Emits `close` so the host can dismiss.
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const router = useRouter();
const colorMode = useColorMode();

const themes = [
  { key: 'system', title: 'Sistema' },
  { key: 'light', title: 'Claro' },
  { key: 'dark', title: 'Escuro' },
] as const;

function logout() {
  auth.logout();
  emit('close');
  router.push('/');
}
</script>

<template>
  <div class="acct">
    <div class="who">
      <div class="who-name">{{ auth.user?.name }}</div>
      <div class="who-email">{{ auth.user?.email }}</div>
    </div>
    <template v-if="auth.isAdmin">
      <div class="sep" />
      <NuxtLink to="/admin" class="row" @click="emit('close')">Admin</NuxtLink>
    </template>
    <div class="sep" />
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
    <div class="sep" />
    <button class="row danger" @click="logout">Sair</button>
  </div>
</template>

<style scoped>
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
