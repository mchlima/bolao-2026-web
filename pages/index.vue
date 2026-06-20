<script setup lang="ts">
import type { FollowingView, Match, Paginated, Prediction, Tournament } from '~/types/api';
// Single home for everyone (default layout → AppHeader + bottom nav). Logged-out
// visitors also get the marketing pitch below the portal; logged-in users see
// just the portal (torneios + próximos jogos) — same início as the public one.
definePageMeta({ layout: 'default' });
const auth = useAuthStore();

// Portal: featured tournaments (quick access to each tournament's own hub) +
// cross-tournament next/live matches up top; the marketing pitch lives below.
// torneios + agenda são independentes — dispara os dois em paralelo no SSR
// (em série eram dois round-trips encadeados). standing fica fora: depende de
// primarySeason, derivado de torneios.
const [{ data: torneios }, { data: hub, refresh: refreshHub }] = await Promise.all([
  useAsyncData('hub-torneios', () =>
    useApi()<Paginated<Tournament>>('/seasons?pageSize=20').then((r) => r.data),
  ),
  useAsyncData('hub-agenda', async () => {
    const api = useApi();
    const [agenda, preds] = await Promise.all([
      // Only the next handful is rendered (strip shows ~6) — cap the payload
      // instead of pulling the entire upcoming list.
      api<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=upcoming&limit=12'),
      // The strip is palpitável when logged in — load the user's predictions to
      // seed the cards (so a saved guess shows instead of "Faça seu palpite").
      auth.token ? api<Prediction[]>('/predictions/me') : Promise.resolve([] as Prediction[]),
    ]);
    return { agenda, preds };
  }),
]);
// Prediction map for the strip cards (matchId → prediction); updated on save.
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of hub.value?.preds ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onPredSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

// "Seus jogos": agrupado por time — os 2 próximos jogos de cada time seguido
// (qualquer data) + as partidas seguidas avulsas. `followedTeamCount` (todos os
// times seguidos, mesmo sem jogo) define o estado vazio: segue nada → CTA pra
// escolher times; segue mas sem jogo agendado → aviso leve.
const { data: following, refresh: refreshMyMatches } = await useAsyncData('home-following', () =>
  auth.token
    ? useApi()<FollowingView>('/me/matches/following')
    : Promise.resolve({ teams: [], others: [], followedTeamCount: 0 } as FollowingView),
);
const followTeams = computed(() => following.value?.teams ?? []);
const followOthers = computed(() => following.value?.others ?? []);
const followedTeamCount = computed(() => following.value?.followedTeamCount ?? 0);
const hasFollowing = computed(() => followTeams.value.length > 0 || followOthers.value.length > 0);
// Flat list of every shown match — for live channel subscription.
const followMatches = computed<Match[]>(() => [
  ...followTeams.value.flatMap((g) => g.matches),
  ...followOthers.value,
]);

// Logged-in: a personal greeting + the member's standing slider (GERAL + pools,
// grouped by tournament). The slider (StandingHeroSlider) is self-contained: it
// fetches /me/standings and refreshes itself live.
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

// Live: the próximos-jogos strip + the standing must reflect goals/status changes.
// Subscribe to every tournament shown (strip matches + the primary season).
const liveChannels = computed(() => {
  const ids = new Set(
    (hub.value?.agenda.days ?? []).flatMap((d) => d.matches).map((m) => m.seasonId).filter(Boolean),
  );
  for (const m of followMatches.value) if (m.seasonId) ids.add(m.seasonId);
  if (primarySeason.value) ids.add(primarySeason.value.id);
  return [...ids].map((id) => `tournament:${id}`);
});
useRealtime(() => liveChannels.value, () => {
  refreshHub();
  refreshMyMatches();
});

// Quick badge from the tournament name (skip FIFA/years/short words).
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
// Postponed games carry a placeholder date and have no real kickoff — they'd
// crowd the top of "próximos jogos" without telling the visitor anything. Keep
// the strip to actual upcoming/live matches.
// Reactive clock so the strip re-sorts live (a match floats to the top the
// instant it kicks off, not only after a refetch).
const now = useNow();
const hubMatches = computed<Match[]>(() =>
  (hub.value?.agenda.days ?? [])
    .flatMap((d) => d.matches)
    .filter((m) => m.status !== 'POSTPONED')
    .sort(listingComparator(now.value))
    .slice(0, 6),
);
const liveCount = computed(
  () =>
    (hub.value?.agenda.days ?? [])
      .flatMap((d) => d.matches)
      .filter((m) => m.status === 'LIVE').length,
);

