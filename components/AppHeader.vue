<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);

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
        <span class="ball" aria-hidden="true">⚽</span>
        <span>Amigos do Bolão</span>
      </NuxtLink>

      <div class="actions">
        <ThemeToggle />

        <template v-if="auth.isAuthenticated">
          <div class="menu">
            <button class="btn avatar" @click="menuOpen = !menuOpen">
              {{ (auth.user?.name ?? '?').slice(0, 1).toUpperCase() }}
            </button>
            <div v-if="menuOpen" class="dropdown card">
              <div class="who">
                <strong>{{ auth.user?.name }}</strong>
                <span class="muted">{{ auth.user?.email }}</span>
              </div>
              <NuxtLink to="/predictions" class="item" @click="menuOpen = false">
                Meus palpites
              </NuxtLink>
              <button class="item" @click="logout">Sair</button>
            </div>
          </div>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn btn-primary">Entrar</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--header-h);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.bar {
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1.02rem;
}
.ball {
  font-size: 1.2rem;
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.avatar {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 999px;
  font-weight: 800;
}
.menu {
  position: relative;
}
.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 220px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
}
.who {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.3rem;
}
.who .muted {
  font-size: 0.8rem;
}
.item {
  text-align: left;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  padding: 0.55rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.item:hover {
  background: var(--surface-2);
}
</style>
