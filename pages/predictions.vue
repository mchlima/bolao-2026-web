<script setup lang="ts">
import type { Prediction, PaginationMeta } from '~/types/api';

definePageMeta({ middleware: 'auth' });
const tz = useTz();

const { data, pending, refresh } = await useAsyncData('my-predictions', () =>
  useApi()<Prediction[]>('/predictions/me'),
);
const all = computed(() => data.value ?? []);

// Live updates: subscribe to every tournament the user has a prediction in;
// any score/status change refetches so results and points stay current.
const rooms = computed(() => [
  ...new Set(all.value.map((p) => `tournament:${p.match.seasonId}`)),
]);
useRealtime(() => rooms.value, () => refresh());

// ── Summary stats ────────────────────────────────────────────────
const scored = computed(() => all.value.filter((p) => p.score));
const totalPoints = computed(() =>
  all.value.reduce((s, p) => s + (p.score?.points ?? 0), 0),
);
const exactCount = computed(
  () => all.value.filter((p) => p.score?.tier === 'EXACT').length,
);

// ── Filters ──────────────────────────────────────────────────────
const tournaments = computed(() => {
  const map = new Map<string, string>();
  for (const p of all.value) {
    const t = p.match.season;
    if (t) map.set(t.id, t.name);
  }
  return [...map].map(([id, name]) => ({ id, name }));
});

type StatusKey = 'ALL' | 'SCHEDULED' | 'LIVE' | 'FINISHED';
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'SCHEDULED', label: 'Agendadas' },
  { key: 'LIVE', label: 'Ao vivo' },
  { key: 'FINISHED', label: 'Encerradas' },
];

const search = ref('');
const tournamentId = ref('');
const statusFilter = ref<StatusKey>('ALL');
const page = ref(1);
const PAGE_SIZE = 8;

watch([search, tournamentId, statusFilter], () => {
  page.value = 1;
});

