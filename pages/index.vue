<script setup lang="ts">
import type {
  Match,
  Paginated,
  Prediction,
  RankingResponse,
  Tournament,
} from '~/types/api';

const auth = useAuthStore();

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'var(--muted)' },
  UPCOMING: { label: 'Em breve', color: 'var(--azure)' },
  ONGOING: { label: 'Em andamento', color: 'var(--emerald)' },
  FINISHED: { label: 'Encerrado', color: 'var(--muted)' },
};
const GRADS = ['var(--grad-pitch)', 'var(--grad-trophy)', 'var(--grad-live)'];

function tBadge(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^fifa$/i.test(w) && !/^\d+$/.test(w));
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
}

const { data, pending, refresh } = await useAsyncData('home', async () => {
  const api = useApi();
  const list = await api<Paginated<Tournament>>('/tournaments');
  const tournaments = list.data;
  const primary =
    tournaments.find((t) => t.status === 'ONGOING') ?? tournaments[0] ?? null;

  let me: RankingResponse['currentUser'] = null;
  let openMatches: Match[] = [];
  let predictions: Prediction[] = [];

  if (primary) {
    const [rank, page1] = await Promise.all([
      api<RankingResponse>(`/tournaments/${primary.id}/ranking`).catch(() => null),
      api<Paginated<Match>>(`/matches?tournamentId=${primary.id}&page=1&pageSize=100`),
    ]);
    me = rank?.currentUser ?? null;
    predictions = await api<Prediction[]>(
      `/predictions/me?tournamentId=${primary.id}`,
    ).catch(() => []);
    const now = Date.now();
    openMatches = page1.data
      .filter(
        (m) =>
          m.homeTeam &&
          m.awayTeam &&
          m.status === 'SCHEDULED' &&
          new Date(m.kickoffAt).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      )
      .slice(0, 3);
  }
  return { tournaments, primary, me, openMatches, predictions };
});

const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

useRealtime(
  () => (data.value?.tournaments ?? []).map((t) => `tournament:${t.id}`),
  () => refresh(),
);

const firstName = computed(
  () => auth.user?.name?.trim().split(/\s+/)[0] ?? '',
);
</script>

<template>
  <div class="page">
    <!-- HERO -->
    <section v-if="data?.primary" class="hero">
      <div class="glow" aria-hidden="true" />
      <div class="hero-inner">
        <div class="hero-text">
          <span v-if="firstName" class="hello">Olá, {{ firstName }} 👋</span>
          <h1 class="font-display title">{{ data.primary.name }}</h1>
          <p class="sub">
            Faça seus palpites e dispute o topo do ranking.
          </p>
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

    <!-- NEXT MATCHES TO PREDICT -->
    <template v-if="data?.openMatches?.length">
      <div class="sec-head">
        <h2 class="font-display">Próximas partidas</h2>
        <NuxtLink v-if="data.primary" :to="`/tournaments/${data.primary.id}`" class="see-all">Ver todas ›</NuxtLink>
      </div>
      <div class="next">
        <MatchCard
          v-for="m in data.openMatches"
          :key="m.id"
          :match="m"
          :prediction="predMap[m.id] ?? null"
          @saved="onSaved"
        />
      </div>
    </template>

    <!-- TOURNAMENTS -->
    <div class="sec-head">
      <h2 class="font-display">Torneios</h2>
    </div>
    <SkeletonList v-if="pending && !data" variant="card" :count="3" />
    <div v-else class="grid">
      <NuxtLink
        v-for="(t, i) in data?.tournaments ?? []"
        :key="t.id"
        :to="`/tournaments/${t.id}`"
        class="t-card"
      >
        <div class="t-top">
          <span class="t-badge font-display" :style="{ background: GRADS[i % GRADS.length] }">
            {{ tBadge(t.name) }}
          </span>
          <div class="t-info">
            <div class="t-name font-display">{{ t.name }}</div>
            <div v-if="t.startDate" class="t-dates">
              {{ formatDate(t.startDate, 'UTC') }} — {{ formatDate(t.endDate, 'UTC') }}
            </div>
          </div>
        </div>
        <div class="t-foot">
          <span
            class="pill"
            :style="{ color: (STATUS[t.status] ?? STATUS.DRAFT).color, borderColor: (STATUS[t.status] ?? STATUS.DRAFT).color }"
          >
            {{ (STATUS[t.status] ?? STATUS.DRAFT).label }}
          </span>
        </div>
      </NuxtLink>
    </div>
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
  margin-bottom: 26px;
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
.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.sec-head h2 {
  font-weight: 600;
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.see-all {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.see-all:hover {
  color: var(--text);
}
.next {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 30px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
}
.t-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
  transition: transform 0.15s, border-color 0.15s;
}
.t-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--emerald) 50%, var(--border));
}
.t-top {
  display: flex;
  align-items: center;
  gap: 13px;
}
.t-badge {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-weight: 700;
  color: #fff;
  font-size: 15px;
}
.t-info {
  min-width: 0;
  flex: 1;
}
.t-name {
  font-weight: 600;
  font-size: 16.5px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-dates {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 3px;
}
.t-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.pill {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 11px;
}
</style>
