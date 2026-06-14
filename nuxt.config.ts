// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/color-mode', '@pinia/nuxt'],

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
