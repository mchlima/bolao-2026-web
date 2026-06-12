<script setup lang="ts">
import type { Match, PoolMatchPredictionEntry } from '~/types/api';

// Hidden "match" view inside a pool — mirrors the tournament match ranking,
// scoped to the pool's members. Predictions stay hidden until kickoff (the gate
// lives in the API: /pools/:id/matches/:matchId/predictions).
const props = defineProps<{ poolId: string; matchId: string }>();
const emit = defineEmits<{ back: [] }>();

const pools = usePools();

const { data, pending, error, refresh } = await useAsyncData(
  `poolmatch-${props.poolId}-${props.matchId}`,
  async () => {
    const api = useApi();
    const [match, preds] = await Promise.all([
      api<Match>(`/matches/${props.matchId}`),
      pools.matchPredictions(props.poolId, props.matchId),
    ]);
    return { match, preds };
  },
);
useRealtime(
  () => [`match:${props.matchId}`],
  () => refresh(),
);

const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  ONE_TEAM_SCORE: 'var(--azure)',
  CLOSE: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  NONE: 'var(--muted)',
};

const auth = useAuthStore();
const tz = useTz();
const match = computed(() => data.value?.match ?? null);
const preds = computed(() => data.value?.preds ?? null);
const playing = computed(
  () => match.value?.status === 'LIVE' || match.value?.status === 'FINISHED',
);
const shownHome = computed(() =>
  playing.value ? (match.value?.homeScore ?? 0) : '–',
);
const shownAway = computed(() =>
  playing.value ? (match.value?.awayScore ?? 0) : '–',
);

// Rank the member entries by points (ties share a rank).
const ranked = computed(() => {
  if (!preds.value?.revealed) return [];
  const sorted = [...preds.value.entries].sort(
    (a, b) => (b.points ?? 0) - (a.points ?? 0),
  );
  let lastPts: number | null = null;
  let lastRank = 0;
  return sorted.map((e, i) => {
    const pts = e.points ?? 0;
    const rank = lastPts !== null && pts === lastPts ? lastRank : i + 1;
    lastPts = pts;
    lastRank = rank;
    return { ...e, rank };
  });
});
const ownEntry = computed(() => preds.value?.entries?.[0] ?? null);

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
function guess(e: PoolMatchPredictionEntry): string {
  return `${e.prediction.home}:${e.prediction.away}`;
}
const isMe = (uid: string) => uid === auth.user?.id;
</script>

<template>
  <div>
    <button class="back" @click="emit('back')">← Jogos</button>

    <SkeletonList v-if="pending" variant="row" :count="4" />
    <p v-else-if="error || !match" class="muted load">Partida indisponível.</p>

    <template v-else>
      <!-- result card -->
      <div class="card detail">
        <div class="rlabel">
          {{ match.phaseLabel }}<span v-if="match.groupName"> · Grupo {{ match.groupName }}</span>
        </div>
        <div class="result">
          <div class="side">
            <TeamBadge :team="match.homeTeam" :placeholder="match.homeSourceLabel" :size="54" />
            <span class="tname">{{ match.homeTeam?.name ?? match.homeSourceLabel }}</span>
          </div>
          <div class="font-numeric big">
            <span>{{ shownHome }}</span><span class="colon">:</span><span>{{ shownAway }}</span>
          </div>
          <div class="side">
            <TeamBadge :team="match.awayTeam" :placeholder="match.awaySourceLabel" :size="54" />
            <span class="tname">{{ match.awayTeam?.name ?? match.awaySourceLabel }}</span>
          </div>
        </div>
        <div class="sub">
          <span v-if="match.status === 'LIVE'" class="chip live">AO VIVO</span>
          <span v-else-if="match.status === 'FINISHED'" class="chip">Encerrado</span>
          <span v-else>{{ formatKickoff(match.kickoffAt, tz) }}</span>
          <template v-if="match.stadium"> · {{ match.stadium.name }}</template>
        </div>
      </div>

      <!-- member ranking -->
      <div class="mr-head">
        <span class="mr-title">Ranking da partida · membros</span>
      </div>

      <!-- hidden until kickoff -->
      <template v-if="!preds?.revealed">
        <p class="muted lock">🔒 Os palpites dos membros aparecem quando a partida começar.</p>
        <div v-if="ownEntry" class="row me">
          <span class="av pitch">{{ initials(ownEntry.user.name) }}</span>
          <span class="nm">Seu palpite</span>
          <span class="font-numeric gs">{{ guess(ownEntry) }}</span>
        </div>
        <p v-else class="muted small">Você ainda não palpitou este jogo.</p>
      </template>

      <!-- revealed -->
      <template v-else>
        <p v-if="!ranked.length" class="muted small">Nenhum membro palpitou este jogo.</p>
        <div class="rows">
          <div v-for="e in ranked" :key="e.user.id" class="row" :class="{ me: isMe(e.user.id) }">
            <span class="font-numeric pos">{{ e.rank }}</span>
            <span class="av" :style="{ background: color(e.user.id) }">{{ initials(e.user.name) }}</span>
            <span class="nm">
              {{ e.user.name }}<span v-if="isMe(e.user.id)" class="youtag">Você</span>
            </span>
            <span class="font-numeric gs">{{ guess(e) }}</span>
            <span
              v-if="e.tier && playing"
              class="tier"
              :style="{ color: TIER_COLOR[e.tier], borderColor: TIER_COLOR[e.tier] }"
            >{{ tierLabel(e.tier) }}</span>
            <span v-if="playing" class="rp" :style="{ color: e.tier ? TIER_COLOR[e.tier] : 'var(--muted)' }">
              +{{ e.points ?? 0 }}
            </span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.back {
  border: none;
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 14px;
  padding: 0;
}
.load {
  padding: 2rem 0;
}
.detail {
  border-radius: 18px;
  padding: 18px;
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.14), rgba(30, 127, 240, 0.12)), var(--bg-surface);
  margin-bottom: 18px;
}
.rlabel {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 14px;
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
  gap: 8px;
}
.tname {
  font-size: 12.5px;
  font-weight: 700;
  text-align: center;
}
.big {
  font-size: 44px;
  line-height: 0.8;
  display: flex;
  align-items: center;
  gap: 8px;
}
.colon {
  color: var(--muted);
}
.sub {
  text-align: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.chip {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
}
.chip.live {
  color: var(--emerald);
  border-color: var(--emerald);
}
.mr-head {
  margin-bottom: 12px;
}
.mr-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
}
.lock {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 10px;
}
.small {
  font-size: 13px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.row {
  display: flex;
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
  font-size: 17px;
  color: var(--muted);
  min-width: 18px;
  text-align: center;
  flex: 0 0 auto;
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
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 7px;
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
.gs {
  font-size: 18px;
  letter-spacing: 0.04em;
  flex: 0 0 auto;
}
.tier {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid;
  border-radius: 999px;
  padding: 3px 8px;
  flex: 0 0 auto;
}
.rp {
  font-size: 12px;
  font-weight: 800;
  min-width: 34px;
  text-align: right;
  flex: 0 0 auto;
}
</style>
