<script setup lang="ts">
const { toggleDrawer } = useNavDrawer();
const auth = useAuthStore();
const authLink = useAuthLink();
// Jogos acontecendo agora — dot vermelho pulsa quando há ao vivo; some o pulso
// e fica acinzentado (0) quando não há nenhum.
const { count: liveCount } = useLiveCount();
</script>

<template>
  <header class="header">
    <div class="container bar">
      <!-- Hambúrguer: só no mobile (≤720px). No desktop a navegação vive no
           AppTopNav (menu horizontal com dropdowns). -->
      <button class="burger" aria-label="Abrir menu" @click="toggleDrawer">
        <AppIcon name="menu" :size="22" :stroke="2.2" />
      </button>

      <NuxtLink to="/" class="brand">
        <span class="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
        </span>
        <span class="title">
          <span class="name">Cravei</span>
        </span>
      </NuxtLink>

      <!-- Navegação principal — só desktop. -->
      <AppTopNav class="topnav" />

      <!-- Indicador de jogos ao vivo. Pulsa em vermelho quando há jogos agora;
           acinzentado e estático (0) quando não há nenhum. -->
      <NuxtLink
        to="/futebol/agenda?scope=live"
        class="live"
        :class="{ off: liveCount === 0 }"
        :aria-label="liveCount === 1 ? '1 jogo ao vivo' : `${liveCount} jogos ao vivo`"
      >
        <span class="live-dot" />
        <span class="live-num">{{ liveCount }}</span>
      </NuxtLink>

      <!-- Conta — só desktop (no mobile fica no rodapé do drawer). Avatar abre um
           dropdown (logado) ou CTAs de entrar/cadastrar (deslogado). -->
      <ClientOnly>
        <div class="acct-slot">
          <AccountMenu v-if="auth.isAuthenticated" down @close="() => {}" />
          <div v-else class="auth-cta">
            <NuxtLink :to="authLink('/entrar')" class="btn">Entrar</NuxtLink>
            <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold">Criar conta</NuxtLink>
          </div>
        </div>
      </ClientOnly>
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
/* Menu horizontal e área de conta vivem só no desktop (ver media query abaixo). */
.topnav {
  display: none;
}
.acct-slot {
  display: none;
  flex: none;
}
.auth-cta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.auth-cta .btn {
  padding: 8px 14px;
  font-size: 13px;
}
/* Gatilho de conta no header = só avatar + chevron (nome/e-mail ficam no menu). */
.acct-slot :deep(.who.as-btn) {
  padding: 4px 6px;
  gap: 6px;
  border-radius: 999px;
}
.acct-slot :deep(.who-txt) {
  display: none;
}
/* Sem a setinha no gatilho do avatar (o próprio avatar já indica o menu). */
.acct-slot :deep(.who-go) {
  display: none;
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
  font-size: 22px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}
/* Indicador de jogos ao vivo (dot pulsante + número). */
.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 7px 13px 7px 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--scarlet) 35%, var(--border));
  background: color-mix(in srgb, var(--scarlet) 9%, var(--bg-surface));
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.live:hover {
  border-color: var(--scarlet);
}
.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 70%, transparent);
  animation: live-pulse 1.5s ease-out infinite;
}
.live-num {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--scarlet);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
/* Sem jogos: para de pulsar, fica acinzentado. */
.live.off {
  border-color: var(--border);
  background: var(--bg-surface);
}
.live.off .live-dot {
  background: var(--muted);
  box-shadow: none;
  animation: none;
}
.live.off .live-num {
  color: var(--muted);
}
@keyframes live-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 65%, transparent);
  }
  70% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--scarlet) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 0%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot {
    animation: none;
  }
}
/* On mobile the drawer (hambúrguer) holds the full tree. The header becomes a SLIM,
   NON-STICKY bar (logo + hambúrguer) — non-sticky on purpose so it doesn't collide
   with the page sub-headers that stick at top:0 inside <main> (tournament .thead,
   match board). */
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
/* Desktop: o hambúrguer some e a navegação vira o menu horizontal + conta. */
@media (min-width: 721px) {
  .burger {
    display: none;
  }
  .topnav {
    display: flex;
    margin-left: 6px;
  }
  .acct-slot {
    display: block;
  }
}
</style>
