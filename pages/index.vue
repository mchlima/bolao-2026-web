<script setup lang="ts">
import type { FollowingView, Match, NewsCard, Paginated, Tournament } from '~/types/api';
// Home = capa editorial do portal (otimizada pro visitante anônimo/SEO): destaque
// do evento ao vivo (Copa), manchetes de notícias, jogos e campeonatos — com o
// bolão entrando como UMA faixa de CTA (a ferramenta tem casa própria em /boloes).
// A cascata de marketing antiga vive agora só na landing /bolao-da-copa-do-mundo-2026.
definePageMeta({ layout: 'default' });
const auth = useAuthStore();

// Portal: campeonatos em destaque + próximos jogos (cross-torneio) + manchetes.
const [{ data: torneios }, { data: hub, refresh: refreshHub }, { data: newsData }] = await Promise.all([
  useAsyncData('hub-torneios', () =>
    useApi()<Paginated<Tournament>>('/seasons?pageSize=20').then((r) => r.data),
  ),
  useAsyncData('hub-agenda', () =>
    useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=upcoming&limit=12'),
  ),
  useAsyncData('home-news', () =>
    useApi()<Paginated<NewsCard>>('/content/news?pageSize=7').then((r) => r.data).catch(() => [] as NewsCard[]),
  ),
]);
const news = computed<NewsCard[]>(() => newsData.value ?? []);

// "Seus jogos" (logado): agrupado por time seguido + partidas avulsas seguidas.
const { data: following, refresh: refreshMyMatches } = await useAsyncData('home-following', () =>
  auth.token
    ? useApi()<FollowingView>('/me/matches/following')
    : Promise.resolve({ teams: [], others: [], followedTeamCount: 0 } as FollowingView),
);
// Times seguidos alimentam só os canais de realtime (a seção "Seus jogos" saiu).
const followMatches = computed<Match[]>(() => [
  ...(following.value?.teams ?? []).flatMap((g) => g.matches),
  ...(following.value?.others ?? []),
]);

// O destaque (EventSpotlight) é o evento-âncora: a Copa do Mundo. Com mais de uma
// season ONGOING (ex.: a Libertadores também), preferir a Copa; senão a 1ª ONGOING.
const primarySeason = computed(() => {
  const list = torneios.value ?? [];
  return (
    list.find((t) => t.status === 'ONGOING' && /copa do mundo/i.test(t.name)) ??
    list.find((t) => t.status === 'ONGOING') ??
    list[0] ??
    null
  );
});
// Destaque do evento ao vivo só quando há torneio ONGOING (migra sozinho de evento).
const spotlightSeason = computed(() =>
  primarySeason.value && primarySeason.value.status === 'ONGOING' ? primarySeason.value : null,
);

// Live: re-fetch quando o robô emite gol/status nos torneios mostrados.
const liveChannels = computed(() => {
  const ids = new Set(
    (hub.value?.days ?? []).flatMap((d) => d.matches).map((m) => m.seasonId).filter(Boolean),
  );
  for (const m of followMatches.value) if (m.seasonId) ids.add(m.seasonId);
  if (primarySeason.value) ids.add(primarySeason.value.id);
  return [...ids].map((id) => `tournament:${id}`);
});
useRealtime(() => liveChannels.value, () => {
  refreshHub();
  refreshMyMatches();
});

const now = useNow();
const hubMatches = computed<Match[]>(() =>
  (hub.value?.days ?? [])
    .flatMap((d) => d.matches)
    .filter((m) => m.status !== 'POSTPONED')
    .sort(listingComparator(now.value))
    .slice(0, 6),
);
const liveCount = computed(
  () => (hub.value?.days ?? []).flatMap((d) => d.matches).filter((m) => m.status === 'LIVE').length,
);

// SEO — enquadramento de PORTAL, mantendo a keyword "bolão da Copa do Mundo 2026".
const title = 'Cravei · Notícias, jogos e o bolão da Copa do Mundo 2026';
const desc =
  'Notícias do futebol, agenda de jogos ao vivo e campeonatos — e o bolão da Copa do Mundo 2026 pra palpitar e disputar com os amigos. Placar ao vivo, escalações e ranking. Grátis.';
