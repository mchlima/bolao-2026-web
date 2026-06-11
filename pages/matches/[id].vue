<script setup lang="ts">
import type { Match, MatchRankingResponse } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `match-${id}`,
  async () => {
    const api = useApi();
    const [match, ranking] = await Promise.all([
      api<Match>(`/matches/${id}`),
      api<MatchRankingResponse>(`/matches/${id}/ranking`),
    ]);
    return { match, ranking };
  },
);

// Live polling: refresh score + provisional ranking while the match is LIVE.
const isLiveMatch = computed(() => data.value?.match?.status === 'LIVE');
useLivePolling(refresh, isLiveMatch, LIVE_POLL_MS);

const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  ONE_TEAM_SCORE: 'var(--azure)',
  GOAL_DIFF: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  NONE: 'var(--muted)',
};
const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['66px', '50px', '40px'];

const match = computed(() => data.value?.match ?? null);
const ranking = computed(() => data.value?.ranking ?? null);
const me = computed(() => ranking.value?.currentUser ?? null);
const hasResult = computed(() => !!ranking.value?.result);

const stateMeta = computed(() => {
  if (!ranking.value) return { label: '', color: 'var(--muted)', live: false };
  if (ranking.value.provisional)
    return { label: 'Provisório · ao vivo', color: 'var(--scarlet)', live: true };
  if (ranking.value.result)
    return { label: 'Resultado final', color: 'var(--emerald)', live: false };
  return { label: 'Aguardando resultado', color: 'var(--muted)', live: false };
});

const entries = computed(() => ranking.value?.entries ?? []);
// Podium only with a result and at least 3 participants (decision #5).
const top3 = computed(() =>
  hasResult.value && entries.value.length >= 3 ? entries.value.slice(0, 3) : [],
);
const rest = computed(() =>
  top3.value.length ? entries.value.slice(3) : entries.value,
);
const inTop = computed(
  () => !!me.value && entries.value.some((e) => e.user.id === me.value!.user.id),
);
const podium = computed(() =>
  [top3.value[1], top3.value[0], top3.value[2]]
    .map((e, i) => ({ e, slot: [1, 0, 2][i] }))
    .filter((x) => x.e),
);

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
function guess(e: { prediction?: { home: number; away: number } }): string {
  return e.prediction ? `${e.prediction.home}:${e.prediction.away}` : '—';
}
</script>

