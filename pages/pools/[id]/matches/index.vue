<script setup lang="ts">
import type { Match, Paginated, Prediction } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const ui = useUiStore();
const tz = useTz();
const auth = useAuthStore();

const pool = usePoolData(id);

const { data, pending, refresh } = await useAsyncData(
  `pool-matches-${id}`,
  async () => {
    const empty = { matches: [] as Match[], predictions: [] as Prediction[] };
    if (!pool.value) return empty;
    try {
      const api = useApi();
      const tid = pool.value.tournament.id;
      // The API caps pageSize at 100 — page through to get every match.
      const all: Match[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await api<Paginated<Match>>(
          `/matches?tournamentId=${tid}&page=${page}&pageSize=100`,
        );
        all.push(...res.data);
        totalPages = res.pagination.totalPages;
        page++;
      } while (page <= totalPages);
      // Chronological — by kickoff (earliest first).
      all.sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
      // Predictions are global/single — load the user's for this tournament so
      // the cards can show + edit them right here (same flow as the tournament page).
      let predictions: Prediction[] = [];
      if (auth.token) {
        predictions = await api<Prediction[]>(`/predictions/me?tournamentId=${tid}`);
      }
      return { matches: all, predictions };
    } catch (e) {
      ui.toast('error', poolError(e));
      return empty;
    }
  },
);

const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

const tid = computed(() => pool.value?.tournament.id);
useRealtime(
  () => (tid.value ? [`tournament:${tid.value}`] : []),
  () => refresh(),
);

// ── Filters (same bar as the tournament matches listing) ─────────────
function phaseTitle(m: Match): string {
  return m.groupName ? `Grupo ${m.groupName}` : (m.phaseLabel ?? 'Partidas');
}

type StatusKey = 'ALL' | 'SCHEDULED' | 'LIVE' | 'FINISHED';
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'SCHEDULED', label: 'Agendadas' },
  { key: 'LIVE', label: 'Ao vivo' },
  { key: 'FINISHED', label: 'Encerradas' },
];

const search = ref('');
const statusFilter = ref<StatusKey>('ALL');
const phaseFilter = ref('');

function inStatus(s: string): boolean {
  if (statusFilter.value === 'ALL') return true;
  if (statusFilter.value === 'FINISHED') return s === 'FINISHED' || s === 'CANCELLED';
  return s === statusFilter.value;
}

// Stable phase options from the full set (so the select doesn't flicker).
const phaseOptions = computed(() => {
  const seen: string[] = [];
  for (const m of data.value?.matches ?? []) {
    const t = phaseTitle(m);
    if (!seen.includes(t)) seen.push(t);
  }
  return seen;
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return (data.value?.matches ?? []).filter((m) => {
    if (!inStatus(m.status)) return false;
    if (phaseFilter.value && phaseTitle(m) !== phaseFilter.value) return false;
    if (!q) return true;
    const hay = [
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

const hasFilters = computed(
  () => !!search.value || statusFilter.value !== 'ALL' || !!phaseFilter.value,
);
function clearFilters() {
  search.value = '';
  statusFilter.value = 'ALL';
  phaseFilter.value = '';
}

// Group the filtered matches by calendar day (account tz) for date headers.
const matchesByDay = computed(() => {
  const out: { day: string; items: Match[] }[] = [];
  for (const m of filtered.value) {
    const day = formatDate(m.kickoffAt, tz.value);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(m);
    else out.push({ day, items: [m] });
  }
  return out;
});
</script>

<template>
  <section class="wrap">
    <SkeletonList v-if="pending && !data?.matches?.length" variant="match" :count="6" />
    <p v-else-if="!data?.matches?.length" class="empty">
      Nenhuma partida neste torneio ainda.
    </p>
    <template v-else>
      <!-- filters -->
      <div class="filters">
        <div class="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input v-model="search" type="search" placeholder="Buscar por time…" aria-label="Buscar partidas" />
        </div>
        <select v-model="phaseFilter" class="sel" aria-label="Filtrar por fase">
          <option value="">Todas as fases</option>
          <option v-for="p in phaseOptions" :key="p" :value="p">{{ p }}</option>
        </select>
        <div class="status-tabs" role="tablist">
          <button
            v-for="t in STATUS_TABS"
            :key="t.key"
            class="stab"
            :class="{ on: statusFilter === t.key }"
            role="tab"
            :aria-selected="statusFilter === t.key"
            @click="statusFilter = t.key"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <p v-if="!matchesByDay.length" class="noresults">
        <span class="muted">Nenhuma partida encontrada com esses filtros.</span>
        <button v-if="hasFilters" class="link" @click="clearFilters">Limpar filtros</button>
      </p>

      <div class="matches">
        <div v-for="grp in matchesByDay" :key="grp.day" class="daygrp">
          <div class="dayhd">{{ grp.day }}</div>
          <MatchCard
            v-for="m in grp.items"
            :key="m.id"
            :match="m"
            :prediction="predMap[m.id] ?? null"
            :pool-id="id"
            @saved="onSaved"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.matches {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 13.5px;
  color: var(--muted);
}
.daygrp {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dayhd {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0 2px 2px;
}

/* filters — mirrors tournaments/[id]/index.vue */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.search {
  flex: 1 1 180px;
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
  min-width: 0;
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
.status-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 3px;
}
.stab {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.stab.on {
  background: var(--gold);
  color: #0a0e14;
}
.noresults {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 0;
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
@media (max-width: 460px) {
  .status-tabs {
    flex: 1 1 100%;
    justify-content: space-between;
  }
}
</style>