const desc =
  'Palpite nos 104 jogos da Copa 2026, crie bolões privados com os amigos e acompanhe o ranking mudar ao vivo a cada gol. Placares automáticos, classificação completa e pontuação por proximidade. Grátis.';
useSeoMeta({
  title: 'Cravei · O bolão da Copa 2026 com a sua turma',
  description: desc,
  ogTitle: 'Cravei · O bolão da Copa 2026 com a sua turma',
  ogDescription: desc,
});

// Números reais do torneio semeado.
const stats = [
  { v: '104', l: 'partidas' },
  { v: '48', l: 'seleções' },
  { v: '12', l: 'grupos' },
  { v: '16', l: 'sedes' },
];

const steps = [
  {
    n: '01',
    title: 'Crie ou entre num bolão',
    text: 'Monte um grupo com a turma e convide por um link. Seu palpite vale em todos os bolões que você participa.',
    color: 'var(--emerald)',
  },
  {
    n: '02',
    title: 'Crave os placares',
    text: 'Palpite o resultado de cada jogo antes do apito. Acertou quem ganha já pontua; quanto mais preciso o placar, mais vale.',
    color: 'var(--gold)',
  },
  {
    n: '03',
    title: 'Suba no ranking ao vivo',
    text: 'Acompanhe sua posição se mexer a cada gol, partida a partida, e dispute o topo com os amigos.',
    color: 'var(--azure)',
  },
];

// Mesma partida real (mandante 2 × 1 visitante), variando só o palpite — os
// tiers do modelo de pontuação (acertar o vencedor é a porta; quanto mais
// preciso, mais vale). Rótulos/cores iguais ao resto do app (utils/format).
const ladder = [
  { guess: '2:1', label: 'Cravou', pts: '25', color: 'var(--emerald)' },
  { guess: '2:0', label: 'Gols do vencedor', pts: '18', color: 'var(--azure)' },
  { guess: '3:2', label: 'Acertou o saldo', pts: '15', color: 'var(--gold)' },
  { guess: '4:1', label: 'Gols do perdedor', pts: '12', color: 'var(--scarlet)' },
  { guess: '5:3', label: 'Acertou o vencedor', pts: '10', color: 'var(--magenta)' },
  { guess: '1:2', label: 'Errou o vencedor', pts: '0', color: 'var(--muted)' },
];

const features = [
  {
    title: 'Bolões privados',
    text: 'Crie quantos bolões quiser e convide a galera por um link. Cada grupo tem o seu próprio ranking — só entre quem você conhece.',
    color: 'var(--emerald)',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    title: 'Tudo no automático',
    text: 'Os placares entram sozinhos, direto do feed oficial dos jogos. Ninguém precisa digitar resultado nem atualizar a página na mão.',
    color: 'var(--azure)',
    icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  },
  {
    title: 'Ao vivo de verdade',
    text: 'A cada gol, o placar e o seu ranking se mexem na tela na hora — sem recarregar. Sentiu o gol, sentiu a pontuação.',
    color: 'var(--scarlet)',
    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  },
  {
    title: 'Torneio completo',
    text: 'Grupos, classificação, mata-mata e os 8 melhores terceiros. Até o desempate por fair play, contando os cartões automaticamente.',
    color: 'var(--gold)',
    icon: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  },
  {
    title: 'Escudos e cores reais',
    text: 'Mais de 1.500 times com escudo e cores oficiais — das seleções aos clubes. Bonito de ver e fácil de reconhecer.',
    color: 'var(--magenta)',
    icon: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  },
  {
    title: 'Dois rankings, com pódio',
    text: 'Um do torneio inteiro e um de cada partida. Empatou? Quem palpitou primeiro fica na frente. Os palpites ficam à mostra pra todos.',
    color: 'var(--azure)',
    icon: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  },
];

const ranking = [
  { pos: 1, name: 'Você', pts: 84, you: true },
  { pos: 2, name: 'Rafa', pts: 81 },
  { pos: 3, name: 'Bia', pts: 79 },
];
</script>

