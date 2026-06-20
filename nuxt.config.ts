// https://nuxt.com/docs/api/configuration/nuxt-config

// Google Analytics (GA4). Loaded only in production builds so dev traffic doesn't
// pollute the property. ID overridable via NUXT_PUBLIC_GTAG_ID at build time.
const GTAG_ID = process.env.NUXT_PUBLIC_GTAG_ID || 'G-9WDG5EDPWF';
const gtagScripts =
  process.env.NODE_ENV === 'production' && GTAG_ID
    ? [
        { src: `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`, async: true },
        {
          // Defines the global gtag(). Page views (incl. the initial one) are sent
          // by plugins/gtag.client.ts so it can skip the /admin back-office —
          // send_page_view:false stops gtag from auto-firing one here.
          children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GTAG_ID}',{send_page_view:false});`,
        },
      ]
    : [];

// Microsoft Clarity (session replay + heatmaps). Same gating as GA. The loader is
// wrapped in window.__loadClarity() and only auto-runs when the initial route is
// NOT /admin — the back-office is excluded. SPA transitions into /admin are paused
// by plugins/clarity.client.ts (Clarity self-restarts on pushState, so public
// routes resume on their own).
const CLARITY_ID = process.env.NUXT_PUBLIC_CLARITY_ID || 'x9n23dt4qp';
const clarityScripts =
  process.env.NODE_ENV === 'production' && CLARITY_ID
    ? [
        {
          children: `window.__loadClarity=function(){if(window.__clarityLoaded)return;window.__clarityLoaded=1;(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}")};(function(){var p=location.pathname;if(p!=="/admin"&&p.indexOf("/admin/")!==0){window.__loadClarity()}})();`,
        },
      ]
    : [];

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/color-mode', '@pinia/nuxt', '@vite-pwa/nuxt'],

  // PWA: installable app (Android "Instalar" prompt). Conservative service
  // worker for an SSR site — precache static assets only, navigations stay on
  // the network (no SPA fallback), SW disabled in dev so it never serves stale.
  pwa: {
    registerType: 'autoUpdate',
    // Custom service worker (injectManifest) so we can handle Web Push while
    // keeping precache + auto-update. SW source: service-worker/sw.ts.
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    injectManifest: {
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
    },
    manifest: {
      name: 'Cravei',
      short_name: 'Cravei',
      description: 'O bolão da Copa 2026 com a sua turma',
      lang: 'pt-BR',
      theme_color: '#0A0E14',
      background_color: '#0A0E14',
      display: 'standalone',
      orientation: 'portrait',
      id: '/',
      start_url: '/',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    client: {
      // Track the install prompt ourselves ($pwa.showInstallPrompt / install()).
      installPrompt: true,
      // Long-open sessions (an installed PWA kept open through a match) only pick
      // up a deploy on reload — client-side nav never reloads the JS. Poll the SW
      // for a new version every 30 min; with registerType 'autoUpdate' a found
      // update applies + reloads automatically. No-op when there's no new deploy,
      // so it only ever reloads right after we ship.
      periodicSyncForUpdates: 1800,
    },
    devOptions: {
      // SW disabled in dev so it never serves stale (prod build runs it). To test
      // Web Push locally, flip to: { enabled: true, type: 'module', suppressWarnings: true }.
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
      siteUrl: 'https://cravei.app',
      // Web Push VAPID public key (safe to expose). The API holds the matching
      // VAPID_PRIVATE_KEY in its env. Override here via NUXT_PUBLIC_VAPID_PUBLIC_KEY
      // if prod ever uses a different pair.
      vapidPublicKey:
        'BM5G2yXLusVKolVbgP6P42CcetINMAUBKb4EiERuxWjoLpyOKtJX4WthuPImMsSx2w95g_S0jiOkl5z2YUGKXVg',
      // Google Identity Services OAuth Client ID (público — embutido na página).
      // O mesmo client atende localhost:3001 e cravei.app (origens autorizadas no
      // Google Cloud). Override via NUXT_PUBLIC_GOOGLE_CLIENT_ID se necessário.
      googleClientId:
        '490721850065-9pqn9l5g9bgur6u4hs9ppee5vn2gbhuf.apps.googleusercontent.com',
    },
  },

  css: ['~/assets/css/main.css', '~/assets/css/admin.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Cravei',
      script: [...gtagScripts, ...clarityScripts],
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
