<script setup lang="ts">
// Minimal chrome for the public landing — brand + auth CTAs only, no app nav.
</script>

<template>
  <div class="land">
    <header class="lhead">
      <div class="container bar">
        <NuxtLink to="/inicio" class="brand">
          <span class="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
          </span>
          <span class="title">
            <span class="name">Amigos do Bolão</span>
            <span class="sub">Copa 2026</span>
          </span>
        </NuxtLink>
        <div class="cta">
          <NuxtLink to="/login" class="btn">Entrar</NuxtLink>
          <NuxtLink to="/register" class="btn btn-gold">Criar conta</NuxtLink>
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
