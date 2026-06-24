<script setup lang="ts">
import type { Match, Paginated, Team } from '~/types/api';

// Hub de SEO por seleção/time: próximos jogos + resultados de um time, resolvido
// por slug (/futebol/selecoes/brasil). Mira "jogos do brasil na copa", "quando o
// brasil joga", "próximo jogo do brasil". Pública (prefixo /futebol/*).
const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/futebol/selecoes/${slug}`;

// Resolve o time pelo slug (404 se não existir).
const { data: team } = await useAsyncData(`team-${slug}`, () =>
  useApi()<Paginated<Team>>(`/teams?slug=${encodeURIComponent(slug)}&pageSize=1`).then((r) => r.data[0] ?? null),
);
if (!team.value) {
  throw createError({ statusCode: 404, statusMessage: 'Time não encontrado', fatal: true });
}
const t = team.value;

// Todos os jogos do time (mandante ou visitante), passados e futuros.
const { data: ag, refresh } = await useAsyncData(`team-matches-${t.id}`, () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?teamId=${t.id}&scope=all`),
);
const allMatches = computed<Match[]>(() => (ag.value?.days ?? []).flatMap((d) => d.matches));
const upcoming = computed(() =>
  allMatches.value
    .filter((m) => m.status !== 'FINISHED')
    .sort((a, b) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt)),
);
const results = computed(() =>
  allMatches.value
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => +new Date(b.kickoffAt) - +new Date(a.kickoffAt)),
);

// Torneio dominante (p/ o SEO) — quando todos os jogos são de uma só season.
const competition = computed(() => {
  const names = [...new Set(allMatches.value.map((m) => m.season?.name).filter(Boolean))] as string[];
  if (names.length !== 1) return '';
  return names[0].replace(/\bFIFA\b/gi, '').replace(/\s{2,}/g, ' ').trim();
});

// Realtime nos torneios dos jogos do time.
const liveChannels = computed(() =>
  [...new Set(allMatches.value.map((m) => m.seasonId).filter(Boolean))].map((s) => `tournament:${s}`),
);
useRealtime(() => liveChannels.value, () => refresh());


const seoTitle = computed(
  () => `${t.name}: próximos jogos, resultados e palpites${competition.value ? ` — ${competition.value}` : ''} | Cravei`,
);
const seoDesc = computed(
  () =>
    `Calendário de ${t.name}${competition.value ? ` na ${competition.value}` : ''}: próximos jogos, resultados, horários de Brasília e palpite em cada partida — ranking do bolão ao vivo a cada gol, no Cravei.`,
);
useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDesc.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDesc.value,
  ogUrl: url,
  ogType: 'website',
  ogImage: t.logoUrl || undefined,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDesc.value,
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-team',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'SportsTeam',
            name: t.name,
            sport: 'Soccer',
            url,
            ...(t.logoUrl ? { logo: t.logoUrl } : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Futebol', item: `${siteUrl}/futebol/agenda` },
              { '@type': 'ListItem', position: 3, name: t.name, item: url },
            ],
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <div class="sel">
    <PageHero
      pillar="Futebol"
      :title="t.name"
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Futebol', to: '/futebol' }, { name: 'Seleções', to: '/futebol/selecoes' }, { name: t.name }]"
    />

    <p class="sel-intro">
      Próximos jogos, resultados e horários (de Brasília) de <strong>{{ t.name }}</strong>.
      Crave seu palpite em cada partida e acompanhe o ranking ao vivo no seu
      <NuxtLink to="/bolao-da-copa-do-mundo-2026">bolão da Copa do Mundo 2026</NuxtLink>.
    </p>

    <section v-if="upcoming.length" class="sel-sec">
      <h2 class="font-display">Próximos jogos</h2>
      <MatchCard :matches="upcoming" show-season />
    </section>

    <section v-if="results.length" class="sel-sec">
      <h2 class="font-display">Resultados</h2>
      <MatchCard :matches="results" show-season />
    </section>

    <p v-if="!allMatches.length" class="muted sel-empty">
      Ainda não há jogos cadastrados para {{ t.name }}.
      <NuxtLink to="/futebol/agenda">Ver a agenda completa</NuxtLink>.
    </p>

    <nav class="sel-links">
      <NuxtLink to="/futebol/jogos-de-hoje">Jogos de hoje</NuxtLink>
      <NuxtLink to="/futebol/agenda">Agenda completa</NuxtLink>
      <NuxtLink to="/futebol/campeonato">Torneios</NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.sel { padding: 10px; }
.sel-intro { font-size: var(--fs-base); line-height: 1.6; color: var(--text); margin: 0 0 22px; }
.sel-intro a { color: var(--azure); text-decoration: none; font-weight: 600; }
.sel-intro a:hover { text-decoration: underline; }
.sel-intro strong { font-weight: 800; }
.sel-sec { margin-bottom: 26px; }
.sel-sec h2 { font-weight: 600; font-size: clamp(1.0625rem, 3vw, 1.3125rem); text-transform: uppercase; letter-spacing: 0.02em; margin: 0 0 12px; }
.sel-empty { padding: 1.5rem 0; }
.sel-empty a { color: var(--azure); font-weight: 600; }
.sel-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.sel-links a { font-size: var(--fs-sm); font-weight: 700; color: var(--azure); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; text-decoration: none; transition: border-color 0.14s; }
.sel-links a:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
</style>
