<script setup lang="ts">
import type { Paginated, Team } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const listUrl = `${siteUrl}/futebol/selecoes`;

// Seleções nacionais com slug (linkáveis). Ordenadas por nome.
const { data: teams } = await useAsyncData('selecoes-index', () =>
  useApi()<Paginated<Team>>('/teams?type=NATIONAL_TEAM&pageSize=200&sort=name')
    .then((r) => (r.data ?? []).filter((t) => t.slug))
    .catch(() => [] as Team[]),
);

useSeoMeta({
  title: 'Seleções: próximos jogos, resultados e palpites — Cravei',
  description:
    'Acompanhe as seleções de futebol no Cravei: próximos jogos, resultados, escalações e onde assistir — e palpite no bolão da Copa do Mundo 2026.',
  ogTitle: 'Seleções de futebol — Cravei',
  ogDescription: 'Próximos jogos, resultados e palpites das seleções.',
  ogUrl: listUrl,
  ogType: 'website',
});
useHead({
  link: [{ rel: 'canonical', href: listUrl }],
  script: [
    {
      key: 'ld-selecoes',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Seleções de futebol',
          url: listUrl,
          isPartOf: { '@type': 'WebSite', name: 'Cravei', url: siteUrl },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Seleções', item: listUrl },
            ],
          },
        }),
    },
  ],
});
</script>

<template>
  <div class="sel-page">
    <FutebolSectionNav />

    <header class="sel-hero">
      <span class="kicker">Futebol</span>
      <h1>Seleções</h1>
      <p>Escolha uma seleção para ver próximos jogos, resultados e palpitar no bolão.</p>
    </header>

    <div v-if="teams?.length" class="sel-grid">
      <NuxtLink v-for="t in teams" :key="t.id" :to="`/futebol/selecoes/${t.slug}`" class="sel-card">
        <TeamBadge :team="t" :size="40" />
        <span class="sel-name">{{ t.name }}</span>
        <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="sel-go" />
      </NuxtLink>
    </div>

    <div v-else class="sel-empty">
      <AppIcon name="shield" :size="34" :stroke="1.6" />
      <h2>Nenhuma seleção disponível</h2>
      <p>Volte em breve.</p>
      <NuxtLink to="/futebol/agenda" class="btn btn-primary">Ver a agenda de jogos</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.sel-page { width: 100%; padding: 8px 16px 40px; }
.sel-hero { margin-bottom: 22px; }
.kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--azure); }
.sel-hero h1 { font-family: 'Oswald', sans-serif; font-size: clamp(28px, 6vw, 38px); font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 5px; }
.sel-hero p { color: var(--muted); font-size: 14.5px; line-height: 1.5; margin: 0; max-width: 60ch; }

.sel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.sel-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 14px; background: var(--bg-surface);
  text-decoration: none; color: var(--text);
  transition: border-color 0.14s, transform 0.14s;
}
.sel-card:hover { border-color: color-mix(in srgb, var(--azure) 40%, var(--border)); transform: translateY(-1px); }
.sel-name { flex: 1; min-width: 0; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sel-go { color: var(--muted); flex: none; }

.sel-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 64px 24px; text-align: center; color: var(--muted);
  border: 1px dashed var(--border); border-radius: 18px;
}
.sel-empty h2 { font-family: 'Oswald', sans-serif; font-size: 21px; font-weight: 700; color: var(--text); margin: 4px 0 0; }
.sel-empty p { font-size: 14px; margin: 0; }
.sel-empty .btn { margin-top: 8px; }
</style>