<template>
  <div class="land-page">
    <!-- PWA: convite discreto p/ instalar (só aparece quando instalável) -->
    <InstallBanner />

    <!-- logado: saudação + sua posição/pontos no torneio principal -->
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

    <!-- SEUS JOGOS: sempre visível p/ logado — jogos da semana que ele segue, ou
         um CTA pra escolher times quando ainda não segue nada -->
    <section v-if="auth.isAuthenticated" class="hubstrip mymatches">
      <div class="hs-head">
        <h2 class="font-display"><AppIcon name="bell" :size="18" :stroke="2.2" class="mm-ic" />Seus jogos</h2>
        <NuxtLink v-if="hasFollowing" to="/meus-times" class="hs-all">Meus times <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>

      <!-- agrupado por time: cada time seguido + seus 2 próximos jogos -->
      <template v-if="hasFollowing">
        <div v-for="g in followTeams" :key="g.team.id" class="mm-group">
          <div class="mm-team">
            <TeamBadge :team="g.team" :size="22" />
            <span class="mm-team-nm">{{ g.team.name }}</span>
          </div>
          <div class="hs-grid">
            <MatchList :matches="g.matches" :predictions="predMap" show-season @saved="onPredSaved" />
          </div>
        </div>
        <!-- partidas seguidas avulsas (não cobertas por um time seguido) -->
        <div v-if="followOthers.length" class="mm-group">
          <div class="mm-team">
            <AppIcon name="star" :size="17" class="mm-team-ic" />
            <span class="mm-team-nm">Outros jogos que você segue</span>
          </div>
          <div class="hs-grid">
            <MatchList :matches="followOthers" :predictions="predMap" show-season @saved="onPredSaved" />
          </div>
        </div>
      </template>

      <!-- vazio + não segue nada: CTA chamativo pra escolher os times -->
      <NuxtLink v-else-if="!followedTeamCount" to="/meus-times" class="mm-cta">
        <span class="mm-cta-glow" aria-hidden="true" />
        <span class="mm-cta-ic"><AppIcon name="shield" :size="28" :stroke="2.1" /></span>
        <div class="mm-cta-txt">
          <b class="font-display">Siga os times do seu coração</b>
          <span>Escolha seus times e a gente te avisa quando eles entram em campo — pra palpitar antes do apito e acompanhar o jogo ao vivo.</span>
        </div>
        <span class="mm-cta-go">Escolher meus times <AppIcon name="chevronRight" :size="16" :stroke="2.6" /></span>
      </NuxtLink>

      <!-- vazio + já segue times, mas nenhum tem jogo agendado -->
      <div v-else class="mm-rest">
        <span class="mm-rest-ic"><AppIcon name="shield" :size="20" :stroke="2.1" /></span>
        <div class="mm-rest-txt">
          <b>Seus times não têm jogos agendados</b>
          <span>Assim que marcarem, eles aparecem aqui. Veja a <NuxtLink to="/futebol/agenda">agenda completa</NuxtLink> ou <NuxtLink to="/meus-times">ajuste seus times</NuxtLink>.</span>
        </div>
      </div>
    </section>

    <!-- PORTAL: torneios em destaque → cada um abre o hub próprio -->
    <section v-if="torneios?.length" class="hubnav-wrap">
      <div class="hubnav-head">
        <h2 class="font-display">Torneios</h2>
        <NuxtLink to="/futebol/torneios" class="hubnav-all">Ver todos <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
      </div>
      <div class="hubnav">
        <NuxtLink v-for="t in torneios.slice(0, 4)" :key="t.id" :to="`/futebol/torneios/${t.id}`" class="hubtile">
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

    <!-- HUB: jogos reais (público) — o placar é o anzol -->
    <section v-if="hubMatches.length" class="hubstrip">
      <div class="hs-head">
        <h2 class="font-display">
          Próximos jogos
          <NuxtLink v-if="liveCount" to="/futebol/agenda?scope=live" class="hs-live"><span class="d" />{{ liveCount }} ao vivo</NuxtLink>
        </h2>
        <NuxtLink to="/futebol/agenda" class="hs-all">Agenda completa <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <div class="hs-grid">
        <MatchList :matches="hubMatches" :predictions="predMap" show-season @saved="onPredSaved" />
      </div>
    </section>

    <!-- MARKETING — só para quem não está logado (logado vê só o portal acima) -->
    <template v-if="!auth.isAuthenticated">
    <!-- HERO -->
    <section class="hero">
      <div class="glow glow-a" aria-hidden="true" />
      <div class="glow glow-b" aria-hidden="true" />
      <div class="hero-grid">
        <div class="hero-text">
          <span class="eyebrow">Copa do Mundo FIFA · 2026</span>
          <h1 class="font-display title">
            O bolão da Copa<br />que a sua turma<br /><span class="hl">vai levar a sério</span>
          </h1>
          <p class="lead">
            Crave os placares dos 104 jogos, monte bolões privados com a galera e
            veja o ranking se mexer <b>ao vivo</b> a cada gol. Placares automáticos,
            classificação completa e pontuação que premia a precisão.
          </p>
          <div class="cta">
            <NuxtLink to="/cadastro" class="btn btn-gold big">Criar conta grátis</NuxtLink>
            <NuxtLink to="/entrar" class="btn big">Já tenho conta</NuxtLink>
          </div>
          <p class="trust">
            <span class="dot-ok" /> Grátis · sem app pra instalar · pronto em 1 minuto
          </p>
        </div>

        <div class="hero-art" aria-hidden="true">
          <!-- live match card -->
          <div class="card mock live">
            <div class="mock-top">
              <span class="mlbl">Grupo C · 2º tempo</span>
              <span class="mstatus"><span class="d" />Ao vivo</span>
            </div>
            <div class="mock-row">
              <div class="mteam"><span class="flag">🇧🇷</span><b>BRA</b></div>
              <div class="font-numeric mscore">2<span>:</span>1</div>
              <div class="mteam"><b>ARG</b><span class="flag">🇦🇷</span></div>
            </div>
            <div class="mock-foot">
              <span class="mchip">Seu palpite 2:1</span>
              <span class="mpts font-numeric">+25</span>
            </div>
          </div>

          <!-- floating ranking -->
          <div class="card mock rank">
            <span class="rk-cap">Ranking do bolão</span>
            <div v-for="r in ranking" :key="r.pos" class="rk-row" :class="{ me: r.you }">
              <span class="rk-pos" :class="`p${r.pos}`">{{ r.pos }}</span>
              <span class="rk-name">{{ r.name }}</span>
              <span class="rk-pts font-numeric">{{ r.pts }}</span>
            </div>
          </div>

          <span class="float-badge font-display">CRAVOU! <b>+25</b></span>
        </div>
      </div>

      <div class="stats">
        <div v-for="s in stats" :key="s.l" class="stat">
          <span class="font-numeric sv">{{ s.v }}</span>
          <span class="sl">{{ s.l }}</span>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="block">
      <h2 class="font-display sec-title">Em 3 passos</h2>
      <div class="steps">
        <div v-for="s in steps" :key="s.n" class="step card">
          <span class="font-display snum" :style="{ color: s.color }">{{ s.n }}</span>
          <h3>{{ s.title }}</h3>
          <p>{{ s.text }}</p>
        </div>
      </div>
    </section>

    <!-- SCORING -->
    <section class="block scoring">
      <div class="sc-head">
        <h2 class="font-display sec-title">Cravar é a glória</h2>
        <p class="sc-sub">
          Acertar quem ganha já garante pontos. A partir daí, quanto mais
          <b>preciso</b> for o seu placar, mais ele vale — até cravar. O mesmo
          jogo (<b>2 × 1</b>), do palpite perfeito ao furo:
        </p>
      </div>
      <div class="ladder">
        <div v-for="c in ladder" :key="c.guess" class="lad" :style="{ '--c': c.color }">
          <span class="lad-pts font-numeric">{{ c.pts }}</span>
          <span class="lad-guess font-numeric">{{ c.guess }}</span>
          <span class="lad-label">{{ c.label }}</span>
        </div>
      </div>
      <p class="sc-note">
        <span class="sc-star"><AppIcon name="star" :size="15" /></span> E no <b>mata-mata</b> cada acerto vale ainda
        mais — os pontos crescem a cada fase rumo à final.
      </p>
    </section>

    <!-- FEATURES -->
    <section class="block">
      <h2 class="font-display sec-title">Por que joga aqui</h2>
      <div class="feats">
        <div v-for="f in features" :key="f.title" class="feat card">
          <span class="fic" :style="{ color: f.color, background: `color-mix(in srgb, ${f.color} 14%, transparent)` }">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="f.icon" />
          </span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </div>
      </div>
    </section>

    <!-- POOLS HIGHLIGHT -->
    <section class="split">
      <div class="split-text">
        <span class="kicker">Bolões</span>
        <h2 class="font-display">Chame a galera. <span class="hl-e">Junto é melhor.</span></h2>
        <p>
          Crie um bolão do trabalho, da família, do grupo do churrasco — quantos
          quiser. Você palpita <b>uma vez</b> e a pontuação conta em todos os bolões
          que participa. Cada grupo tem o seu próprio ranking e ninguém de fora vê.
        </p>
        <ul class="checks">
          <li>Convite por link — entrou, já está dentro</li>
          <li>Ranking só entre os seus amigos</li>
          <li>Palpites à mostra: dá pra zoar quem furou</li>
        </ul>
        <NuxtLink to="/cadastro" class="btn btn-primary big">Criar meu bolão</NuxtLink>
      </div>
      <div class="split-art" aria-hidden="true">
        <div class="card pool">
          <div class="pool-top">
            <div>
              <span class="pool-name font-display">Galera do Trampo</span>
              <span class="pool-meta">12 participantes · privado</span>
            </div>
            <span class="pool-badge"><AppIcon name="trophy" :size="22" /></span>
          </div>
          <div class="pool-rk">
            <div v-for="r in ranking" :key="r.pos" class="rk-row" :class="{ me: r.you }">
              <span class="rk-pos" :class="`p${r.pos}`">{{ r.pos }}</span>
              <span class="rk-name">{{ r.name }}</span>
              <span class="rk-pts font-numeric">{{ r.pts }}</span>
            </div>
          </div>
          <div class="pool-invite">
            <span class="inv-ic">🔗</span>
            <span class="inv-link">amigos.bolao/entrar/x7k2</span>
            <span class="inv-copy">Copiar</span>
          </div>
        </div>
      </div>
    </section>

    <!-- LIVE BANNER -->
    <section class="livebanner">
      <div class="glow glow-live" aria-hidden="true" />
      <div class="lb-in">
        <span class="lb-tag"><span class="d" />Tempo real</span>
        <h2 class="font-display">O juiz apitou? O ranking já sabe.</h2>
        <p>
          Enquanto a bola rola, o placar entra sozinho e a sua pontuação muda a
          cada gol — provisória até o fim do jogo. Você acompanha a virada
          acontecer sem mexer um dedo.
        </p>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="final">
      <div class="glow glow-c" aria-hidden="true" />
      <h2 class="font-display">Bora cravar esse placar?</h2>
      <p>Crie sua conta, monte o bolão e chame a turma. Leva 1 minuto.</p>
      <div class="cta">
        <NuxtLink to="/cadastro" class="btn btn-gold big">Criar conta grátis</NuxtLink>
        <NuxtLink to="/entrar" class="btn big">Entrar</NuxtLink>
      </div>
    </section>

    <footer class="lfoot">
      Cravei · Copa do Mundo FIFA 2026
    </footer>
    </template>
  </div>
