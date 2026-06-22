<template>
  <div class="app">
    <AppHeader />
    <AppNavDrawer />
    <main class="main">
      <div class="main-content">
        <slot />
      </div>
      <AppFooter />
    </main>
    <PullToRefresh />
    <ToastHost />
    <ConfirmDialog />
    <NotificationsBridge />
  </div>
</template>

<style scoped>
/* App-shell: the DOCUMENT scrolls naturally (no inner-scroll container) → the wheel
   works anywhere over the page and the scrollbar shows. The global AppHeader stays
   a `position: sticky` BLOCK sibling (NOT a flex child — a sticky + backdrop-filter
   element inside a flex column jitters sub-pixel on scroll; see main.css). Only
   <main> is a flex column: it reserves the viewport minus the header, so on short
   pages .main-content grows and the footer is pinned to the bottom. In-page
   sub-headers stick below the header via top: var(--header-h) (0 on mobile). */
.app {
  min-height: 100dvh;
}
.main {
  min-height: calc(100dvh - var(--header-h, 0px));
  display: flex;
  flex-direction: column;
}
/* Conteúdo das páginas: centralizado e capado (como o antigo .container no <main>),
   mas SEM padding lateral — cada página/elemento cuida do próprio espaçamento e roda
   de borda a borda. O AppFooter fica FORA daqui pra ocupar a largura total (full-bleed). */
.main-content {
  flex: 1 0 auto; /* cresce na vertical → empurra o footer pro fundo em páginas curtas */
  width: 100%;
  max-width: 1180px;
  margin: 0 auto; /* auto-margins centram no eixo cruzado (flex column) */
}

/* Mobile / installed PWA: o header global some/encolhe aqui; a bottom-nav fixa é
   compensada com padding pra o conteúdo não ficar por baixo dela. */
@media (max-width: 720px) {
  .main {
    padding-bottom: var(--nav-h);
  }
}
</style>
