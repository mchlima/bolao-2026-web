<script setup lang="ts">
import type { Competition, Match, Paginated, Prediction } from '~/types/api';

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

const { data, pending, refresh } = await useAsyncData(
  'agenda',
  () => {
    const qs = new URLSearchParams({ from: day.value, to: day.value });
    if (competitionId.value) qs.set('competitionId', competitionId.value);
    return useApi()<{
      days: { date: string; matches: Match[] }[];
      nav?: { prevDate: string | null; nextDate: string | null };
    }>(`/agenda?${qs.toString()}`);
  },
  { watch: [day, competitionId] },
);
// Nearest days that actually have games (computed server-side, honouring the
// tournament filter) — lets the day arrows skip over empty dates.
const nav = computed(() => data.value?.nav ?? { prevDate: null, nextDate: null });
const matches = computed<Match[]>(() => (data.value?.days ?? []).flatMap((d) => d.matches));
// Server-confirmed live games get the labelled "Ao vivo" section; the rest
// follow status priority (agendada → adiada → encerrada), finished sinking to
// the bottom. A reactive clock re-sorts live — a just-kicked-off game (not yet
// flipped to LIVE by the robot) floats to the very top of the rest.
const now = useNow();
const liveMatches = computed(() => matches.value.filter((m) => m.status === 'LIVE'));
const restMatches = computed(() =>
  matches.value.filter((m) => m.status !== 'LIVE').sort(listingComparator(now.value)),
);

// Reflect live changes (goals/status): subscribe to every tournament shown today
// and re-fetch when the robot emits an update for it.
const liveChannels = computed(() => [
  ...new Set(matches.value.map((m) => m.seasonId).filter(Boolean)),
].map((seasonId) => `tournament:${seasonId}`));
useRealtime(() => liveChannels.value, () => refresh());

// The user's predictions (all seasons) so each card shows the saved palpite
// instead of an empty editor. Loaded once — independent of the day/competition.
const auth = useAuthStore();
const { data: preds } = await useAsyncData('agenda-preds', () =>
  auth.token
    ? useApi()<Prediction[]>('/predictions/me')
    : Promise.resolve([] as Prediction[]),
);
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of preds.value ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

const isToday = computed(() => day.value === brtToday());
// Jump straight to a given day (used by the arrows with the server's adjacent
// game days). No-op when there's no such day (arrow is disabled then anyway).
function goDay(date: string | null) {
  if (date) day.value = date;
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
    <PageHeader title="Jogos" subtitle="Os jogos de cada dia, de todos os torneios." />

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

    <!-- day navigator: opens on today; arrows skip to the prev/next day with games -->
    <div class="day-nav">
      <button class="day-btn" aria-label="Dia anterior com jogos" :disabled="!nav.prevDate" @click="goDay(nav.prevDate)">
        <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
      </button>
      <div class="day-label">
        <span class="dl-main">{{ fmtDayLabel(day) }}</span>
        <button v-if="!isToday" class="dl-today" @click="goToday">Voltar para hoje</button>
        <span v-else class="dl-today is">Hoje</span>
      </div>
      <button class="day-btn" aria-label="Próximo dia com jogos" :disabled="!nav.nextDate" @click="goDay(nav.nextDate)">
        <AppIcon name="arrowRight" :size="18" :stroke="2.4" />
      </button>
    </div>

    <div v-if="pending && data" class="ag-busy" aria-live="polite">
      <span class="ag-spin" />Carregando jogos…
    </div>
    <SkeletonList v-if="pending && !data" variant="match" :count="4" />
    <div v-else-if="!matches.length" class="ag-empty">
      <p class="muted">Nenhum jogo neste dia.</p>
      <button v-if="nav.nextDate" type="button" class="ag-empty-next" @click="goDay(nav.nextDate)">
        Ir para o próximo dia com jogos <AppIcon name="arrowRight" :size="15" :stroke="2.4" />
      </button>
    </div>
    <div v-else class="ag-list" :class="{ busy: pending }">
      <template v-if="liveMatches.length">
        <span class="ag-live-lbl"><span class="lvdot" />Ao vivo</span>
        <MatchCard v-for="m in liveMatches" :key="m.id" :match="m" :prediction="predMap[m.id] ?? null" @saved="onSaved" />
        <span v-if="restMatches.length" class="ag-live-lbl rest">Mais jogos do dia</span>
      </template>
      <MatchCard v-for="m in restMatches" :key="m.id" :match="m" :prediction="predMap[m.id] ?? null" @saved="onSaved" />
    </div>
  </div>
</template>

<style scoped>
.agenda {
  padding: 10px;
}
.ag-comp {
  position: relative;
  width: 100%;
  margin-bottom: 12px;
}
.csel {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
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
  left: 0;
  right: 0;
  z-index: 31;
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
.day-btn:hover:not(:disabled) {
  color: var(--text);
}
.day-btn:disabled {
  opacity: 0.25;
  cursor: default;
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
.ag-empty-next {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.ag-empty-next:hover {
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.ag-list {
  display: grid;
  gap: 10px;
}
.ag-list.busy {
  opacity: 0.45;
  pointer-events: none;
  transition: opacity 0.12s;
}
.ag-busy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.ag-spin {
  flex: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--gold);
  animation: ag-spin 0.7s linear infinite;
}
@keyframes ag-spin {
  to {
    transform: rotate(360deg);
  }
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
