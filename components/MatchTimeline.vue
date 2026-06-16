<script setup lang="ts">
import type { Match, MatchTimeline } from '~/types/api';

// Event timeline of a match (goals/cards/subs), consumed from OUR backend
// (/matches/:id/events) — grouped by period, home on the left, away on the
// right. Refetches on the match realtime channel so new events land live.
// Renders nothing until events exist.
const props = defineProps<{ match: Match }>();
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `timeline-${props.match.id}`,
  () => useApi()<MatchTimeline>(`/matches/${props.match.id}/events`),
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

function surname(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}
const isGoal = (t: string) => t.includes('GOAL');
</script>

<template>
  <section v-if="available" class="timeline">
    <template v-for="per in data?.periods ?? []" :key="per.period">
      <div class="per">{{ per.label }}</div>
      <div
        v-for="(e, i) in per.events"
        :key="i"
        class="row"
        :class="e.side"
      >
        <div class="cell">
          <template v-if="e.side">
            <span v-if="e.type === 'YELLOW'" class="card yellow" />
            <span v-else-if="e.type === 'RED'" class="card red" />
            <span v-else-if="e.type === 'SUBSTITUTION'" class="ico sub">⇅</span>
            <span v-else-if="isGoal(e.type)" class="ico">⚽</span>
            <span class="txt">
              <span class="nm">{{ surname(e.player) }}</span>
              <span v-if="e.related" class="rel">{{ e.type === 'SUBSTITUTION' ? 'sai ' : '' }}{{ surname(e.related) }}</span>
              <span v-if="e.type === 'OWN_GOAL'" class="rel">contra</span>
              <span v-else-if="e.type === 'PENALTY_GOAL'" class="rel">pênalti</span>
            </span>
          </template>
        </div>
        <div class="min">{{ e.minute }}</div>
        <div class="cell" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.timeline {
  margin-top: 4px;
}
.per {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 14px 0 8px;
  position: relative;
}
.per::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--border);
  z-index: 0;
}
.per {
  z-index: 1;
}
.row {
  display: grid;
  grid-template-columns: 1fr 44px 1fr;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.min {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.cell {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
/* home → content hugs the centre from the left; away → mirrored on the right */
.row.away > .cell:first-child {
  order: 3;
  flex-direction: row-reverse;
  text-align: right;
}
.row.away > .cell:last-child {
  order: 1;
}
.row.home > .cell:first-child {
  justify-content: flex-end;
  text-align: right;
}
.ico {
  flex: none;
  font-size: 13px;
  line-height: 1;
}
.card {
  flex: none;
  width: 9px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.35);
}
.card.yellow {
  background: #f5c518;
}
.card.red {
  background: var(--scarlet, #e23744);
}
.txt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.nm {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rel {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
