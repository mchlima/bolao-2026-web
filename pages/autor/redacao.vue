<script setup lang="ts">
import type { NewsCard, Paginated } from '~/types/api';

// Página da persona editorial "Redação Cravei" (autoria das matérias). Sinal de
// E-E-A-T pro Google News: byline com página de autor real (bio + matérias). Rota
// pública (ver guard.global). Lista as matérias recentes p/ não ser página fina.
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/autor/redacao`;

const { data } = await useAsyncData('autor-redacao-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=24'),
);
const items = computed<NewsCard[]>(() => data.value?.data ?? []);

const crumbs = [
  { name: 'Início', to: '/' },
  { name: 'Notícias', to: '/noticias' },
  { name: 'Redação Cravei' },
];

useSeoMeta({
  title: 'Redação Cravei — autores e cobertura de futebol',
  description:
    'A Redação Cravei é a equipe editorial por trás das notícias, prévias e resumos de jogos do Cravei. Veja as matérias mais recentes.',
  ogTitle: 'Redação Cravei',
  ogDescription:
    'Equipe editorial do Cravei: notícias, prévias e resumos dos principais campeonatos do futebol.',
  ogUrl: url,
  ogType: 'profile',
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-autor',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ProfilePage',
            url,
            inLanguage: 'pt-BR',
            mainEntity: {
              '@type': 'Organization',
              name: 'Redação Cravei',
              url,
              logo: { '@type': 'ImageObject', url: `${siteUrl}/pwa-512x512.png` },
              description:
                'Equipe editorial do Cravei, responsável pelas notícias, prévias e resumos de jogos do portal.',
              parentOrganization: { '@type': 'Organization', name: 'Cravei', url: siteUrl },
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Notícias', item: `${siteUrl}/noticias` },
              { '@type': 'ListItem', position: 3, name: 'Redação Cravei', item: url },
            ],
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <div class="page">
    <PageHero pillar="Autor" title="Redação Cravei" :crumbs="crumbs" />

    <div class="bio">
      <span class="bio-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z" /><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6" /></svg>
      </span>
      <p>
        A <strong>Redação Cravei</strong> é a equipe editorial por trás das notícias, prévias e
        resumos de jogos do portal. Cobrimos os principais campeonatos do futebol brasileiro e
        mundial, combinando dados ao vivo das partidas com edição humana. Nosso compromisso é com
        informação clara, rápida e correta — do apito inicial ao placar final. Saiba mais
        <NuxtLink to="/sobre">sobre o Cravei e nossa política editorial</NuxtLink>.
      </p>
    </div>

    <section v-if="items.length" class="recent">
      <h2 class="rt">Últimas matérias</h2>
      <NewsCardList :items="items" />
    </section>
    <p v-else class="empty">Ainda não há matérias publicadas.</p>
  </div>
</template>

<style scoped>
.page { width: 100%; padding: 8px 16px 48px; }
.bio { max-width: 760px; margin: 4px auto 36px; display: flex; gap: 14px; align-items: flex-start; }
.bio-mark { flex: none; width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #ffb020, #ff7a59); display: grid; place-items: center; }
.bio p { font-size: var(--fs-base); line-height: 1.75; color: var(--text); margin: 0; }
.bio a { color: var(--azure); font-weight: 600; text-decoration: none; }
.bio a:hover { text-decoration: underline; }
.recent { margin-top: 8px; }
.rt { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xl); font-weight: 700; margin: 0 0 18px; }
.empty { max-width: 760px; margin: 0 auto; color: var(--muted); }
</style>
