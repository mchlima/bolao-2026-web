<script setup lang="ts">
import type {
  Match,
  Paginated,
  Prediction,
  RankingResponse,
  Tournament,
} from '~/types/api';

const auth = useAuthStore();
const tz = useTz();
const now = useNow(30000); // ticks → buckets roll over at midnight / kickoff

const { data, pending, refresh } = await useAsyncData('home', async () => {
  const api = useApi();
  const list = await api<Paginated<Tournament>>('/seasons');
  const tournaments = list.data;
  const primary =
    tournaments.find((t) => t.status === 'ONGOING') ?? tournaments[0] ?? null;

  let me: RankingResponse['currentUser'] = null;
  let scheduled: Match[] = [];
  let live: Match[] = [];
  let predictions: Prediction[] = [];

  if (primary) {
    const [rank, sched, liveRes] = await Promise.all([
      api<RankingResponse>(`/seasons/${primary.id}/ranking`).catch(() => null),
      api<Paginated<Match>>(
        `/matches?seasonId=${primary.id}&status=SCHEDULED&page=1&pageSize=100`,
      ),
      // LIVE fetched on its own so it shows even when deep in the bracket.
      api<Paginated<Match>>(
        `/matches?seasonId=${primary.id}&status=LIVE&page=1&pageSize=50`,
      ).catch(() => null),
    ]);
    me = rank?.currentUser ?? null;
    const hasTeams = (m: Match) => !!m.homeTeam && !!m.awayTeam;
    scheduled = sched.data.filter(hasTeams);
    live = (liveRes?.data ?? []).filter(hasTeams);
    predictions = await api<Prediction[]>(
      `/predictions/me?seasonId=${primary.id}`,
    ).catch(() => []);
  }
  return { primary, me, scheduled, live, predictions };
});

// ----- predictions map (so each card shows the user's current guess) -----
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

// ----- date bucketing in the account timezone -----
/** "YYYY-MM-DD" of a UTC instant as seen in `tz` (en-CA formats ISO-style). */
function zonedDay(iso: string | number, tzv: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tzv,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
/** Calendar +1 day on a YYYY-MM-DD string (DST-safe — pure date math). */
function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
const byKick = (a: Match, b: Match) =>
  new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();

interface Section {
  key: string;
  title: string;
  caption?: string;
  live?: boolean;
  matches: Match[];
}

const sections = computed<Section[]>(() => {
  const tzv = tz.value;
  const today = zonedDay(now.value, tzv);
  const tomorrow = nextDay(today);
  const sched = data.value?.scheduled ?? [];
  const live = [...(data.value?.live ?? [])].sort(byKick);
  const todayM = sched.filter((m) => zonedDay(m.kickoffAt, tzv) === today).sort(byKick);
  const tomorrowM = sched.filter((m) => zonedDay(m.kickoffAt, tzv) === tomorrow).sort(byKick);

  const out: Section[] = [];
  if (live.length) out.push({ key: 'live', title: 'Partidas ao vivo', live: true, matches: live });
  if (todayM.length) out.push({ key: 'today', title: 'Próximas de hoje', matches: todayM });
  if (tomorrowM.length) out.push({ key: 'tomorrow', title: 'Amanhã', matches: tomorrowM });

  // Fallback: nothing live/today/tomorrow → show the next scheduled matches so
  // the home is never empty between match days.
  if (!out.length) {
    const later = sched
      .filter((m) => zonedDay(m.kickoffAt, tzv) > tomorrow)
      .sort(byKick)
      .slice(0, 4);
    if (later.length) out.push({ key: 'later', title: 'Próximas partidas', matches: later });
  }
  return out;
});

const hasAnyMatch = computed(() => sections.value.length > 0);

const primaryId = computed(() => data.value?.primary?.id);
useRealtime(
  () => (primaryId.value ? [`tournament:${primaryId.value}`] : []),
  () => refresh(),
);

const firstName = computed(() => auth.user?.name?.trim().split(/\s+/)[0] ?? '');
</script>

<template>
  <div class="page">
    <SkeletonList v-if="pending && !data" variant="match" :count="3" />

    <template v-else>
      <!-- HERO -->
      <section v-if="data?.primary" class="hero">
        <div class="glow" aria-hidden="true" />
        <div class="hero-inner">
          <div class="hero-text">
            <span v-if="firstName" class="hello">Olá, {{ firstName }} 👋</span>
            <h1 class="font-display title">{{ data.primary.name }}</h1>
            <p class="sub">Faça seus palpites e dispute o topo do ranking.</p>
            <div class="cta">
              <NuxtLink :to="`/tournaments/${data.primary.id}`" class="btn btn-gold">Ver torneio</NuxtLink>
              <NuxtLink :to="`/tournaments/${data.primary.id}/ranking`" class="btn">Ver ranking</NuxtLink>
            </div>
          </div>
          <div v-if="data.me" class="stats">
            <div class="stat">
              <div class="font-numeric big gold">{{ data.me.rank }}º</div>
              <div class="cap">Sua posição</div>
            </div>
            <div class="stat">
              <div class="font-numeric big">{{ data.me.points }}</div>
              <div class="cap">Seus pontos</div>
            </div>
          </div>
        </div>
      </section>

      <!-- no tournament yet -->
      <section v-else class="empty-hero">
        <h1 class="font-display title">Bem-vindo ao bolão</h1>
        <p class="sub">Ainda não há torneios disponíveis. Volte em breve!</p>
        <NuxtLink to="/tournaments" class="btn btn-gold">Ver torneios</NuxtLink>
      </section>

      <!-- HELP CTA -->
      <NuxtLink to="/howto" class="cta-help">
        <div class="cta-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><path d="M12 17h.01"/></svg>
        </div>
        <div class="cta-text">
          <h3 class="font-display cta-title">Novo por aqui?</h3>
          <p class="cta-sub">Entenda como pontuar e dispute o topo do ranking.</p>
        </div>
        <span class="cta-go">Como funciona <span aria-hidden="true">→</span></span>
      </NuxtLink>

      <!-- MATCH SECTIONS: ao vivo / hoje / amanhã -->
      <section v-for="s in sections" :key="s.key" class="msec">
        <div class="sec-head">
          <h2 class="font-display" :class="{ liveh: s.live }">
            <span v-if="s.live" class="live-dot" aria-hidden="true" />
            {{ s.title }}
            <span class="count">{{ s.matches.length }}</span>
          </h2>
          <NuxtLink v-if="data?.primary" :to="`/tournaments/${data.primary.id}`" class="see-all">Ver todas ›</NuxtLink>
        </div>
        <div class="matchlist">
          <MatchCard
            v-for="m in s.matches"
            :key="m.id"
            :match="m"
            :prediction="predMap[m.id] ?? null"
            @saved="onSaved"
          />
        </div>
      </section>

      <!-- empty state when a tournament exists but no matches are near -->
      <div v-if="data?.primary && !hasAnyMatch" class="empty-matches card">
        <span class="em-emoji" aria-hidden="true">⚽️</span>
        <p>Nenhuma partida ao vivo ou agendada por enquanto.</p>
        <NuxtLink :to="`/tournaments/${data.primary.id}`" class="btn">Ver o torneio</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 22px 0 40px;
}
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.22), rgba(30, 127, 240, 0.2)), var(--bg-surface);
  box-shadow: var(--shadow);
  padding: clamp(20px, 4vw, 34px);
  margin-bottom: 22px;
}
.glow {
  position: absolute;
  right: -40px;
  top: -40px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 184, 30, 0.28), transparent 70%);
}
.hero-inner {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
}
.hero-text {
  min-width: 240px;
  flex: 1;
}
.hello {
  display: inline-block;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--azure);
  margin-bottom: 8px;
}
.title {
  font-weight: 700;
  font-size: clamp(26px, 5vw, 40px);
  text-transform: uppercase;
  line-height: 0.98;
  letter-spacing: 0.005em;
}
.sub {
  color: var(--muted);
  margin-top: 12px;
  font-size: 14.5px;
  max-width: 440px;
}
.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.stats {
  display: flex;
  gap: 14px;
}
.stat {
  text-align: center;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px 20px;
  min-width: 96px;
}
.big {
  font-size: 40px;
  line-height: 0.9;
}
.gold {
  color: var(--gold);
}
.cap {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.empty-hero {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--bg-surface);
  padding: clamp(28px, 6vw, 48px);
  text-align: center;
  margin-bottom: 26px;
}
.empty-hero .sub {
  margin: 12px auto 20px;
}