useSeoMeta({
  title,
  description: desc,
  ogTitle: title,
  ogDescription: desc,
  twitterTitle: title,
  twitterDescription: desc,
});
const siteUrl = String(useRuntimeConfig().public.siteUrl);
useHead({
  meta: [
    {
      name: 'keywords',
      content:
        'notícias de futebol, jogos de hoje, agenda de jogos, campeonatos, placar ao vivo, copa do mundo 2026, bolão da copa do mundo 2026, bolão online grátis, palpites copa do mundo, ranking ao vivo',
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: 'Cravei',
            url: siteUrl,
            logo: `${siteUrl}/pwa-512x512.png`,
            description:
              'Portal de futebol: notícias, jogos, campeonatos e o bolão da Copa do Mundo 2026.',
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: 'Cravei',
            url: siteUrl,
            inLanguage: 'pt-BR',
            publisher: { '@id': `${siteUrl}/#organization` },
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <div class="land-page">
    <InstallBanner />

    <!-- FAIXA DE BOLÃO no topo (o convite recorrente; a ferramenta tem casa própria) -->
    <section class="home-block">
      <BolaoCtaBand />
    </section>

    <!-- DESTAQUE DO EVENTO (Copa, quando ONGOING) — ímã de tráfego -->
    <section v-if="spotlightSeason" class="home-block">
      <EventSpotlight :season="spotlightSeason" />
    </section>

    <!-- PRÓXIMOS JOGOS -->
    <section v-if="hubMatches.length" class="hubstrip">
      <div class="hs-head">
        <h2 class="font-display">
          Próximos jogos
          <NuxtLink v-if="liveCount" to="/futebol/agenda?scope=live" class="hs-live"><span class="d" />{{ liveCount }} ao vivo</NuxtLink>
        </h2>
        <NuxtLink to="/futebol/agenda" class="hs-all">Agenda completa <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <MatchCard :matches="hubMatches" show-season />
    </section>

    <!-- CAMPEONATOS -->
    <section v-if="torneios?.length" class="hubnav-wrap">
      <div class="hubnav-head">
        <h2 class="font-display">Campeonatos</h2>
        <NuxtLink to="/futebol/campeonato" class="hubnav-all">Ver todos <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
      </div>
      <div class="hubnav">
        <NuxtLink v-for="t in torneios.slice(0, 4)" :key="t.id" :to="competitionHref(t.competition) ?? '/futebol/campeonato'" class="hubtile">
          <span class="ht-logo">
            <TournamentBadge :name="t.competition?.name ?? t.name" :logo-url="t.competition?.logoUrl" :logo-url-dark="t.competition?.logoUrlDark" :size="40" />
          </span>
          <b class="ht-name">{{ t.competition?.name ?? t.name }}</b>
          <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="ht-go" />
        </NuxtLink>
      </div>
    </section>

    <!-- MANCHETES — últimas notícias, abaixo dos campeonatos -->
    <section v-if="news.length" class="home-block manchetes">
      <div class="hs-head">
        <h2 class="font-display">Últimas notícias</h2>
        <NuxtLink to="/noticias" class="hs-all">Todas as notícias <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <NewsCardList :items="news" featured />
    </section>

  </div>
</template>

<style scoped>
.land-page { padding: 10px; }
.home-block { margin: 22px 0; }

/* logado: saudação + slider */
.welcome { margin: 4px 0 22px; }
.greet { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.greet-av { box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px color-mix(in srgb, var(--emerald) 55%, transparent); }
.greet-txt { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
.greet-hi { font-size: var(--fs-sm); font-weight: 600; color: var(--muted); letter-spacing: 0.01em; }
.greet-name { font-size: clamp(1.3125rem, 5.5vw, 1.625rem); font-weight: 800; line-height: 1.12; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* seção: cabeçalho com título + link "ver tudo" */
.hubstrip { margin: 14px 0; }
.mymatches { margin: 6px 0 18px; }
.mm-ic { color: var(--gold); }
.mm-ic.blue { color: var(--azure); }
.hs-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.hs-head h2 { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: clamp(1.125rem, 3vw, 1.5rem); text-transform: uppercase; }
.hs-live { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--scarlet); border: 1px solid var(--scarlet); border-radius: 999px; padding: 3px 9px; }
.hs-live .d { width: 6px; height: 6px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }
.hs-all { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-sm); font-weight: 700; color: var(--azure); white-space: nowrap; }

/* "Seus jogos" agrupado por time */
.mm-group + .mm-group { margin-top: 16px; }
.mm-team { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
.mm-team-nm { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.mm-team-ic { flex: none; display: grid; place-items: center; width: 22px; height: 22px; color: var(--gold); }
.mm-crave { display: inline-flex; align-items: center; gap: 3px; margin-top: 14px; font-size: var(--fs-sm); font-weight: 800; color: #0a0e14; background: var(--gold); border-radius: 999px; padding: 8px 15px; text-decoration: none; }

/* "Seus jogos" vazio — CTA pra escolher times */
.mm-cta { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 14px 16px; padding: 18px 20px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--emerald) 34%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 10%, var(--bg-surface)), var(--bg-surface) 70%); transition: border-color 0.15s, transform 0.15s; text-decoration: none; }
.mm-cta:hover { border-color: color-mix(in srgb, var(--emerald) 55%, var(--border)); transform: translateY(-1px); }
.mm-cta-ic { position: relative; flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--grad-pitch); color: #fff; }
.mm-cta-txt { position: relative; flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mm-cta-txt b { font-size: var(--fs-base); font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; color: var(--text); }
.mm-cta-txt span { font-size: var(--fs-sm); color: var(--muted); line-height: 1.5; }
.mm-cta-go { position: relative; flex: none; margin-left: auto; display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 11px 17px; border-radius: 11px; background: var(--gold); color: #0a0e14; font-size: var(--fs-sm); font-weight: 800; white-space: nowrap; }
@media (max-width: 520px) { .mm-cta-go { flex-basis: 100%; margin-left: 0; } }

/* "Seus jogos" vazio — segue times, mas sem jogo agendado */
.mm-rest { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-radius: 16px; border: 1px dashed var(--border); background: var(--bg-surface); }
.mm-rest-ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: color-mix(in srgb, var(--azure) 12%, transparent); color: var(--azure); }
.mm-rest-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mm-rest-txt b { font-size: var(--fs-sm); font-weight: 700; }
.mm-rest-txt span { font-size: var(--fs-xs); color: var(--muted); line-height: 1.5; }
.mm-rest-txt a { color: var(--azure); font-weight: 700; }

/* portal: campeonatos em destaque */
.hubnav-wrap { margin: 22px 0; }
.hubnav-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.hubnav-head h2 { font-weight: 600; font-size: clamp(1.125rem, 3vw, 1.5rem); text-transform: uppercase; }
.hubnav-all { display: inline-flex; align-items: center; gap: 2px; flex: none; font-size: var(--fs-sm); font-weight: 700; color: var(--azure); white-space: nowrap; }
.hubnav { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 560px) { .hubnav { grid-template-columns: repeat(2, 1fr); } }
.hubtile { display: flex; align-items: center; gap: 13px; padding: 14px 15px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg-surface); transition: border-color 0.14s, transform 0.14s, box-shadow 0.14s; }
.hubtile:hover { border-color: color-mix(in srgb, var(--azure) 40%, var(--border)); transform: translateY(-1px); box-shadow: var(--shadow); }
.ht-logo { flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 12px; background: var(--bg-base); border: 1px solid var(--border); }
.ht-name { flex: 1; min-width: 0; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: var(--fs-lg); line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ht-go { flex: none; color: var(--muted); }
@media (max-width: 420px) { .hubnav { gap: 8px; } .hubtile { padding: 12px; gap: 11px; } }

/* rodapé */
</style>
