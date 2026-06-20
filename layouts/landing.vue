<script setup lang="ts">
// Minimal chrome for the public landing — brand + auth CTAs only, no app nav.
const colorMode = useColorMode();
const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
};
</script>

<template>
  <div class="land">
    <header class="lhead">
      <div class="container bar">
        <NuxtLink to="/" class="brand">
          <span class="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
          </span>
          <span class="title">
            <span class="name">Cravei</span>
            <span class="sub">Copa 2026</span>
          </span>
        </NuxtLink>
        <div class="cta">
          <button class="tgl" :title="`Tema ${colorMode.value === 'dark' ? 'claro' : 'escuro'}`" aria-label="Alternar tema" @click="toggleTheme">
            <ClientOnly>
              <svg v-if="colorMode.value === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
              <template #fallback><span style="width:18px;height:18px;display:block" /></template>
            </ClientOnly>
          </button>
          <NuxtLink to="/entrar" class="btn">Entrar</NuxtLink>
          <NuxtLink to="/cadastro" class="btn btn-gold">Criar conta</NuxtLink>
        </div>
      </div>
    </header>

    <main class="container">
      <slot />
    </main>

    <ToastHost />
  </div>
</template>

<style scoped>
.land {
  min-height: 100vh;
}
.lhead {
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
  gap: 14px;
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
.cta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 9px;
}
.cta .btn {
  font-size: 13px;
  padding: 9px 14px;
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
  transition: color 0.15s, border-color 0.15s;
}
.tgl:hover {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
@media (max-width: 420px) {
  .cta .btn {
    padding: 8px 11px;
    font-size: 12.5px;
  }
  .sub {
    display: none;
  }
}
</style>
