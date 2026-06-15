<script setup lang="ts">
// Site-wide SEO defaults. Per-page useSeoMeta() calls override title/description
// and og:title/og:description; the OG image, card type and brand metadata below
// apply everywhere unless a page overrides them. The image is absolute so link
// unfurls (WhatsApp/Twitter — the invite channel) resolve it.
const ogImage = `${useRuntimeConfig().public.siteUrl}/og-cover.png`;
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
useHead({ meta: [{ name: 'theme-color', content: '#0A0E14' }] });
</script>

<template>
  <div>
    <VitePwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator :height="3" color="#0FB36B" :throttle="120" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
