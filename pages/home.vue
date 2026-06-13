<script setup lang="ts">
import type {
  Match,
  Paginated,
  Prediction,
  RankingResponse,
  Tournament,
} from '~/types/api';

const auth = useAuthStore();

const { data, pending, refresh } = await useAsyncData('home', async () => {
  const api = useApi();
  const list = await api<Paginated<Tournament>>('/seasons');
  const tournaments = list.data;
  const primary =
    tournaments.find((t) => t.status === 'ONGOING') ?? tournaments[0] ?? null;

  let me: RankingResponse['currentUser'] = null;
  let openMatches: Match[] = [];
  let predictions: Prediction[] = [];

  if (primary) {
    const [rank, page1] = await Promise.all([
      api<RankingResponse>(`/seasons/${primary.id}/ranking`).catch(() => null),
      api<Paginated<Match>>(`/matches?seasonId=${primary.id}&page=1&pageSize=100`),
    ]);
    me = rank?.currentUser ?? null;
    predictions = await api<Prediction[]>(
      `/predictions/me?seasonId=${primary.id}`,
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
  return { primary, me, openMatches, predictions };
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

const primaryId = computed(() => data.value?.primary?.id);
useRealtime(
  () => (primaryId.value ? [`tournament:${primaryId.value}`] : []),
  () => refresh(),
);

const firstName = computed(
  () => auth.user?.name?.trim().split(/\s+/)[0] ?? '',
);
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

      <!-- no tournament yet -->
      <section v-else class="empty-hero">
        <h1 class="font-display title">Bem-vindo ao bolão</h1>
        <p class="sub">Ainda não há torneios disponíveis. Volte em breve!</p>
        <NuxtLink to="/tournaments" class="btn btn-gold">Ver torneios</NuxtLink>
      </section>

      <!-- HELP CTA — points new users to the rules -->
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
