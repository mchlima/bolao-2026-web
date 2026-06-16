<script setup lang="ts">
import type { Match, MatchStats, StatRow } from '~/types/api';

// Team statistics of a match, consumed from OUR backend (/matches/:id/stats):
// a home-vs-away comparison with a proportional bar. Refetches on the match
// realtime channel (+ 60s poll while live). Renders nothing until ingested.
const props = defineProps<{ match: Match }>();
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `stats-${props.match.id}`,
  () => useApi()<MatchStats>(`/matches/${props.match.id}/stats`),
);
useRealtime(() => [`match:${props.match.id}`], () => refresh());
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => {
    if (props.match.status === 'LIVE') refresh();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(poll));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });

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
    <div v-for="r in data?.rows ?? []" :key="r.key" class="srow">
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
  </section>
</template>

<style scoped>
.stats {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.shead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}
.sval {
  font-size: 14px;
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
  font-size: 11.5px;
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
