import type { RouterConfig } from '@nuxt/schema';

// The narration tab (MatchTimeline) scrolls itself to the latest event when it
// opens. Switching tabs is a route change (the [[aba]] segment), so Nuxt's default
// scroll-to-top would fire and override that auto-scroll. Opt the narration route
// out — return false to leave the scroll alone and let the component own it.
// Everything else keeps the default (restored position, else top).
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (to.params.aba === 'tempo') return false;
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
};