</template>

<style scoped>
.land-page {
  padding: 10px;
}
.welcome {
  margin: 4px 0 22px;
}
.greet {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.greet-av {
  box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px color-mix(in srgb, var(--emerald) 55%, transparent);
}
.greet-txt {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  min-width: 0;
}
.greet-hi {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.01em;
}
.greet-name {
  font-size: clamp(21px, 5.5vw, 26px);
  font-weight: 800;
  line-height: 1.12;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* portal: torneios em destaque — quick access to each tournament's hub */
.hubnav-wrap {
  margin: 6px 0 18px;
}
.hubnav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.hubnav-head h2 {
  font-weight: 600;
  font-size: clamp(18px, 3vw, 24px);
  text-transform: uppercase;
}
.hubnav-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  font-size: 13px;
  font-weight: 700;
  color: var(--azure);
  white-space: nowrap;
}
.hubnav {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 560px) {
  .hubnav {
    grid-template-columns: repeat(2, 1fr);
  }
}
.hubtile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-surface);
  transition: border-color 0.14s, transform 0.14s;
}
.hubtile:hover {
  border-color: color-mix(in srgb, var(--azure) 40%, var(--border));
  transform: translateY(-1px);
}
.ht-badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--grad-pitch);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}
.ht-stat {
  font-weight: 700;
}
.ht-txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ht-txt b {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ht-txt small {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ht-go {
  margin-left: auto;
  flex: none;
  color: var(--muted);
}
@media (max-width: 420px) {
  .hubnav {
    gap: 8px;
  }
  .hubtile {
    padding: 11px 12px;
    gap: 10px;
  }
  .ht-badge {
    width: 40px;
    height: 40px;
  }
}
/* hub strip — real matches on top of the public landing */
.hubstrip {
  margin: 14px 0 10px;
}
.mymatches {
  margin: 6px 0 18px;
}
.mm-ic {
  color: var(--gold);
}
/* "Seus jogos" agrupado por time */
.mm-group + .mm-group {
  margin-top: 16px;
}
.mm-team {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 9px;
}
.mm-team-nm {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.mm-team-ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: var(--gold);
}
/* "Seus jogos" vazio — CTA pra escolher times (chamativo) */
.mm-cta {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 16px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--emerald) 34%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 13%, transparent), color-mix(in srgb, var(--azure) 11%, transparent)), var(--bg-surface);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.mm-cta:hover {
  border-color: color-mix(in srgb, var(--emerald) 55%, var(--border));
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -18px color-mix(in srgb, var(--emerald) 90%, transparent);
}
.mm-cta-glow {
  position: absolute;
  width: 220px;
  height: 220px;
  right: -70px;
  top: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--gold) 24%, transparent), transparent 70%);
  pointer-events: none;
}
.mm-cta-ic {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: var(--grad-pitch);
  color: #fff;
  box-shadow: 0 10px 22px -10px color-mix(in srgb, var(--emerald) 80%, transparent);
}
.mm-cta-txt {
  position: relative;
  flex: 1 1 240px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.mm-cta-txt b {
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.01em;
}
.mm-cta-txt span {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}
.mm-cta-go {
  position: relative;
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 11px 17px;
  border-radius: 11px;
  background: var(--gold);
  color: #0a0e14;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
@media (max-width: 520px) {
  .mm-cta-go {
    flex-basis: 100%;
    margin-left: 0;
  }
}
/* "Seus jogos" vazio — segue times, mas nenhum joga nesta semana */
.mm-rest {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 18px;
  border-radius: 16px;
  border: 1px dashed var(--border);
  background: var(--bg-surface);
}
.mm-rest-ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--azure) 12%, transparent);
  color: var(--azure);
}
.mm-rest-txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mm-rest-txt b {
  font-size: 14px;
  font-weight: 700;
}
.mm-rest-txt span {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.5;
}
.mm-rest-txt a {
  color: var(--azure);
  font-weight: 700;
}
.hs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.hs-head h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: clamp(18px, 3vw, 24px);
  text-transform: uppercase;
}
.hs-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--scarlet);
  border: 1px solid var(--scarlet);
  border-radius: 999px;
  padding: 3px 9px;
}
.hs-live .d {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.1s ease-in-out infinite;
}
.hs-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--azure);
  white-space: nowrap;
}
.hs-grid {
  display: grid;
  gap: 10px;
}
.hl {
  color: var(--gold);
}
.hl-e {
  color: var(--emerald);
}

