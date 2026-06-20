/**
 * Keeps Microsoft Clarity out of the /admin back-office.
 *
 * The nuxt.config loader only auto-starts Clarity when the initial route isn't
 * /admin (covers direct loads / reloads). This plugin handles SPA transitions:
 *  • entering /admin  → clarity('stop') pauses recording;
 *  • leaving to a public route → load Clarity if the session began in /admin
 *    (Clarity then resumes on its own — it self-restarts on each pushState).
 *
 * No-op in dev (the loader is production-only, so window.__loadClarity is absent).
 */
const isAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const w = window as unknown as {
    clarity?: (...args: unknown[]) => void;
    __loadClarity?: () => void;
    __clarityLoaded?: number;
  };

  router.afterEach((to) => {
    if (isAdmin(to.path)) {
      w.clarity?.('stop');
    } else if (!w.__clarityLoaded) {
      w.__loadClarity?.();
    }
  });
});