/* match sections */
.msec {
  margin-bottom: 28px;
}
.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.sec-head h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 600;
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.sec-head h2.liveh {
  color: var(--scarlet);
}
.count {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  font-family: 'Manrope', sans-serif;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  background: var(--bg-base);
  border: 1px solid var(--border);
}
.liveh .count {
  color: #fff;
  background: var(--scarlet);
  border-color: var(--scarlet);
}
.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 0 rgba(232, 54, 43, 0.6);
  animation: rec-pulse 1.4s ease-out infinite;
}
@keyframes rec-pulse {
  0% { box-shadow: 0 0 0 0 rgba(232, 54, 43, 0.6); }
  70% { box-shadow: 0 0 0 7px rgba(232, 54, 43, 0); }
  100% { box-shadow: 0 0 0 0 rgba(232, 54, 43, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; }
}
.see-all {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.see-all:hover {
  color: var(--text);
}
.matchlist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* empty matches */
.empty-matches {
  text-align: center;
  padding: 34px 20px;
}
.em-emoji {
  font-size: 30px;
  display: block;
  margin-bottom: 10px;
}
.empty-matches p {
  color: var(--muted);
  font-size: 14px;
  margin-bottom: 16px;
}

/* help CTA */
.cta-help {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 26px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--gold) 32%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 12%, var(--bg-surface)), var(--bg-surface));
  box-shadow: var(--shadow);
  transition: transform 0.15s, border-color 0.15s;
}
.cta-help:hover {
  transform: translateY(-2px);
  border-color: var(--gold);
}
.cta-icon {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: #0a0e14;
  background: var(--gold);
}
.cta-text {
  flex: 1;
  min-width: 0;
}
.cta-title {
  font-weight: 700;
  font-size: 17px;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  line-height: 1.1;
}
.cta-sub {
  color: var(--muted);
  font-size: 13.5px;
  margin-top: 3px;
}
.cta-go {
  flex: 0 0 auto;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 13.5px;
  letter-spacing: 0.03em;
  color: var(--gold);
  white-space: nowrap;
}
@media (max-width: 520px) {
  .cta-go {
    display: none;
  }
}
</style>