/* ===== hero ===== */
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.16), rgba(30, 127, 240, 0.14)), var(--bg-surface);
  padding: clamp(24px, 5vw, 52px);
  margin: 14px 0 34px;
}
.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(8px);
}
.glow-a {
  width: 340px;
  height: 340px;
  right: -90px;
  top: -100px;
  background: radial-gradient(circle, rgba(244, 184, 30, 0.26), transparent 70%);
  animation: spotShift 9s ease-in-out infinite;
}
.glow-b {
  width: 300px;
  height: 300px;
  left: -100px;
  bottom: -120px;
  background: radial-gradient(circle, rgba(15, 179, 107, 0.22), transparent 70%);
  animation: spotShift 11s ease-in-out infinite reverse;
}
.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: 36px;
}
.eyebrow {
  display: inline-block;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--azure);
  margin-bottom: 14px;
}
.title {
  font-weight: 700;
  font-size: clamp(34px, 6vw, 58px);
  line-height: 0.96;
  text-transform: uppercase;
}
.lead {
  margin-top: 18px;
  max-width: 480px;
  color: var(--muted);
  font-size: clamp(14px, 2.4vw, 16px);
  line-height: 1.6;
}
.lead b {
  color: var(--text);
}
.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 26px;
}
.btn.big {
  font-size: 15px;
  padding: 13px 22px;
}
.trust {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}
.dot-ok {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 10px 1px rgba(15, 179, 107, 0.6);
}

