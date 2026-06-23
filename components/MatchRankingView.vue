<script setup lang="ts">
import type { Match, RankingResponse } from '~/types/api';

// Tournament-wide match companion. Responsibilities are split so the heavy ranking
// query doesn't run for viewers sitting on another tab:
//  • the hero/score (header, shown on EVERY tab) owns the match fetch → always live;
//  • the "bolão" tab owns the global ranking → refetched only while it's on screen.
// Both feed the shared MatchRankingBoard. Rendered standalone (/matches/:id) and
// inside the tournament layout (/tournaments/:id/matches/:matchId).
const props = withDefaults(
  defineProps<{ matchId: string; backLabel?: string; hideBack?: boolean }>(),
  { backLabel: 'Voltar', hideBack: false },
);
const emit = defineEmits<{ back: [] }>();
const api = useApi();

// Hero/score: the header is visible on every tab, so its stream stays always-on.
const { data: match, pending, error, refresh: refreshMatch } = await useAsyncData(
  `match-${props.matchId}`,
  () => api<Match>(`/matches/${props.matchId}`),
);
useRealtime(() => [`match:${props.matchId}`], () => refreshMatch());

// Ranking: a heavy aggregate (every prediction) — only live while "bolão" is open.
const bolaoActive = ref(true);
const { data: ranking, refresh: refreshRanking } = await useAsyncData(
  `ranking-${props.matchId}`,
  () => api<RankingResponse>(`/matches/${props.matchId}/ranking`),
);
useRealtime(
  () => (bolaoActive.value ? [`match:${props.matchId}`] : []),
  () => refreshRanking(),
);
watch(bolaoActive, (a) => {
  if (a) refreshRanking();
});

// A user-driven change (saving a palpite) updates the ranking; refresh both so the
// header (provisional points) and the table stay in sync.
function onRefresh() {
  refreshMatch();
  refreshRanking();
}

