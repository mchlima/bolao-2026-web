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
const followTeams = computed(() => following.value?.teams ?? []);
const followOthers = computed(() => following.value?.others ?? []);
const followedTeamCount = computed(() => following.value?.followedTeamCount ?? 0);
const hasFollowing = computed(() => followTeams.value.length > 0 || followOthers.value.length > 0);
const followMatches = computed<Match[]>(() => [
  ...followTeams.value.flatMap((g) => g.matches),
  ...followOthers.value,
]);

// Logado: saudação + slider de posição (self-contido: busca /me/standings).
const firstName = computed(() => (auth.user?.name ?? '').trim().split(/\s+/)[0] ?? '');
const salute = computed(() => {
  const h = Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }),
  );
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
});
const primarySeason = computed(
  () => (torneios.value ?? []).find((t) => t.status === 'ONGOING') ?? (torneios.value ?? [])[0] ?? null,
);
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

function tBadge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}
const TSTATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Em breve', color: 'var(--muted)' },
  UPCOMING: { label: 'Em breve', color: 'var(--azure)' },
  ONGOING: { label: 'Em andamento', color: 'var(--emerald)' },
  FINISHED: { label: 'Encerrado', color: 'var(--muted)' },
};
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

    <!-- logado: saudação + sua posição/pontos -->
    <section v-if="auth.isAuthenticated" class="welcome">
      <div class="greet">
        <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="48" class="greet-av" />
        <div class="greet-txt">
          <span class="greet-hi">{{ salute }}</span>
          <span class="greet-name">{{ firstName || 'Bem-vindo' }}</span>
        </div>
      </div>
      <StandingHeroSlider />
    </section>

    <!-- SEUS JOGOS (logado): jogos dos times seguidos, ou CTA pra escolher times -->
    <section v-if="auth.isAuthenticated" class="hubstrip mymatches">
      <div class="hs-head">
        <h2 class="font-display"><AppIcon name="bell" :size="18" :stroke="2.2" class="mm-ic" />Seus jogos</h2>
        <NuxtLink v-if="hasFollowing" to="/meus-times" class="hs-all">Meus times <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>

      <template v-if="hasFollowing">
        <div v-for="g in followTeams" :key="g.team.id" class="mm-group">
          <div class="mm-team">
            <TeamBadge :team="g.team" :size="22" />
            <span class="mm-team-nm">{{ g.team.name }}</span>
          </div>
          <MatchCard :matches="g.matches" show-season />
        </div>
        <div v-if="followOthers.length" class="mm-group">
          <div class="mm-team">
            <AppIcon name="star" :size="17" class="mm-team-ic" />
            <span class="mm-team-nm">Outros jogos que você segue</span>
          </div>
          <MatchCard :matches="followOthers" show-season />
        </div>
        <NuxtLink to="/boloes/palpites" class="mm-crave">Palpites pendentes <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </template>

      <NuxtLink v-else-if="!followedTeamCount" to="/meus-times" class="mm-cta">
        <span class="mm-cta-ic"><AppIcon name="shield" :size="28" :stroke="2.1" /></span>
        <div class="mm-cta-txt">
          <b class="font-display">Siga os times do seu coração</b>
          <span>Escolha seus times e a gente te avisa quando eles entram em campo — pra palpitar antes do apito e acompanhar ao vivo.</span>
        </div>
        <span class="mm-cta-go">Escolher meus times <AppIcon name="chevronRight" :size="16" :stroke="2.6" /></span>
      </NuxtLink>

      <div v-else class="mm-rest">
        <span class="mm-rest-ic"><AppIcon name="shield" :size="20" :stroke="2.1" /></span>
        <div class="mm-rest-txt">
          <b>Seus times não têm jogos agendados</b>
          <span>Assim que marcarem, eles aparecem aqui. Veja a <NuxtLink to="/futebol/agenda">agenda completa</NuxtLink> ou <NuxtLink to="/meus-times">ajuste seus times</NuxtLink>.</span>
        </div>
      </div>
    </section>

    <!-- DESTAQUE DO EVENTO (Copa, quando ONGOING) — ímã de tráfego -->
    <section v-if="spotlightSeason" class="home-block">
      <EventSpotlight :season="spotlightSeason" />
    </section>

    <!-- MANCHETES (anônimo: no topo da capa) -->
    <section v-if="!auth.isAuthenticated && news.length" class="home-block manchetes">
      <div class="hs-head">
        <h2 class="font-display"><AppIcon name="news" :size="18" :stroke="2.1" class="mm-ic blue" />Últimas notícias</h2>
        <NuxtLink to="/noticias" class="hs-all">Todas as notícias <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <NewsCardList :items="news" featured />
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
        <NuxtLink to="/futebol/torneios" class="hubnav-all">Ver todos <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
      </div>
      <div class="hubnav">
        <NuxtLink v-for="t in torneios.slice(0, 4)" :key="t.id" :to="`/futebol/torneios/${t.slug ?? t.id}`" class="hubtile">
          <TournamentBadge :name="t.name" :logo-url="t.competition?.logoUrl" :logo-url-dark="t.competition?.logoUrlDark" :size="44" />
          <span class="ht-txt">
            <b>{{ t.name }}</b>
            <small>
              <span class="ht-stat" :style="{ color: (TSTATUS[t.status] ?? TSTATUS.UPCOMING).color }">{{ (TSTATUS[t.status] ?? TSTATUS.UPCOMING).label }}</span>
              <span v-if="t.matchCount != null"> · {{ t.matchCount }} jogos</span>
            </small>
          </span>
          <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="ht-go" />
        </NuxtLink>
      </div>
    </section>

    <!-- MANCHETES (logado: notícias mais abaixo) -->
    <section v-if="auth.isAuthenticated && news.length" class="home-block manchetes">
      <div class="hs-head">
        <h2 class="font-display"><AppIcon name="news" :size="18" :stroke="2.1" class="mm-ic blue" />Últimas notícias</h2>
        <NuxtLink to="/noticias" class="hs-all">Todas as notícias <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <NewsCardList :items="news" featured />
    </section>

    <!-- FAIXA DE BOLÃO (o convite recorrente; a ferramenta tem casa própria) -->
    <section class="home-block">
      <BolaoCtaBand />
    </section>

    <footer class="lfoot">
      <span class="lfoot-brand font-display">Cravei</span>
      <span class="lfoot-tag">Notícias, jogos e o bolão da Copa do Mundo 2026</span>
      <span class="lfoot-disc">
        Plataforma independente. Sem qualquer vínculo, patrocínio ou endosso da FIFA
        ou de entidades organizadoras. Marcas e nomes de competições citados pertencem
        aos seus respectivos titulares.
      </span>
    </footer>
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
.greet-hi { font-size: 13px; font-weight: 600; color: var(--muted); letter-spacing: 0.01em; }
.greet-name { font-size: clamp(21px, 5.5vw, 26px); font-weight: 800; line-height: 1.12; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* seção: cabeçalho com título + link "ver tudo" */
.hubstrip { margin: 14px 0; }
.mymatches { margin: 6px 0 18px; }
.mm-ic { color: var(--gold); }
.mm-ic.blue { color: var(--azure); }
.hs-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.hs-head h2 { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: clamp(18px, 3vw, 24px); text-transform: uppercase; }
.hs-live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--scarlet); border: 1px solid var(--scarlet); border-radius: 999px; padding: 3px 9px; }
.hs-live .d { width: 6px; height: 6px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }
.hs-all { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 700; color: var(--azure); white-space: nowrap; }