/* hero art */
.hero-art {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 280px;
}
.mock {
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow);
}
.mock.live {
  width: min(100%, 320px);
  transform: rotate(-2deg);
  border-color: color-mix(in srgb, var(--scarlet) 30%, var(--border));
}
.mock-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.mlbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.mstatus {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--scarlet);
  border: 1px solid var(--scarlet);
  border-radius: 999px;
  padding: 4px 9px;
}
.mstatus .d,
.lb-tag .d {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.1s ease-in-out infinite;
}
.mock-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}
.mteam {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;
}
.mteam:last-child {
  justify-content: flex-end;
}
.flag {
  font-size: 26px;
  line-height: 1;
}
.mscore {
  font-size: 42px;
  line-height: 0.8;
}
.mscore span {
  color: var(--muted);
  margin: 0 3px;
}
.mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mchip {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.mpts {
  font-size: 26px;
  line-height: 1;
  color: var(--emerald);
}

/* floating ranking card */
.mock.rank {
  position: absolute;
  right: -6px;
  bottom: -8px;
  width: 200px;
  padding: 12px 13px;
  transform: rotate(3deg);
  background: var(--bg-elevated);
}
.rk-cap {
  display: block;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 8px;
}
.rk-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
}
.rk-row.me {
  font-weight: 800;
}
.rk-pos {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 800;
  background: var(--bg-base);
  color: var(--muted);
}
.rk-pos.p1 {
  background: var(--gold);
  color: #0a0e14;
}
.rk-pos.p2 {
  background: #c7ccd4;
  color: #0a0e14;
}
.rk-pos.p3 {
  background: #d8924a;
  color: #0a0e14;
}
.rk-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-row.me .rk-name {
  color: var(--emerald);
}
.rk-pts {
  font-size: 17px;
  line-height: 1;
}
.float-badge {
  position: absolute;
  left: -8px;
  top: 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 10px;
  padding: 7px 12px;
  box-shadow: 0 10px 24px -10px rgba(244, 184, 30, 0.8);
  transform: rotate(-7deg);
  animation: ignite 2.6s ease-in-out infinite;
}
.float-badge b {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17px;
}

