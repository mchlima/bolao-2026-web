<script setup lang="ts">
import type { Competition, Match, Paginated } from '~/types/api';

useSeoMeta({
  title: 'Jogos · Agenda — Amigos do Bolão',
  description:
    'A agenda de jogos dia a dia: navegue pelas datas e veja as partidas de cada dia, de todos os torneios, com placar e horário.',
  ogTitle: 'Agenda de jogos — Amigos do Bolão',
  ogDescription: 'Os jogos de cada dia, de todos os torneios, com placar e horário.',
});

// The agenda groups matches by BRT calendar day server-side, so the day picker
// works in BRT too (today = "now" in São Paulo).
function brtToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
const day = ref(brtToday());
const competitionId = ref('');

// Tournament filter options (public).
const { data: comps } = await useAsyncData('agenda-comps', () =>
  useApi()<Paginated<Competition>>('/competitions?pageSize=100'),
);

const { data, pending } = await useAsyncData(
  'agenda',
  () => {
    const qs = new URLSearchParams({ from: day.value, to: day.value });
    if (competitionId.value) qs.set('competitionId', competitionId.value);
    return useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?${qs.toString()}`);
  },
  { watch: [day, competitionId] },
);
const matches = computed<Match[]>(() => (data.value?.days ?? []).flatMap((d) => d.matches));
// Live games float to the top of the day; the rest stay in kickoff order.
const liveMatches = computed(() => matches.value.filter((m) => m.status === 'LIVE'));
const restMatches = computed(() => matches.value.filter((m) => m.status !== 'LIVE'));

const isToday = computed(() => day.value === brtToday());
function shiftDay(delta: number) {
  const [y, m, d] = day.value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  day.value = dt.toISOString().slice(0, 10);
}
function goToday() {
  day.value = brtToday();
}

// "Qua, 14 de jun" — weekday + day + month, in BRT.
function fmtDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00-03:00`);
  const s = d
    .toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    .replace(/\./g, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

    <!-- day navigator: opens on today, ‹ prev / next › -->
    <div class="day-nav">
      <button class="day-btn" aria-label="Dia anterior" @click="shiftDay(-1)">
        <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
      </button>
      <div class="day-label">
        <span class="dl-main">{{ fmtDayLabel(day) }}</span>
        <button v-if="!isToday" class="dl-today" @click="goToday">Voltar para hoje</button>
        <span v-else class="dl-today is">Hoje</span>
      </div>
      <button class="day-btn" aria-label="Próximo dia" @click="shiftDay(1)">
        <AppIcon name="arrowRight" :size="18" :stroke="2.4" />
      </button>
    </div>

    <SkeletonList v-if="pending && !data" variant="match" :count="4" />
    <p v-else-if="!matches.length" class="muted ag-empty">Nenhum jogo neste dia.</p>
    <div v-else class="ag-list">
      <template v-if="liveMatches.length">
        <span class="ag-live-lbl"><span class="lvdot" />Ao vivo</span>
        <MatchCard v-for="m in liveMatches" :key="m.id" :match="m" />
        <span v-if="restMatches.length" class="ag-live-lbl rest">Mais jogos do dia</span>
      </template>
      <MatchCard v-for="m in restMatches" :key="m.id" :match="m" />
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
.day-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px;
  margin-bottom: 18px;
}
.day-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.13s, color 0.13s;
}
.day-btn:hover {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.day-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.dl-main {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.dl-today {
  font-size: 11px;
  font-weight: 700;
  color: var(--azure);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.dl-today.is {
  color: var(--emerald);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: default;
}
.ag-empty {
  padding: 2.5rem 0;
  text-align: center;
}
.ag-list {
  display: grid;
  gap: 10px;
}
.ag-live-lbl {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--scarlet);
  margin: 2px 0 -2px;
}
.ag-live-lbl.rest {
  color: var(--muted);
  margin-top: 8px;
}
.lvdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--scarlet) 22%, transparent);
  animation: liveDot 1.1s ease-in-out infinite;
}
</style>