/* "Seus jogos" agrupado por time */
.mm-group + .mm-group { margin-top: 16px; }
.mm-team { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
.mm-team-nm { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.mm-team-ic { flex: none; display: grid; place-items: center; width: 22px; height: 22px; color: var(--gold); }
.mm-crave { display: inline-flex; align-items: center; gap: 3px; margin-top: 14px; font-size: 13px; font-weight: 800; color: #0a0e14; background: var(--gold); border-radius: 999px; padding: 8px 15px; text-decoration: none; }

/* "Seus jogos" vazio — CTA pra escolher times */
.mm-cta { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 14px 16px; padding: 18px 20px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--emerald) 34%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 10%, var(--bg-surface)), var(--bg-surface) 70%); transition: border-color 0.15s, transform 0.15s; text-decoration: none; }
.mm-cta:hover { border-color: color-mix(in srgb, var(--emerald) 55%, var(--border)); transform: translateY(-1px); }
.mm-cta-ic { position: relative; flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--grad-pitch); color: #fff; }
.mm-cta-txt { position: relative; flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mm-cta-txt b { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; color: var(--text); }
.mm-cta-txt span { font-size: 13px; color: var(--muted); line-height: 1.5; }
.mm-cta-go { position: relative; flex: none; margin-left: auto; display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 11px 17px; border-radius: 11px; background: var(--gold); color: #0a0e14; font-size: 13px; font-weight: 800; white-space: nowrap; }
@media (max-width: 520px) { .mm-cta-go { flex-basis: 100%; margin-left: 0; } }

/* "Seus jogos" vazio — segue times, mas sem jogo agendado */
.mm-rest { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-radius: 16px; border: 1px dashed var(--border); background: var(--bg-surface); }
.mm-rest-ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: color-mix(in srgb, var(--azure) 12%, transparent); color: var(--azure); }
.mm-rest-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mm-rest-txt b { font-size: 14px; font-weight: 700; }
.mm-rest-txt span { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
.mm-rest-txt a { color: var(--azure); font-weight: 700; }

/* portal: campeonatos em destaque */
.hubnav-wrap { margin: 22px 0; }
.hubnav-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.hubnav-head h2 { font-weight: 600; font-size: clamp(18px, 3vw, 24px); text-transform: uppercase; }
.hubnav-all { display: inline-flex; align-items: center; gap: 2px; flex: none; font-size: 13px; font-weight: 700; color: var(--azure); white-space: nowrap; }
.hubnav { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 560px) { .hubnav { grid-template-columns: repeat(2, 1fr); } }
.hubtile { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg-surface); transition: border-color 0.14s, transform 0.14s; }
.hubtile:hover { border-color: color-mix(in srgb, var(--azure) 40%, var(--border)); transform: translateY(-1px); }
.ht-stat { font-weight: 700; }
.ht-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ht-txt b { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ht-txt small { font-size: 11.5px; color: var(--muted); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ht-go { margin-left: auto; flex: none; color: var(--muted); }
@media (max-width: 420px) { .hubnav { gap: 8px; } .hubtile { padding: 11px 12px; gap: 10px; } }

/* rodapé */
.lfoot { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; color: var(--muted); padding: 28px 0 14px; margin-top: 12px; border-top: 1px solid var(--border); }
.lfoot-brand { font-size: 18px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text); margin-top: 16px; }
.lfoot-tag { font-size: 12.5px; font-weight: 600; }
.lfoot-disc { max-width: 540px; margin-top: 8px; font-size: 11px; font-weight: 500; line-height: 1.5; opacity: 0.75; }
</style>