/* stats strip */
.stats {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: clamp(28px, 5vw, 44px);
  padding-top: 22px;
  border-top: 1px solid var(--border);
}
.stat {
  text-align: center;
}
.sv {
  display: block;
  font-size: clamp(28px, 5vw, 40px);
  line-height: 0.9;
  background: var(--grad-trophy);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sl {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

/* ===== sections ===== */
.block {
  margin: 44px 0;
}
.sec-title {
  font-weight: 600;
  font-size: clamp(20px, 3.5vw, 28px);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 18px;
}
.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
  gap: 14px;
}
.step {
  border-radius: 18px;
  padding: 24px;
}
.snum {
  font-size: 32px;
  font-weight: 700;
}
.step h3,
.feat h3 {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 17px;
  margin: 10px 0 6px;
}
.step p,
.feat p {
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.55;
}

/* scoring ladder */
.scoring {
  border-radius: 24px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  padding: clamp(22px, 4vw, 34px);
}
.sc-head {
  margin-bottom: 20px;
}
.sc-sub {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
  max-width: 560px;
  margin-top: 8px;
}
.sc-sub b {
  color: var(--text);
}
.ladder {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.lad {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--c) 40%, var(--border));
  background: color-mix(in srgb, var(--c) 8%, var(--bg-base));
  border-radius: 14px;
  padding: 16px 12px;
  text-align: center;
}
.lad-pts {
  display: block;
  font-size: 38px;
  line-height: 0.8;
  color: var(--c);
}
.lad-guess {
  display: block;
  font-size: 18px;
  letter-spacing: 0.06em;
  color: var(--text);
  margin: 8px 0 2px;
  opacity: 0.85;
}
.lad-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.sc-note {
  margin-top: 16px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}
.sc-note b {
  color: var(--text);
}
.sc-star {
  display: inline-flex;
  vertical-align: -3px;
  color: var(--gold);
}

