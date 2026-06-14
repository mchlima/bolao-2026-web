<script setup lang="ts">
import type { Competition, Match, Paginated } from '~/types/api';

type Scope = 'upcoming' | 'live' | 'today' | 'past';
interface AgendaDay {
  date: string;
  matches: Match[];
}

useSeoMeta({
  title: 'Jogos · Agenda — Amigos do Bolão',
  description:
    'A agenda completa dos jogos: próximas partidas, jogos de hoje, ao vivo e encerrados, com placar e horário de cada torneio.',
  ogTitle: 'Agenda de jogos — Amigos do Bolão',
  ogDescription:
    'Próximas partidas, jogos de hoje, ao vivo e encerrados — placar e horário de cada torneio.',
});

const TABS: { key: Scope; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'today', label: 'Hoje' },
  { key: 'live', label: 'Ao vivo' },
  { key: 'past', label: 'Encerrados' },
];

const scope = ref<Scope>('upcoming');
const competitionId = ref('');

// Tournament filter options (public).
const { data: comps } = await useAsyncData('agenda-comps', () =>
  useApi()<Paginated<Competition>>('/competitions?pageSize=100'),
);

const { data, pending } = await useAsyncData(
  'agenda',
  () => {
    const qs = new URLSearchParams({ scope: scope.value });
    if (competitionId.value) qs.set('competitionId', competitionId.value);
    return useApi()<{ scope: string; days: AgendaDay[] }>(`/agenda?${qs.toString()}`);
  },
  { watch: [scope, competitionId] },
);

const days = computed(() => data.value?.days ?? []);

// BRT calendar-day string → "sáb, 30 de mai".
function fmtDay(date: string): string {
  const d = new Date(`${date}T12:00:00-03:00`);
  return d
    .toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    .replace('.', '');
}
</script>

<template>
  <div class="agenda">
    <header class="ag-head">
      <h1 class="font-display">Jogos</h1>
      <select v-model="competitionId" class="ag-comp input">
        <option value="">Todos os torneios</option>
        <option v-for="c in comps?.data ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </header>

    <div class="ag-tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        class="ag-tab"
        :class="{ on: scope === t.key }"
        @click="scope = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <SkeletonList v-if="pending && !data" variant="match" :count="4" />
    <p v-else-if="!days.length" class="muted ag-empty">Nenhum jogo nesta visão.</p>
    <div v-else class="ag-days">
      <section v-for="d in days" :key="d.date" class="ag-day">
        <h2 class="ag-date">{{ fmtDay(d.date) }}</h2>
        <div class="ag-list">
          <MatchCard v-for="m in d.matches" :key="m.id" :match="m" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.agenda {
  padding: 8px 0 24px;
}
.ag-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.ag-head h1 {
  font-weight: 700;
  font-size: clamp(24px, 5vw, 34px);
  text-transform: uppercase;
}
.ag-comp {
  max-width: 240px;
}
.ag-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ag-tab {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  border-radius: 999px;
  padding: 7px 15px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.ag-tab.on {
  background: var(--gold);
  border-color: var(--gold);
  color: #0a0e14;
}
.ag-empty {
  padding: 2rem 0;
}
.ag-days {
  display: grid;
  gap: 22px;
}
.ag-date {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.ag-list {
  display: grid;
  gap: 10px;
}
</style>
