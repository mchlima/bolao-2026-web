<template>
  <div class="app">
    <AppHeader />
    <AppNavDrawer />
    <main class="container main">
      <slot />
    </main>
    <AppBottomNav />
    <PullToRefresh />
    <ToastHost />
    <ConfirmDialog />
    <NotificationsBridge />
  </div>
</template>

<style scoped>
/* App-shell: the document itself doesn't scroll — <main> is a fixed area between
   the global header and the bottom nav (both siblings outside it) and scrolls
   internally. So <main> always ends exactly at the nav (or the screen bottom on
   desktop, where the nav is hidden). dvh tracks the real viewport; since the
   document doesn't scroll, the mobile address bar stays put (no reflow). */
.app {
  min-height: 100dvh;
}
.main {
  height: calc(100dvh - var(--header-h, 0px) - var(--nav-h, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none; /* edge-to-edge content would shift if a gutter showed */
  /* No padding at all — overrides the .container side gutter too. Each page /
     element owns its own spacing; content runs edge to edge. */
  padding: 0;
}
.main::-webkit-scrollbar {
  display: none;
}

/* Mobile / installed PWA: drop the inner-scroll shell and let the document scroll
   naturally. This guarantees all content is reachable (no inner-scroll height /
   safe-area pitfalls) and lets the custom pull-to-refresh work from the top.
   The fixed bottom nav is cleared with padding; the global header is hidden here
   so there's nothing to subtract at the top. */
@media (max-width: 720px) {
  .main {
    height: auto;
    min-height: calc(100dvh - var(--nav-h));
    overflow-y: visible;
    overscroll-behavior: auto;
    padding-bottom: var(--nav-h);
  }
}
</style>