/* features */
.feats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr));
  gap: 14px;
}
.feat {
  border-radius: 18px;
  padding: 22px;
}
.fic {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
}

/* ===== pools split ===== */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 36px;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.12), transparent 60%), var(--bg-surface);
  padding: clamp(24px, 4vw, 44px);
  margin: 44px 0;
}
.kicker {
  display: inline-block;
  background: color-mix(in srgb, var(--emerald) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--emerald) 40%, transparent);
  color: var(--emerald);
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.split-text h2 {
  font-weight: 700;
  font-size: clamp(24px, 4vw, 34px);
  text-transform: uppercase;
  line-height: 1;
}
.split-text > p {
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.6;
  margin: 14px 0;
  max-width: 460px;
}
.split-text b {
  color: var(--text);
}
.checks {
  list-style: none;
  margin: 0 0 22px;
  display: grid;
  gap: 9px;
}
.checks li {
  position: relative;
  padding-left: 26px;
  font-size: 13.5px;
  font-weight: 600;
}
.checks li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 1px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--emerald);
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 6 9 17l-5-5'/></svg>") center / 12px no-repeat,
    linear-gradient(#000, #000);
  -webkit-mask-composite: source-out;
  mask-composite: subtract;
}

/* pool mock */
.split-art {
  display: flex;
  justify-content: center;
}
.pool {
  width: min(100%, 340px);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
}
.pool-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.pool-name {
  display: block;
  font-weight: 700;
  font-size: 18px;
  text-transform: uppercase;
}
.pool-meta {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
.pool-badge {
  display: inline-flex;
  color: var(--gold);
}
.pool-rk {
  border-top: 1px solid var(--border);
  padding-top: 6px;
}
.pool-rk .rk-pts {
  font-size: 19px;
}
.pool-rk .rk-name {
  font-size: 14px;
}
.pool-invite {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--bg-base);
}
.inv-ic {
  font-size: 14px;
}
.inv-link {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-copy {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--emerald);
}

/* ===== live banner ===== */
.livebanner {
  position: relative;
  overflow: hidden;
  text-align: center;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--scarlet) 26%, var(--border));
  background: linear-gradient(135deg, rgba(232, 54, 43, 0.12), rgba(224, 33, 138, 0.1)), var(--bg-surface);
  padding: clamp(28px, 5vw, 46px) 20px;
  margin: 44px 0;
}
.glow-live {
  width: 360px;
  height: 360px;
  left: 50%;
  top: -130px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(232, 54, 43, 0.2), transparent 70%);
}
.lb-in {
  position: relative;
  max-width: 600px;
  margin: 0 auto;
}
.lb-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--scarlet);
  border: 1px solid var(--scarlet);
  border-radius: 999px;
  padding: 5px 12px;
  margin-bottom: 14px;
}
.livebanner h2 {
  font-weight: 700;
  font-size: clamp(22px, 4.5vw, 34px);
  text-transform: uppercase;
  line-height: 1.02;
}
.livebanner p {
  color: var(--muted);
  margin-top: 10px;
  font-size: 14.5px;
  line-height: 1.6;
}

/* ===== final cta ===== */
.final {
  position: relative;
  overflow: hidden;
  text-align: center;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(244, 184, 30, 0.14), rgba(224, 33, 138, 0.12)), var(--bg-surface);
  padding: clamp(30px, 6vw, 54px) 20px;
  margin: 44px 0 26px;
}
.glow-c {
  width: 340px;
  height: 340px;
  left: 50%;
  top: -120px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(244, 184, 30, 0.2), transparent 70%);
}
.final h2 {
  position: relative;
  font-weight: 700;
  font-size: clamp(24px, 5vw, 38px);
  text-transform: uppercase;
}
.final p {
  position: relative;
  color: var(--muted);
  margin-top: 8px;
  font-size: 15px;
}
.final .cta {
  position: relative;
  justify-content: center;
}
.lfoot {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  padding: 20px 0;
}

/* ===== responsive ===== */
@media (max-width: 860px) {
  .split {
    grid-template-columns: 1fr;
    gap: 26px;
  }
  .split-art {
    order: -1;
  }
}
@media (max-width: 760px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .hero-art {
    order: -1;
    min-height: 240px;
  }
  .mock.live {
    transform: none;
  }
}
@media (max-width: 820px) {
  .ladder {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 480px) {
  .ladder {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 440px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px 10px;
  }
}
</style>