// Dynamic SEO from the fetched match (covers /futebol/agenda/:id and the
// tournament-scoped match route, both of which render this component).
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const seoMatchup = computed(() => {
  const m = match.value;
  if (!m) return null;
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  return `${home} x ${away}`;
});
// O mesmo jogo é alcançável por /futebol/jogo/:slug e por rotas de torneio/bolão →
// um canonical único (slug de SEO, com fallback p/ id) pra não duplicar conteúdo.
const canonicalUrl = computed(() => {
  const m = match.value;
  if (!m) return siteUrl;
  return `${siteUrl}/futebol/jogo/${m.slug || m.id}`;
});
// ── Conteúdo SEO/GEO da partida ──────────────────────────────────────────────
// Cada jogo é um cluster de busca de alta intenção (horário, escalações, palpite,
// resultado). A página é app-like (board + abas); damos a ela texto factual SSR +
// FAQ pra (a) rankear nesse cluster e (b) virar fonte citável por IA. Tudo montado
// só com o que temos no banco — sem inventar dado (ex.: não afirmamos emissora).
const names = computed(() => {
  const m = match.value;
  const home = m?.homeTeam?.name ?? m?.homeSourceLabel ?? 'A definir';
  const away = m?.awayTeam?.name ?? m?.awaySourceLabel ?? 'A definir';
  return { home, away };
});
// Só vale a pena o bloco/FAQ quando há confronto de verdade (times ou rótulo do
// mata-mata "Vencedor Grupo A"); pula o "A definir x A definir".
const hasMatchup = computed(() => names.value.home !== 'A definir' || names.value.away !== 'A definir');
// Nome do torneio sem a marca "FIFA" (marca-segura no público; alinha com a
// landing "Copa do Mundo 2026").
const compName = computed(() =>
  (match.value?.season?.name ?? '').replace(/\bFIFA\b/gi, '').replace(/\s{2,}/g, ' ').trim(),
);
// Fase/rodada neutra. Grupo só quando é grupo de verdade (letra A–H ou "Grupo X");
// um "groupName" que é o próprio tier (ex.: "Série A") já está no nome do torneio,
// então não vira "rodada do Série A".
const phaseText = computed(() => {
  const m = match.value;
  if (!m) return '';
  const g = (m.groupName ?? '').trim();
  const groupLabel = /^[A-H]$/i.test(g) ? `Grupo ${g.toUpperCase()}` : /^grupo\b/i.test(g) ? g : '';
  const roundLabel = m.round?.name
    ? m.round.name
    : m.round?.number
      ? `${m.round.number}ª rodada`
      : m.phaseLabel ?? '';
  return [groupLabel, roundLabel].filter(Boolean).join(' · ');
});
// Linha de contexto (label, sem artigos → seguro de gênero): "Copa … · Grupo C".
const phaseAndComp = computed(() => [compName.value, phaseText.value].filter(Boolean).join(' · '));
const kickoffDateLong = computed(() =>
  match.value
    ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: DEFAULT_TZ }).format(new Date(match.value.kickoffAt))
    : '',
);
const kickoffTime = computed(() =>
  match.value
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_TZ }).format(new Date(match.value.kickoffAt))
    : '',
);
// Sem artigo antes do nome do estádio (gênero varia: "Arena", "Estádio",
// "Field"…) — quem usa prefixa com "em", que é neutro.
const venueText = computed(() => {
  const s = match.value?.stadium;
  if (!s) return '';
  return `${s.name}, ${s.city}${s.country ? `, ${s.country}` : ''}`;
});
const isFinished = computed(() => match.value?.status === 'FINISHED');
const isLive = computed(() => match.value?.status === 'LIVE');
// "Onde assistir": emissoras curadas na Season (nunca derivado da ESPN). Só faz
// sentido antes do apito (pré/ao vivo) — some quando o jogo encerra.
const broadcasters = computed(() => match.value?.season?.broadcasters ?? []);
const showWatch = computed(() => !isFinished.value && broadcasters.value.length > 0);
const broadcastersText = computed(() => broadcasters.value.map((b) => b.name).join(', '));
const watchOnYoutube = computed(() => broadcasters.value.some((b) => (b.url ?? '').includes('youtube')));
// "fica com" = neutro de gênero (serve "CazéTV", "Premiere", "Globo"…).
const watchPhrase = computed(() =>
  showWatch.value ? ` A transmissão fica com ${broadcastersText.value}${watchOnYoutube.value ? ', ao vivo no YouTube' : ''}.` : '',
);
const scoreLine = computed(() => {
  const m = match.value;
  if (!m || m.homeScore == null || m.awayScore == null) return '';
  return `${m.homeScore} x ${m.awayScore}`;
});
// Frase de resultado já com o vencedor resolvido (gênero-seguro).
const resultPhrase = computed(() => {
  const m = match.value;
  const { home, away } = names.value;
  if (!m || m.homeScore == null || m.awayScore == null) return '';
  const a = m.homeScore;
  const b = m.awayScore;
  if (a === b) return `${home} e ${away} empataram por ${a} a ${b}`;
  return a > b ? `${home} venceu ${away} por ${a} a ${b}` : `${away} venceu ${home} por ${b} a ${a}`;
});
// Parágrafo factual (varia por estado). Sem artigo antes de compName.
const aboutText = computed(() => {
  const m = match.value;
  if (!m) return '';
  const { home, away } = names.value;
  const at = venueText.value ? `, em ${venueText.value}` : '';
  if (isFinished.value && resultPhrase.value)
    return `${resultPhrase.value}, em ${kickoffDateLong.value}${at}. Confira como ficou o ranking do bolão e os palpites de cada participante, além das escalações, da linha do tempo lance a lance e das estatísticas completas da partida.`;
  if (isLive.value)
    return `${home} x ${away} está acontecendo agora${scoreLine.value ? ` — ${home} ${m.homeScore} x ${m.awayScore} ${away}` : ''}.${watchPhrase.value} Acompanhe o placar ao vivo, as escalações e o ranking do bolão se mexendo a cada gol, e veja os palpites de todo mundo na partida.`;
  return `${home} e ${away} se enfrentam em ${kickoffDateLong.value}, às ${kickoffTime.value} (horário de Brasília)${at}.${watchPhrase.value} Faça seu palpite no placar antes do apito e acompanhe a partida ao vivo no Cravei: escalações, linha do tempo lance a lance, estatísticas e o ranking do bolão atualizando a cada gol.`;
});
// FAQ — só perguntas que conseguimos responder com dado real.
const faqItems = computed(() => {
  const m = match.value;
  if (!m || !hasMatchup.value) return [] as { q: string; a: string }[];
  const { home, away } = names.value;
  const out: { q: string; a: string }[] = [];
  if (isFinished.value && resultPhrase.value) {
    out.push({ q: `Qual foi o resultado de ${home} x ${away}?`, a: `${resultPhrase.value}.` });
  } else {
    out.push({ q: `Que horas é ${home} x ${away}?`, a: `${home} x ${away} começa em ${kickoffDateLong.value}, às ${kickoffTime.value} (horário de Brasília).` });
  }
  if (venueText.value)
    out.push(
      isFinished.value
        ? { q: `Onde foi ${home} x ${away}?`, a: `A partida foi em ${venueText.value}.` }
        : { q: `Onde será ${home} x ${away}?`, a: `A partida será em ${venueText.value}.` },
    );
  if (phaseAndComp.value) out.push({ q: `Por qual competição é ${home} x ${away}?`, a: `${phaseAndComp.value}.` });
  if (showWatch.value) {
    const u = broadcasters.value.find((b) => b.url)?.url;
    out.push({
      q: `Onde assistir ${home} x ${away}?`,
      a: `A transmissão de ${home} x ${away} no Brasil fica com ${broadcastersText.value}${watchOnYoutube.value ? ', ao vivo no YouTube' : ''}${u ? ` (${u})` : ''}.`,
    });
  }
  out.push({
    q: `Como palpitar em ${home} x ${away}?`,
    a: `Crie ou entre num bolão grátis no Cravei, crave o placar antes do apito e pontue pela precisão do palpite. O ranking do bolão atualiza ao vivo a cada gol.`,
  });
  return out;
});

