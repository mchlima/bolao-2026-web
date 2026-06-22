<script setup lang="ts">
import type { Match } from '~/types/api';

// Hub de SEO "jogos de hoje" — captura a busca diária genérica ("jogos de hoje",
// "que jogos tem hoje na copa") com conteúdo + lista do dia (todos os torneios) e
// linka pras páginas de jogo. Pública (prefixo /futebol/* no guard).
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/futebol/jogos-de-hoje`;

function brtToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
// "sexta-feira, 20 de junho de 2026" (BRT) — pro título/intro.
const todayLong = computed(() => {
  const d = new Date(`${brtToday()}T12:00:00-03:00`);
  const s = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
});

const { data, pending, refresh } = await useAsyncData('jogos-hoje', () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=today'),
);
const matches = computed<Match[]>(() => (data.value?.days ?? []).flatMap((d) => d.matches));
const now = useNow();
const sorted = computed(() => [...matches.value].sort(listingComparator(now.value)));

// Realtime: re-fetch quando o robô emite gol/status nos torneios em jogo hoje.
const liveChannels = computed(() =>
  [...new Set(matches.value.map((m) => m.seasonId).filter(Boolean))].map((s) => `tournament:${s}`),
);
useRealtime(() => liveChannels.value, () => refresh());

const seoTitle = 'Jogos de hoje: horários, placar ao vivo e palpites | Cravei';
const seoDesc = computed(
  () =>
    `Todos os jogos de futebol de hoje (${todayLong.value}): horários de Brasília, placar ao vivo e palpite em cada partida — Copa do Mundo 2026 e outros campeonatos, no Cravei.`,
);
useSeoMeta({
  title: seoTitle,
  description: () => seoDesc.value,
  ogTitle: seoTitle,
  ogDescription: () => seoDesc.value,
  ogUrl: url,
  ogType: 'website',
  twitterTitle: seoTitle,
  twitterDescription: () => seoDesc.value,
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-breadcrumb',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Futebol', item: `${siteUrl}/futebol/agenda` },
          { '@type': 'ListItem', position: 3, name: 'Jogos de hoje', item: url },
        ],
      }),
    },
  ],
});
</script>

<template>
  <div class="jh">
    <FutebolSectionNav />
    <PageHero
      pillar="Futebol"
      title="Jogos de hoje"
      :subtitle="todayLong"
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Futebol', to: '/futebol' }, { name: 'Jogos de hoje' }]"
    />

    <SkeletonList v-if="pending && !data" variant="match" :count="4" />
    <div v-else-if="!matches.length" class="jh-empty">
      <p class="muted">Nenhum jogo programado para hoje.</p>
      <NuxtLink to="/futebol/agenda" class="btn">Ver a agenda completa <AppIcon name="arrowRight" :size="15" :stroke="2.4" /></NuxtLink>
    </div>
    <template v-else>
      <p class="jh-intro">
        São <strong>{{ matches.length }}</strong> {{ matches.length === 1 ? 'jogo' : 'jogos' }} hoje.
        Veja os horários (de Brasília), acompanhe o placar ao vivo e
        <strong>crave seu palpite</strong> em cada partida — vale pro ranking do seu
        <NuxtLink to="/bolao-da-copa-do-mundo-2026">bolão da Copa do Mundo 2026</NuxtLink>.
      </p>
      <MatchCard :matches="sorted" show-season />
      <div class="jh-more">
        <NuxtLink to="/futebol/agenda">Agenda completa</NuxtLink>
        <NuxtLink to="/futebol/campeonato">Torneios</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.jh { padding: 10px; }
.jh-intro { font-size: 15px; line-height: 1.6; color: var(--text); margin: 0 0 16px; }
.jh-intro a { color: var(--azure); text-decoration: none; font-weight: 600; }
.jh-intro a:hover { text-decoration: underline; }
.jh-intro strong { font-weight: 800; }
.jh-empty { padding: 2.5rem 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.jh-more { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
.jh-more a { font-size: 13px; font-weight: 700; color: var(--azure); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; text-decoration: none; transition: border-color 0.14s; }
.jh-more a:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
</style>
