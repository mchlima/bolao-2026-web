<script setup lang="ts">
// Site-wide SEO defaults. Per-page useSeoMeta() calls override title/description
// and og:title/og:description; the OG image, card type and brand metadata below
// apply everywhere unless a page overrides them. The image is absolute so link
// unfurls (WhatsApp/Twitter — the invite channel) resolve it.
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const route = useRoute();
const ogImage = `${siteUrl}/og-cover.png`;
useSeoMeta({
  ogType: 'website',
  ogSiteName: 'Cravei',
  ogLocale: 'pt_BR',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Cravei — o bolão da Copa 2026 com a sua turma',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
});
// Self-referencing canonical for every route (keyed so a page can override it —
// e.g. a match, reachable from two URLs, points both to one canonical).
useHead({
  meta: [{ name: 'theme-color', content: '#0A0E14' }],
  link: [{ rel: 'canonical', key: 'canonical', href: () => `${siteUrl}${route.path}` }],
});
</script>

<template>
  <div>
    <VitePwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator :height="4" color="#0FB36B" :throttle="90" :duration="2200" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
