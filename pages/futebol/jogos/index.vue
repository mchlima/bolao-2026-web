<script setup lang="ts">
import type { Competition, Match, Paginated } from '~/types/api';

useSeoMeta({
  title: 'Jogos · Agenda — Cravei',
  description:
    'A agenda de jogos dia a dia: navegue pelas datas e veja as partidas de cada dia, de todos os torneios, com placar e horário.',
  ogTitle: 'Agenda de jogos — Cravei',
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

// Tournament filter — custom dropdown (a native <select> can't show the badge).
const compOpen = ref(false);
const COMP_GRADS = ['var(--grad-pitch)', 'var(--grad-trophy)', 'var(--grad-live)'];
const compList = computed(() => comps.value?.data ?? []);
const selectedComp = computed(
  () => compList.value.find((c) => c.id === competitionId.value) ?? null,
);
function compInitials(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return ((w[0]?.[0] ?? name[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}
function compGrad(c: Competition): string {
  const i = compList.value.findIndex((x) => x.id === c.id);
  return COMP_GRADS[(i < 0 ? 0 : i) % COMP_GRADS.length];
}
function pickComp(value: string) {
  competitionId.value = value;
  compOpen.value = false;
}

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
      <div class="ag-comp">
        <button type="button" class="csel" :aria-expanded="compOpen" @click="compOpen = !compOpen">
          <span v-if="selectedComp" class="cbadge" :style="{ background: compGrad(selectedComp) }">
            <img v-if="selectedComp.logoUrl" :src="selectedComp.logoUrl" alt="" />
            <template v-else>{{ compInitials(selectedComp.name) }}</template>
          </span>
          <span v-else class="cbadge all"><AppIcon name="ball" :size="14" :stroke="2" /></span>
          <span class="cname">{{ selectedComp?.name ?? 'Todos os torneios' }}</span>
          <AppIcon name="chevronDown" :size="16" :stroke="2.4" class="ccaret" :class="{ up: compOpen }" />
        </button>

        <template v-if="compOpen">
          <div class="csel-ov" @click="compOpen = false" />
          <ul class="csel-menu">
            <li>
              <button type="button" class="csel-opt" :class="{ on: !competitionId }" @click="pickComp('')">
                <span class="cbadge all"><AppIcon name="ball" :size="14" :stroke="2" /></span>
                <span class="copt-name">Todos os torneios</span>
                <AppIcon v-if="!competitionId" name="check" :size="15" :stroke="2.6" class="cok" />
              </button>
            </li>
            <li v-for="c in compList" :key="c.id">
              <button type="button" class="csel-opt" :class="{ on: competitionId === c.id }" @click="pickComp(c.id)">
                <span class="cbadge" :style="{ background: compGrad(c) }">
                  <img v-if="c.logoUrl" :src="c.logoUrl" alt="" />
                  <template v-else>{{ compInitials(c.name) }}</template>
                </span>
                <span class="copt-name">{{ c.name }}</span>
                <AppIcon v-if="competitionId === c.id" name="check" :size="15" :stroke="2.6" class="cok" />
              </button>
            </li>
          </ul>
        </template>
      </div>
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
  position: relative;
  flex: 0 1 auto;
}
.csel {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 230px;
  padding: 6px 10px 6px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
}
.csel:hover {
  border-color: color-mix(in srgb, var(--gold) 40%, var(--border));
}
.cbadge {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 11px;
  overflow: hidden;
}
.cbadge.all {
  background: var(--bg-base);
  color: var(--muted);
  border: 1px solid var(--border);
}
.cbadge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cname {
  min-width: 0;
  flex: 1;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ccaret {
  flex: none;
  color: var(--muted);
  transition: transform 0.15s;
}
.ccaret.up {
  transform: rotate(180deg);
}
.csel-ov {
  position: fixed;
  inset: 0;
  z-index: 30;
}
.csel-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 31;
  min-width: 230px;
  max-width: 280px;
  list-style: none;
  margin: 0;
  padding: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 13px;
  box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.5);
}
.csel-opt {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  background: transparent;
  border-radius: 9px;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.csel-opt:hover {
  background: var(--bg-base);
}
.csel-opt.on {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
}
.copt-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cok {
  flex: none;
  color: var(--gold);
}
.day-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.day-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s;
}
.day-btn:hover {
  color: var(--text);
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
