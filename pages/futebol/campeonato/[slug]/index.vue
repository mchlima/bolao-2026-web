<script setup lang="ts">
// HUB do campeonato (rota-base): página editorial da temporada vigente — próximos
// jogos + últimas notícias + CTA bolão. NÃO é o shell de abas: "todos os jogos" e
// "tabela" são sub-rotas acessadas pelo menu (/jogos, /tabela).
import type { ActiveSeason, Competition, Match, NewsCard, Paginated } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);

const { data: comp } = useNuxtData<Competition & { activeSeason: ActiveSeason | null }>(`campeonato-${slug}`);
const season = computed(() => comp.value?.activeSeason ?? null);
const seasonId = computed(() => season.value?.id ?? '');
const seasonName = computed(() => season.value?.name ?? 'Campeonato');
// Nome da COMPETIÇÃO (estável, sem o ano) — usado no header/breadcrumb/CTA.
const compName = computed(() => comp.value?.name ?? seasonName.value);

// Próximos jogos da season (de hoje em diante + ao vivo).
const { data: agendaData, refresh: refreshAgenda } = await useAsyncData(
  `campeonato-hub-jogos-${slug}`,
  () =>
    seasonId.value
      ? useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?scope=upcoming&seasonId=${seasonId.value}`)
          .then((r) => r.days.flatMap((d) => d.matches))
          .catch(() => [] as Match[])
      : Promise.resolve([] as Match[]),
);
const upcoming = computed<Match[]>(() => (agendaData.value ?? []).slice(0, 5));

// Últimas notícias (capa geral — o pipeline ainda não filtra por competição).
const { data: newsData } = await useAsyncData(`campeonato-hub-news-${slug}`, () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=7')
    .then((r) => r.data)
    .catch(() => [] as NewsCard[]),
);
const news = computed<NewsCard[]>(() => newsData.value ?? []);

useRealtime(
  () => (seasonId.value ? [`tournament:${seasonId.value}`] : []),
  () => refreshAgenda(),
);

const hubUrl = `${siteUrl}/futebol/campeonato/${slug}`;
useSeoMeta({
  title: () => `${seasonName.value}: jogos, tabela e bolão | Cravei`,
  description: () =>
    `${seasonName.value} no Cravei: próximos jogos, tabela de classificação, últimas notícias e o bolão pra palpitar e disputar com a galera.`,
  ogTitle: () => `${seasonName.value} | Cravei`,
  ogDescription: () => `Jogos, tabela e bolão de ${seasonName.value}.`,
  ogUrl: hubUrl,
});
useHead({
  link: [{ rel: 'canonical', href: hubUrl }],
  script: [
    {
      key: 'ld-graph',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: seasonName.value,
          url: hubUrl,
          inLanguage: 'pt-BR',
          isPartOf: { '@type': 'WebSite', name: 'Cravei', url: siteUrl },
        }),
    },
  ],
});
</script>

<template>
  <div class="hub">
    <CompetitionHubHeader :comp="comp ?? null" :comp-name="compName" :slug="slug" />

    <section v-if="upcoming.length" class="hub-sec">
      <div class="sec-head">
        <h2 class="font-display">Próximos jogos</h2>
        <NuxtLink :to="`/futebol/campeonato/${slug}/jogos`" class="sec-all">
          Todos os jogos <AppIcon name="chevronRight" :size="14" :stroke="2.5" />
        </NuxtLink>
      </div>
      <MatchCard :matches="upcoming" show-season />
    </section>

    <section class="hub-sec">
      <BolaoCtaBand
        :headline="`Bolão de ${compName} com a galera`"
        sub="Palpite nos jogos, pontue pela precisão do placar e dispute o ranking ao vivo. Grátis."
        cta-label="Criar meu bolão"
        to="/boloes"
      />
    </section>

    <section v-if="news.length" class="hub-sec">
      <div class="sec-head">
        <h2 class="font-display">Últimas notícias</h2>
        <NuxtLink to="/noticias" class="sec-all">
          Todas as notícias <AppIcon name="chevronRight" :size="14" :stroke="2.5" />
        </NuxtLink>
      </div>
      <NewsCardList :items="news" featured />
    </section>
  </div>
</template>

<style scoped>
.hub {
  width: 100%;
  padding: 8px 16px 40px;
}
.hub-sec {
  margin: 26px 0;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.sec-head h2 {
  font-weight: 600;
  font-size: clamp(19px, 3vw, 26px);
  text-transform: uppercase;
}
.sec-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--azure);
  white-space: nowrap;
}
</style>
