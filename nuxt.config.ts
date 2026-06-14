// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/color-mode', '@pinia/nuxt', '@vite-pwa/nuxt'],

  // PWA: installable app (Android "Instalar" prompt). Conservative service
  // worker for an SSR site — precache static assets only, navigations stay on
  // the network (no SPA fallback), SW disabled in dev so it never serves stale.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Amigos do Bolão',
      short_name: 'Bolão',
      description: 'O bolão da Copa 2026 com a sua turma',
      lang: 'pt-BR',
      theme_color: '#0A0E14',
      background_color: '#0A0E14',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
      cleanupOutdatedCaches: true,
    },
    client: {
      // Track the install prompt ourselves ($pwa.showInstallPrompt / install()).
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
    },
  },

  // dark / light / system theme — writes <html data-theme="..."> so the design
  // system's html[data-theme] selectors apply (Claude Design handoff).
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    classSuffix: '',
    storageKey: 'bolao-color-mode',
  },

  runtimeConfig: {
    public: {
      // Overridden in prod by the NUXT_PUBLIC_API_BASE env var (Nuxt auto-maps
      // NUXT_PUBLIC_* onto runtimeConfig.public at runtime).
      apiBase: 'http://localhost:3000/api',
      // Canonical origin — used to build absolute URLs for OG/Twitter meta so
      // link unfurls (WhatsApp/Twitter — the main invite channel) resolve the
      // image. Override in prod via NUXT_PUBLIC_SITE_URL.
      siteUrl: 'https://bolao2026.kratinho.com.br',
    },
  },

  css: ['~/assets/css/main.css', '~/assets/css/admin.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Amigos do Bolão',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },
});
