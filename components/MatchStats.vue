<script setup lang="ts">
import type { Match, MatchStats, StatRow } from '~/types/api';

// Team statistics of a match, consumed from OUR backend (/matches/:id/stats):
// a home-vs-away comparison with a proportional bar. Refetches on the match
// realtime channel (+ 60s poll while live). Renders nothing until ingested.
// `active` is the tab gate: while this tab is hidden it neither subscribes to the
// realtime stream nor polls; it catches up with one refetch when opened. Defaults
// on for standalone use.
const props = defineProps<{ match: Match; active?: boolean }>();
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `stats-${props.match.id}`,
  () => useApi()<MatchStats>(`/matches/${props.match.id}/stats`),
);
useRealtime(() => (props.active !== false ? [`match:${props.match.id}`] : []), () => refresh());
watch(() => props.active, (a) => {
  if (a) refresh();
});
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => {
    if (props.active !== false && props.match.status === 'LIVE') refresh();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(poll));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });

// Agrupa as estatísticas por tema (em vez de uma lista corrida). A ordem das linhas
// dentro do grupo segue a do backend; o que não casar com nenhum grupo cai em "Outras".
const GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Posse & criação',
    keys: [
      'possessionPct', 'totalShots', 'shots', 'shotsOnTarget', 'shotsOnGoal',
      'wonCorners', 'corners', 'offsides', 'crosses', 'bigChances', 'shotsInsideBox',
    ],
  },
  { title: 'Disciplina', keys: ['foulsCommitted', 'fouls', 'yellowCards', 'redCards'] },
  {
    title: 'Passe & defesa',
    keys: [
      'accuratePasses', 'passes', 'totalPasses', 'passPct', 'saves',
      'tackles', 'interceptions', 'clearances', 'blockedShots',
    ],
  },
];
const groups = computed(() => {
  const rows = data.value?.rows ?? [];
  const placed = new Set<string>();
  const out: Array<{ title: string; items: StatRow[] }> = [];
  for (const g of GROUPS) {
    const items = rows.filter((r) => g.keys.includes(r.key));
    items.forEach((r) => placed.add(r.key));
    if (items.length) out.push({ title: g.title, items });
  }
  const rest = rows.filter((r) => !placed.has(r.key));
  if (rest.length) out.push({ title: 'Outras', items: rest });
  return out;
});
const homeName = computed(() => props.match.homeTeam?.shortName ?? props.match.homeTeam?.name ?? '');
const awayName = computed(() => props.match.awayTeam?.shortName ?? props.match.awayTeam?.name ?? '');

function num(v: string | null): number {
  const n = parseFloat((v ?? '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}
function homePct(r: StatRow): number {
  const h = num(r.home);
  const a = num(r.away);
  return h + a <= 0 ? 50 : Math.round((h / (h + a)) * 100);
}
function fmt(v: string | null, key: string): string {
  if (v == null) return '—';
  return key === 'possessionPct' ? `${v}%` : v;
}
</script>

<template>
  <section v-if="available" class="stats">
    <header class="stats-head">
      <span class="sh-team">
        <TeamBadge :team="match.homeTeam" :size="24" />
        <b>{{ homeName }}</b>
      </span>
      <span class="sh-team end">
        <b>{{ awayName }}</b>
        <TeamBadge :team="match.awayTeam" :size="24" />
      </span>
    </header>
    <div v-for="g in groups" :key="g.title" class="sgroup">
      <h4 class="sg-title">{{ g.title }}</h4>
      <div v-for="r in g.items" :key="r.key" class="srow">
        <div class="shead">
          <span class="sval">{{ fmt(r.home, r.key) }}</span>
          <span class="slbl">{{ r.label }}</span>
          <span class="sval">{{ fmt(r.away, r.key) }}</span>
        </div>
        <div class="sbar">
          <span class="bh" :style="{ width: `${homePct(r)}%` }" />
          <span class="ba" :style="{ width: `${100 - homePct(r)}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.sh-team {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  min-width: 0;
}
.sh-team.end { justify-content: flex-end; }
.sh-team b { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sgroup { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.sg-title {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sg-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.shead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}
.sval {
  font-size: var(--fs-sm);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.sval:first-child {
  text-align: left;
}
.sval:last-child {
  text-align: right;
}
.slbl {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  text-align: center;
}
.sbar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-base);
  gap: 2px;
}
.bh {
  background: var(--azure, #2b7fff);
  border-radius: 3px 0 0 3px;
}
.ba {
  background: var(--scarlet, #e23744);
  border-radius: 0 3px 3px 0;
}
</style>