<template>
  <div class="page">
    <SkeletonList v-if="pending" variant="match" :count="1" />
    <p v-else-if="error || !match" class="muted load">Partida não encontrada.</p>
    <template v-else>
      <NuxtLink :to="`/tournaments/${match.tournamentId}`" class="back">← Voltar às partidas</NuxtLink>

      <!-- result card -->
      <div class="card detail">
        <div class="result-head">
          <div class="rlabel">{{ match.phaseLabel }}<span v-if="match.groupName"> · Grupo {{ match.groupName }}</span></div>
          <div class="result">
            <div class="side">
              <TeamBadge :team="match.homeTeam" :placeholder="match.homeSourceLabel" :size="60" />
              <span class="tname">{{ match.homeTeam?.name ?? match.homeSourceLabel }}</span>
            </div>
            <div class="font-numeric big">
              <span>{{ match.homeScore ?? '–' }}</span>
              <span class="colon">:</span>
              <span>{{ match.awayScore ?? '–' }}</span>
            </div>
            <div class="side">
              <TeamBadge :team="match.awayTeam" :placeholder="match.awaySourceLabel" :size="60" />
              <span class="tname">{{ match.awayTeam?.name ?? match.awaySourceLabel }}</span>
            </div>
          </div>
          <div v-if="match.stadium" class="venue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            {{ match.stadium.name }} · {{ match.stadium.city }}
          </div>
        </div>

        <div class="body">
          <!-- your prediction -->
          <div v-if="me?.prediction" class="mypred">
            <div class="mp-head">
              <span class="mp-title">Seu palpite</span>
              <span
                v-if="me.tier"
                class="tier ignite"
                :style="{ color: TIER_COLOR[me.tier], borderColor: TIER_COLOR[me.tier] }"
              >{{ tierLabel(me.tier) }}</span>
            </div>
            <div class="mp-score font-numeric">
              {{ me.prediction.home }} <span class="colon">:</span> {{ me.prediction.away }}
            </div>
            <div v-if="hasResult && me.tier" class="earned">
              Você fez <span class="font-numeric earned-pts" :style="{ color: TIER_COLOR[me.tier] }">+{{ me.points }}</span> pts nesta partida
            </div>
          </div>

          <!-- match ranking -->
          <div class="mrank">
            <div class="mr-head">
              <span class="mr-title">Ranking da partida</span>
              <span class="state" :class="{ live: stateMeta.live }" :style="{ color: stateMeta.color, borderColor: stateMeta.color }">
                <span v-if="stateMeta.live" class="dot" />{{ stateMeta.label }}
              </span>
            </div>
            <p class="mr-note">
              {{ ranking?.totalParticipants ?? 0 }} palpite(s).
              <template v-if="ranking?.provisional"> Pontuação provisória — muda com o placar.</template>
            </p>

            <div v-if="podium.length" class="podium">
              <div v-for="{ e, slot } in podium" :key="e.user.id" class="pcol">
                <div class="pav" :style="{ background: color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 18px -4px ${MEDALS[slot]}` }">{{ initials(e.user.name) }}</div>
                <div class="pname">{{ e.user.name }}</div>
                <div class="font-numeric pscore">{{ guess(e) }}</div>
                <div class="ppts" :style="{ color: MEDALS[slot] }">+{{ e.points }}</div>
                <div class="pbar" :style="{ height: HEIGHTS[slot], background: `linear-gradient(180deg, ${MEDALS[slot]}, transparent)` }">
                  <span class="font-numeric prank">{{ e.rank }}º</span>
                </div>
              </div>
            </div>

            <div class="rows">
              <div v-for="e in rest" :key="e.user.id" class="row" :class="{ me: me && e.user.id === me.user.id }">
                <span class="font-numeric pos">{{ e.rank }}</span>
                <div class="who">
                  <span class="av" :style="{ background: color(e.user.id) }">{{ initials(e.user.name) }}</span>
                  <span class="nm">{{ e.user.name }}</span>
                  <span v-if="me && e.user.id === me.user.id" class="youtag">Você</span>
                </div>
                <div class="rscore">
                  <span class="font-numeric">{{ guess(e) }}</span>
                  <span v-if="e.tier && hasResult" class="tier sm" :style="{ color: TIER_COLOR[e.tier], borderColor: TIER_COLOR[e.tier] }">{{ tierLabel(e.tier) }}</span>
                  <span v-if="hasResult" class="rp" :style="{ color: e.tier ? TIER_COLOR[e.tier] : 'var(--muted)' }">+{{ e.points }}</span>
                </div>
              </div>
            </div>

            <div v-if="me && !inTop" class="sticky">
              <div class="sticky-cap">Sua posição</div>
              <div class="row me big">
                <span class="font-numeric pos gold">{{ me.rank }}º</span>
                <div class="who">
                  <span class="av pitch">{{ initials(me.user.name) }}</span>
                  <span class="nm">{{ me.user.name }}</span>
                  <span class="youtag">Você</span>
                </div>
                <div class="rscore">
                  <span class="font-numeric">{{ guess(me) }}</span>
                  <span v-if="hasResult" class="rp gold">+{{ me.points }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
  max-width: 660px;
  margin: 0 auto;
}
.load {
  padding: 2rem 0;
}
.back {
  display: inline-block;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 16px;
}
.detail {
  border-radius: 20px;
  overflow: hidden;
}
.result-head {
  padding: 22px 20px;
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.16), rgba(30, 127, 240, 0.14));
}
.rlabel {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 18px;
}
.result {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}
.tname {
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.big {
  font-size: 58px;
  line-height: 0.8;
  display: flex;
  align-items: center;
  gap: 12px;
}
.colon {
  color: var(--muted);
}
.venue {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}
.body {
  padding: 20px;
}
.mypred {
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 12%, var(--bg-base)), var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 22px;
}
.mp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.mp-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gold);
}
.tier {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1.5px solid;
  border-radius: 999px;
  padding: 5px 12px;
}
.tier.ignite {
  animation: ignite 0.6s ease both;
}
.tier.sm {
  font-size: 9.5px;
  padding: 3px 8px;
  border-width: 1px;
}
.mp-score {
  text-align: center;
  font-size: 46px;
  line-height: 0.85;
}
.earned {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--gold) 22%, var(--border));
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.earned-pts {
  font-size: 36px;
  line-height: 0.8;
}
.mr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.mr-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid;
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}
.mr-note {
  font-size: 11.5px;
  color: var(--muted);
  margin-bottom: 14px;
}
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  margin-bottom: 18px;
}
.pcol {
  flex: 1;
  max-width: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pav {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 14px;
  border: 3px solid;
}
.pname {
  font-size: 12px;
  font-weight: 700;
  margin-top: 7px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.pscore {
  font-size: 18px;
  letter-spacing: 0.04em;
}
.ppts {
  font-size: 11px;
  font-weight: 800;
}
.pbar {
  width: 100%;
  margin-top: 7px;
  border-radius: 11px 11px 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
}
.prank {
  font-size: 26px;
  color: #0a0e14;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 13px;
}
.row.me {
  border-color: var(--gold);
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-surface)), var(--bg-surface));
}
.pos {
  font-size: 18px;
  color: var(--muted);
  text-align: center;
}
.pos.gold {
  color: var(--gold);
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.av {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 11px;
  flex: 0 0 auto;
}
.av.pitch {
  background: var(--grad-pitch);
}
.nm {
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.youtag {
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 5px;
  padding: 2px 6px;
  flex: 0 0 auto;
}
.rscore {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}
.rscore .font-numeric {
  font-size: 19px;
  letter-spacing: 0.04em;
}
.rp {
  font-size: 12px;
  font-weight: 800;
  min-width: 38px;
  text-align: right;
}
.rp.gold {
  color: var(--gold);
}
.sticky {
  position: sticky;
  bottom: 14px;
  margin-top: 12px;
  z-index: 15;
}
.sticky-cap {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-align: center;
  margin-bottom: 6px;
}
.row.big {
  box-shadow: 0 12px 30px -10px rgba(244, 184, 30, 0.5);
}
</style>
