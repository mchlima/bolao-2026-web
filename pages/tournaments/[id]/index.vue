<script setup lang="ts">
import type { Match, Paginated, Prediction } from '~/types/api';

const route = useRoute();
const auth = useAuthStore();
const tz = useTz();
const id = route.params.id as string;

// The tournament header + tabs live in the layout (tournaments/[id].vue); this
// page only loads the matches + the user's predictions.
const { data, pending, error, refresh } = await useAsyncData(
  `tournament-matches-${id}`,
  async () => {
    const api = useApi();
    const [p1, p2] = await Promise.all([
      api<Paginated<Match>>(`/matches?tournamentId=${id}&page=1&pageSize=100`),
      api<Paginated<Match>>(`/matches?tournamentId=${id}&page=2&pageSize=100`),
    ]);
    const matches = [...p1.data, ...p2.data];
    let predictions: Prediction[] = [];
    if (auth.token) {
      predictions = await api<Prediction[]>(`/predictions/me?tournamentId=${id}`);
    }
    return { matches, predictions };
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

useRealtime(() => [`tournament:${id}`], () => refresh());

// ── Filters ──────────────────────────────────────────────────────
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

// Sections are grouped by calendar day (account tz), matches in kickoff order —
// same shape as the pool matches screen. The phase select stays as a filter.
const sections = computed(() => {
  const sorted = [...filtered.value].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  );
  const out: Array<{ title: string; matches: Match[] }> = [];
  for (const m of sorted) {
    const title = formatDate(m.kickoffAt, tz.value);
    let s = out[out.length - 1];
    if (!s || s.title !== title) {
      s = { title, matches: [] };
      out.push(s);
    }
    s.matches.push(m);
  }
  return out;
});

const hasFilters = computed(
  () => !!search.value || statusFilter.value !== 'ALL' || !!phaseFilter.value,
);
function clearFilters() {
  search.value = '';
  statusFilter.value = 'ALL';
  phaseFilter.value = '';
}

</script>

<template>
  <div>
    <SkeletonList v-if="pending" variant="match" :count="6" />
    <p v-else-if="error || !data" class="muted load">Torneio não encontrado.</p>
    <template v-else>
      <!-- filters -->
      <div class="filters">
        <div class="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input v-model="search" type="search" placeholder="Buscar por seleção…" aria-label="Buscar partidas" />
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

      <p v-if="!sections.length" class="empty">
        <span class="muted">Nenhuma partida encontrada com esses filtros.</span>
        <button v-if="hasFilters" class="link" @click="clearFilters">Limpar filtros</button>
      </p>

      <div v-for="sec in sections" :key="sec.title" class="section">
        <h2 class="font-display section-title">{{ sec.title }}</h2>
        <div class="matches">
          <MatchCard
            v-for="m in sec.matches"
            :key="m.id"
            :match="m"
            :prediction="predMap[m.id] ?? null"
            @saved="onSaved"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.load {
  padding: 2rem 0;
}
.thead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.badge {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
  font-size: 17px;
  flex: 0 0 auto;
}
.meta {
  flex: 1;
  min-width: 200px;
}
.name {
  font-weight: 700;
  font-size: clamp(22px, 4vw, 30px);
  text-transform: uppercase;
  line-height: 1;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.tag {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
}
.tag.azure {
  color: var(--azure);
  background: rgba(30, 127, 240, 0.14);
  border-color: rgba(30, 127, 240, 0.3);
}
.tourn-sel {
  flex: 0 1 auto;
  max-width: 100%;
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
  gap: 5px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 5px;
  margin-bottom: 16px;
  position: sticky;
  top: 70px;
  z-index: 20;
  backdrop-filter: blur(8px);
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--muted);
  cursor: pointer;
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
}

/* filters */
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

.empty {
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
.section {
  margin-top: 1.4rem;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.7rem;
}
/* one card per line — easier to read, uniform height */
.matches {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 460px) {
  .status-tabs {
    flex: 1 1 100%;
    justify-content: space-between;
  }
}
</style>