// H1 único da página (o hero é visual/escudos, então o h1 vive no topo do DOM,
// acessível) — keyword-rich e por estado, distinto do <title> pra não duplicar.
// É o principal sinal de tópico da página pro buscador e pra IA (GEO).
const seoH1 = computed(() => {
  const m = match.value;
  if (!m) return '';
  const { home, away } = names.value;
  const tail = compName.value ? ` | ${compName.value}` : '';
  if (isFinished.value && scoreLine.value)
    return `${home} ${m.homeScore} x ${m.awayScore} ${away}: resultado, ranking e palpites${tail}`;
  if (isLive.value)
    return `${home} x ${away} ao vivo: placar, escalações e ranking do bolão${tail}`;
  return `${home} x ${away}: palpite, prováveis escalações, retrospecto e onde assistir${tail}`;
});
const seoTitle = computed(() => {
  const m = match.value;
  if (!m) return 'Partida — Cravei';
  const { home, away } = names.value;
  const tail = compName.value ? ` — ${compName.value}` : '';
  if (isFinished.value && scoreLine.value) return `${home} ${m.homeScore} x ${m.awayScore} ${away}: resultado e ranking${tail}`;
  if (isLive.value) return `${home} x ${away} ao vivo: ${showWatch.value ? 'onde assistir, ' : ''}placar e ranking${tail}`;
  return `${home} x ${away}: ${showWatch.value ? 'horário, onde assistir e palpite' : 'horário, escalações e palpite'}${tail}`;
});
const seoDesc = computed(() => {
  const m = match.value;
  if (!m || !seoMatchup.value) return 'Palpites, placar ao vivo e ranking da partida.';
  const { home, away } = names.value;
  const ctx = phaseAndComp.value ? ` · ${phaseAndComp.value}` : '';
  if (isFinished.value && resultPhrase.value)
    return `${resultPhrase.value}${ctx}. Veja o ranking do bolão e os palpites de cada participante, com escalações e estatísticas da partida no Cravei.`;
  const when = kickoffDateLong.value ? `Começa ${kickoffDateLong.value}, às ${kickoffTime.value} (Brasília). ` : '';
  const watch = showWatch.value ? `Transmissão: ${broadcastersText.value}. ` : '';
  return `${home} x ${away}${ctx}. ${when}${watch}Veja a provável escalação, estatísticas e faça seu palpite no placar — ranking do bolão ao vivo a cada gol.`;
});
useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDesc.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDesc.value,
  ogUrl: () => canonicalUrl.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDesc.value,
});
// Structured data: SportsEvent (rich event result — teams, kickoff, venue) +
// BreadcrumbList (Início › Torneio › Jogo).
const matchJsonLd = computed(() => {
  const m = match.value;
  if (!m) return '';
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  const statusMap: Record<string, string> = {
    POSTPONED: 'EventPostponed',
    CANCELLED: 'EventCancelled',
  };
  const teams = [
    { '@type': 'SportsTeam', name: home, ...(m.homeTeam?.logoUrl ? { logo: m.homeTeam.logoUrl } : {}) },
    { '@type': 'SportsTeam', name: away, ...(m.awayTeam?.logoUrl ? { logo: m.awayTeam.logoUrl } : {}) },
  ];
  const images = [m.homeTeam?.logoUrl, m.awayTeam?.logoUrl, m.stadium?.photoUrl].filter(
    (u): u is string => !!u,
  );
  // Football matches run ~2h; gives schema.org a valid endDate (recommended field).
  const endDate = new Date(new Date(m.kickoffAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const event: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${home} x ${away}`,
    sport: 'Soccer',
    startDate: m.kickoffAt,
    endDate,
    eventStatus: `https://schema.org/${statusMap[m.status] ?? 'EventScheduled'}`,
    url: canonicalUrl.value,
    description: `Palpite em ${home} x ${away}: placar ao vivo, escalações, estatísticas e ranking do bolão no Cravei.`,
    homeTeam: teams[0],
    awayTeam: teams[1],
    performer: teams,
    // Participation is free: a $0 Offer lets the event carry valid ticketing info
    // (the "ticket" is the palpite) without inventing a paid product.
    offers: {
      '@type': 'Offer',
      name: 'Palpite grátis',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl.value,
    },
    ...(images.length ? { image: images } : {}),
  };
  if (m.stadium) {
    event.location = {
      '@type': 'Place',
      name: m.stadium.name,
      address: [m.stadium.city, m.stadium.country].filter(Boolean).join(', '),
    };
  }
  // Organizer = the competition's governing body (FIFA, CBF, CONMEBOL…), already
  // persisted on the competition. Same entity organizes the match and the season.
  const org = m.season?.competition?.confederation;
  if (org) event.organizer = { '@type': 'SportsOrganization', name: org };
  // Tournament context as a valid nested SportsEvent (superEvent): the season's
  // name + dates + host location (season.location, falling back to the competition
  // country). Only emitted when we have the dates, so it never produces an
  // incomplete event.
  const s = m.season;
  if (s?.name && s.startDate) {
    const host = s.location ?? s.competition?.country ?? null;
    // URL DIRETA do campeonato (slug da competição), sem depender de redirect.
    const cSlug =
      s.competition?.urlSlug || (s.competition?.name ? competitionUrlSlug(s.competition.name) : s.slug);
    const seasonUrl = cSlug ? `${siteUrl}/futebol/campeonato/${cSlug}` : siteUrl;
    const superEvent: Record<string, unknown> = {
      '@type': 'SportsEvent',
      name: s.name,
      sport: 'Soccer',
      startDate: s.startDate,
      ...(s.endDate ? { endDate: s.endDate } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      url: seasonUrl,
      description: `${s.name}: tabela de jogos, classificação, palpites e ranking do bolão grátis no Cravei.`,
      ...(s.logoUrl ? { image: [s.logoUrl] } : {}),
      offers: {
        '@type': 'Offer',
        name: 'Palpite grátis',
        price: '0',
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url: seasonUrl,
      },
    };
    if (host) superEvent.location = { '@type': 'Place', name: host };
    if (org) superEvent.organizer = { '@type': 'SportsOrganization', name: org };
    // performer = the participating teams (national sides / clubs) of the season.
    const squads = (s.teams ?? [])
      .filter((t) => t.name)
      .map((t) => ({ '@type': 'SportsTeam', name: t.name, ...(t.logoUrl ? { logo: t.logoUrl } : {}) }));
    if (squads.length) superEvent.performer = squads;
    event.superEvent = superEvent;
  }
  const crumbs: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
  ];
  if (m.season?.slug && m.season?.name) {
    const cSlug =
      m.season.competition?.urlSlug ||
      (m.season.competition?.name ? competitionUrlSlug(m.season.competition.name) : m.season.slug);
    crumbs.push({
      '@type': 'ListItem',
      position: 2,
      name: m.season.name,
      item: `${siteUrl}/futebol/campeonato/${cSlug}`,
    });
  }
  crumbs.push({
    '@type': 'ListItem',
    position: crumbs.length + 1,
    name: `${home} x ${away}`,
    item: canonicalUrl.value,
  });
  const graph: Record<string, unknown>[] = [
    event,
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs },
  ];
  // FAQPage com as perguntas do cluster de busca da partida (horário, local,
  // competição, como palpitar) — reforça SEO e dá fatos citáveis pra IA.
  if (faqItems.value.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.value.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return JSON.stringify(graph);
});
useHead({
  link: [{ rel: 'canonical', key: 'canonical', href: () => canonicalUrl.value }],
  // Keyed 'ld-graph' to replace the tournament shell's breadcrumb on match routes.
  script: [{ key: 'ld-graph', type: 'application/ld+json', innerHTML: () => matchJsonLd.value }],
});
</script>

<template>
  <div class="mfill">
    <!-- H1 da página: matchup + intenção (keyword/GEO). Acessível no topo do DOM;
         o hero logo abaixo mostra o confronto visualmente (escudos + placar). -->
    <h1 v-if="match" class="sr-only">{{ seoH1 }}</h1>
    <SkeletonList v-if="pending && !match" variant="match" :count="1" />
    <p v-else-if="error || !match" class="muted load">Partida não encontrada.</p>
    <MatchRankingBoard
      v-else
      :match="match"
      :ranking="ranking"
      title="Ranking da partida"
      :back-label="backLabel"
      :hide-back="hideBack"
      @back="emit('back')"
      @refresh="onRefresh"
      @tab="bolaoActive = $event === 'bolao'"
    >
      <template v-if="$slots.classificacao" #classificacao>
        <slot name="classificacao" />
      </template>
    </MatchRankingBoard>

    <!-- Prévia do jogo (só agendado): forma/H2H/tabela/artilheiros do nosso banco.
         Enriquece o estado pré-jogo (antes era só 1 parágrafo). Some quando começa. -->
    <MatchPreview v-if="match && hasMatchup && match.status === 'SCHEDULED'" :match-id="props.matchId" />

    <!-- Conteúdo SEO/GEO: texto factual + FAQ da partida (SSR, rastreável). Fica
         abaixo do board imersivo; serve ao buscador/IA e a quem rola pra ler. -->
    <section v-if="match && hasMatchup" class="match-seo">
      <div class="ms-in">
        <h2 class="ms-title">Tudo sobre {{ names.home }} x {{ names.away }}</h2>
        <p v-if="phaseAndComp || kickoffDateLong" class="ms-meta">
          <span v-if="phaseAndComp">{{ phaseAndComp }}</span>
          <span v-if="phaseAndComp && kickoffDateLong" class="ms-sep">·</span>
          <span v-if="kickoffDateLong">{{ kickoffDateLong }}<template v-if="!isFinished">, {{ kickoffTime }}</template></span>
        </p>
        <p class="ms-about">{{ aboutText }}</p>

        <p v-if="showWatch" class="ms-watch">
          <span class="ms-watch-l">Onde assistir:</span>
          <template v-for="(b, i) in broadcasters" :key="i">
            <a v-if="b.url" :href="b.url" target="_blank" rel="noopener">{{ b.name }}</a><span v-else>{{ b.name }}</span><span v-if="i < broadcasters.length - 1">, </span>
          </template>
          <span v-if="watchOnYoutube" class="ms-watch-yt">ao vivo no YouTube</span>
        </p>

        <div v-if="faqItems.length" class="ms-faq">
          <h3>Perguntas frequentes sobre {{ names.home }} x {{ names.away }}</h3>
          <details v-for="(f, i) in faqItems" :key="i">
            <summary>{{ f.q }}</summary>
            <p>{{ f.a }}</p>
          </details>
        </div>

        <nav class="ms-links">
          <NuxtLink v-if="match.season?.slug" :to="`/futebol/campeonato/${match.season.competition?.urlSlug || competitionUrlSlug(match.season.competition?.name || match.season.name)}`">Ver o campeonato</NuxtLink>
          <NuxtLink v-if="match.season?.slug && match.groupName" :to="`/futebol/campeonato/${match.season.competition?.urlSlug || competitionUrlSlug(match.season.competition?.name || match.season.name)}/tabela`">Tabela</NuxtLink>
          <NuxtLink to="/futebol/agenda">Agenda de jogos</NuxtLink>
          <NuxtLink to="/bolao-da-copa-do-mundo-2026">Como criar um bolão</NuxtLink>
        </nav>

        <BolaoCtaBand variant="inline" class="ms-cta" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.load { padding: 2rem 0; }
/* H1 acessível: lido por buscador/leitor de tela; o hero visual abaixo mostra o
   confronto (escudos/placar). Padrão para heroes baseados em imagem. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.ms-cta { margin-top: 24px; }

/* Bloco SEO/GEO abaixo do board. Surface neutra, largura de leitura confortável. */
.match-seo { border-top: 1px solid var(--border); background: var(--bg-base); padding: 28px 16px 40px; }
.ms-in { max-width: 720px; margin: 0 auto; }
.ms-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: clamp(20px, 4vw, 26px); text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 6px; }
.ms-meta { font-size: 12.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
.ms-sep { opacity: 0.6; }
.ms-about { font-size: 15.5px; line-height: 1.7; color: var(--text); margin: 0; }
.ms-watch { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 14px 0 0; font-size: 14.5px; }
.ms-watch-l { font-weight: 800; }
.ms-watch a { color: var(--azure); font-weight: 700; }
.ms-watch a:hover { text-decoration: underline; }
.ms-watch-yt { color: var(--muted); font-size: 13px; }
.ms-watch-yt::before { content: '· '; }
.ms-faq { margin-top: 26px; }
.ms-faq h3 { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 17px; text-transform: uppercase; margin: 0 0 12px; }
.ms-faq details { border: 1px solid var(--border); border-radius: 12px; background: var(--bg-surface); padding: 13px 15px; margin-bottom: 8px; }
.ms-faq summary { font-weight: 700; font-size: 14.5px; cursor: pointer; }
.ms-faq details p { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
.ms-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.ms-links a { font-size: 13px; font-weight: 700; color: var(--azure); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; transition: border-color 0.14s; }
.ms-links a:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
</style>