function inStatusBucket(s: string): boolean {
  if (statusFilter.value === 'ALL') return true;
  if (statusFilter.value === 'FINISHED')
    return s === 'FINISHED' || s === 'CANCELLED';
  return s === statusFilter.value;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return all.value.filter((p) => {
    const m = p.match;
    if (tournamentId.value && m.seasonId !== tournamentId.value) return false;
    if (!inStatusBucket(m.status)) return false;
    if (!q) return true;
    const hay = [
      m.season?.name,
      m.phaseLabel,
      m.groupName && `grupo ${m.groupName}`,
      m.homeTeam?.name,
      m.homeTeam?.shortName,
      m.homeSourceLabel,
      m.awayTeam?.name,
      m.awayTeam?.shortName,
      m.awaySourceLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
});

// Useful order: live first, then soonest upcoming, then most recent results.
const STATUS_WEIGHT: Record<string, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  FINISHED: 2,
  CANCELLED: 2,
};
const sorted = computed(() =>
  [...filtered.value].sort((a, b) => {
    const wa = STATUS_WEIGHT[a.match.status] ?? 3;
    const wb = STATUS_WEIGHT[b.match.status] ?? 3;
    if (wa !== wb) return wa - wb;
    const ta = new Date(a.match.kickoffAt).getTime();
    const tb = new Date(b.match.kickoffAt).getTime();
    return wa === 2 ? tb - ta : ta - tb; // finished: newest first
  }),
);

const pagination = computed<PaginationMeta>(() => {
  const total = sorted.value.length;
  return {
    page: page.value,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
});
const paged = computed(() =>
  sorted.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
);

const hasFilters = computed(
  () =>
    !!search.value || !!tournamentId.value || statusFilter.value !== 'ALL',
);
function clearFilters() {
  search.value = '';
  tournamentId.value = '';
  statusFilter.value = 'ALL';
}

// ── Per-item helpers ─────────────────────────────────────────────
const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  WINNER_GOALS: 'var(--azure)',
  GOAL_DIFF: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  LOSER_GOALS: 'var(--scarlet)',
  NONE: 'var(--muted)',
};
const STATUS_META: Record<
  string,
  { label: string; color: string; live: boolean }
> = {
  LIVE: { label: 'Ao vivo', color: 'var(--scarlet)', live: true },
  FINISHED: { label: 'Encerrada', color: 'var(--muted)', live: false },
  CANCELLED: { label: 'Cancelada', color: 'var(--muted)', live: false },
  SCHEDULED: { label: 'Agendada', color: 'var(--azure)', live: false },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.SCHEDULED;
}
function hasResult(s: string): boolean {
  return s === 'LIVE' || s === 'FINISHED';
}
function phaseText(m: Prediction['match']): string {
  return m.groupName ? `Grupo ${m.groupName}` : (m.phaseLabel ?? '');
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Meus palpites"
      subtitle="Acompanhe seus resultados e pontos por torneio"
    />

    <!-- summary stats -->
    <div class="stats">
      <div class="stat card">
        <span class="font-numeric val gold">{{ totalPoints }}</span>
        <span class="cap">pontos</span>
      </div>
      <div class="stat card">
        <span class="font-numeric val">{{ all.length }}</span>
        <span class="cap">palpites</span>
      </div>
      <div class="stat card">
        <span class="font-numeric val emerald">{{ exactCount }}</span>
        <span class="cap">cravadas</span>
      </div>
      <div class="stat card">
        <span class="font-numeric val">{{ scored.length }}</span>
        <span class="cap">pontuados</span>
      </div>
    </div>

    <!-- filters -->
    <div class="filters">
      <div class="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por time, torneio ou fase…"
          aria-label="Buscar palpites"
        />
      </div>
      <select
        v-if="tournaments.length > 1"
        v-model="tournamentId"
        class="sel"
        aria-label="Filtrar por torneio"
      >
        <option value="">Todos os torneios</option>
        <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <div class="tabs" role="tablist">
        <button
          v-for="t in STATUS_TABS"
          :key="t.key"
          class="tab"
          :class="{ on: statusFilter === t.key }"
          role="tab"
          :aria-selected="statusFilter === t.key"
          @click="statusFilter = t.key"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <SkeletonList v-if="pending && !data" variant="row" :count="6" />

    <template v-else>
      <EmptyState
        v-if="!all.length"
        icon="star"
        title="Você ainda não fez palpites"
        description="Escolha um torneio e faça seus primeiros palpites para começar a pontuar."
      >
        <template #action>
          <NuxtLink to="/futebol/torneios" class="btn btn-gold">Ver torneios</NuxtLink>
        </template>
      </EmptyState>
      <EmptyState
        v-else-if="!sorted.length"
        icon="search"
        title="Nenhum palpite encontrado"
        description="Tente ajustar a busca ou os filtros."
        compact
      >
        <template v-if="hasFilters" #action>
          <button class="btn" @click="clearFilters">Limpar filtros</button>
        </template>
      </EmptyState>

      <div v-else class="list">
        <div
          v-for="p in paged"
          :key="p.id"
          class="card item"
          :class="{ live: p.match.status === 'LIVE' }"
        >
          <!-- header: tournament · phase + status -->
          <div class="item-head">
            <div class="ctx">
              <span class="tourn">{{ p.match.season?.name }}</span>
              <span v-if="phaseText(p.match)" class="phase">{{ phaseText(p.match) }}</span>
            </div>
            <span
              class="status"
              :class="{ pulse: statusMeta(p.match.status).live }"
              :style="{ color: statusMeta(p.match.status).color, borderColor: statusMeta(p.match.status).color }"
            >
              <span v-if="statusMeta(p.match.status).live" class="dot" />
              {{ statusMeta(p.match.status).label }}
            </span>
          </div>

          <!-- teams + scores -->
          <div class="body">
            <div class="side">
              <TeamBadge :team="p.match.homeTeam" :placeholder="p.match.homeSourceLabel" :size="44" />
              <span class="abbr">{{ teamAbbr(p.match.homeTeam, p.match.homeSourceLabel) }}</span>
            </div>

            <div class="scores">
              <div class="srow">
                <span class="slabel">Palpite</span>
                <span class="font-numeric sval">{{ p.homeScore }}<i>:</i>{{ p.awayScore }}</span>
              </div>
              <div v-if="hasResult(p.match.status)" class="srow result">
                <span class="slabel">{{ p.match.status === 'LIVE' ? 'Parcial' : 'Final' }}</span>
                <span class="font-numeric sval">{{ p.match.homeScore }}<i>:</i>{{ p.match.awayScore }}</span>
              </div>
              <div v-else class="srow when">
                <span>{{ formatKickoff(p.match.kickoffAt, tz) }}</span>
              </div>
            </div>

            <div class="side">
              <TeamBadge :team="p.match.awayTeam" :placeholder="p.match.awaySourceLabel" :size="44" />
              <span class="abbr">{{ teamAbbr(p.match.awayTeam, p.match.awaySourceLabel) }}</span>
            </div>
          </div>

          <!-- result footer: points + tier (LIVE = provisional) -->
          <div
            v-if="p.score"
            class="foot"
            :style="{ '--tc': TIER_COLOR[p.score.tier] }"
          >
            <span class="tier">{{ tierLabel(p.score.tier, (p.match.homeScore ?? 0) === (p.match.awayScore ?? 0)) }}</span>
            <span class="pts font-numeric">
              {{ p.score.points > 0 ? '+' : '' }}{{ p.score.points }}
              <i>{{ p.match.status === 'LIVE' ? 'pts parciais' : 'pts' }}</i>
            </span>
          </div>

          <NuxtLink
            v-if="p.match.homeTeam && p.match.awayTeam"
            :to="`/futebol/jogos/${p.match.id}`"
            class="rank-link"
          >
            Ver partida
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </NuxtLink>
        </div>
      </div>

      <AdminPager v-if="sorted.length" v-model="page" :pagination="pagination" />
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
/* stats */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 6px;
  border-radius: 14px;
}
.stat .val {
  font-size: 26px;
  line-height: 1;
}
.stat .val.gold {
  color: var(--gold);
}
.stat .val.emerald {
  color: var(--emerald);
}
.cap {
  font-size: 10px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* filters */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.search {
  flex: 1 1 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
}
.search input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--text);
  font-size: 13.5px;
  padding: 10px 0;
}
.sel {
  flex: 0 1 auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  padding: 0 10px;
  height: 40px;
  cursor: pointer;
}
.tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 3px;
}
.tab {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  font-size: 12px;
  padding: 7px 11px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.tab.on {
  background: var(--gold);
  color: #0a0e14;
}

/* list */
.empty {
  text-align: center;
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.link {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 9px;
  padding: 7px 14px;
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.item {
  position: relative;
  padding: 13px 15px;
  border-radius: 16px;
}
.item.live {
  border-color: rgba(232, 54, 43, 0.5);
}
.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.ctx {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.tourn {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.phase {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 8px;
}
.status {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 9px;
}
.status.pulse {
  background: rgba(232, 54, 43, 0.12);
  animation: livePulse 1.8s infinite;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}

.body {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.abbr {
  font-size: 12px;
  font-weight: 700;
}
.scores {
  min-width: 104px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.srow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.slabel {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.sval {
  font-size: 24px;
  line-height: 0.9;
}
.sval i {
  color: var(--muted);
  margin: 0 2px;
  font-style: normal;
}
.srow.result .sval {
  color: var(--gold);
}
.item.live .srow.result .sval {
  color: var(--scarlet);
}
.srow.when {
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin-top: 2px;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--border);
}
.tier {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tc);
}
.pts {
  font-size: 22px;
  line-height: 1;
  color: var(--tc);
}
.pts i {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
  margin-left: 3px;
}

.rank-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}
.rank-link:hover {
  color: var(--text);
}

@media (max-width: 420px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .tabs {
    flex: 1 1 100%;
    justify-content: space-between;
  }
}
</style>
