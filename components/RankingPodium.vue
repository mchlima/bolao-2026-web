<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

// Podium panel: header (label + total + share) over the top-3 pedestals.
// Extracted from RankingBoard so it can also stand alone on the pool overview.
const props = defineProps<{ data: RankingResponse; title: string; subtitle?: string }>();

const entries = computed(() => props.data.entries ?? []);
const total = computed(() => props.data.totalParticipants ?? entries.value.length);
const top3 = computed(() => entries.value.slice(0, 3));

const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['84px', '64px', '50px'];
// visual order: 2nd, 1st, 3rd (only the slots that exist)
const podium = computed(() =>
  [top3.value[1], top3.value[0], top3.value[2]]
    .map((e, i) => ({ e, slot: [1, 0, 2][i] }))
    .filter((x) => x.e),
);

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
</script>

<template>
  <div v-if="top3.length" class="rk-panel">
    <div class="rk-head">
      <div class="rk-head-l">
        <span class="rk-eyebrow">Classificação</span>
        <span class="rk-total"><b>{{ total }}</b> participante{{ total === 1 ? '' : 's' }}</span>
      </div>
      <ShareRanking :data="data" :title="title" :subtitle="subtitle" />
    </div>

    <div class="podium">
      <div v-for="{ e, slot } in podium" :key="e.user.id" class="pcol">
        <div
          class="pavatar"
          :style="{ background: color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 22px -4px ${MEDALS[slot]}` }"
        >
          {{ initials(e.user.name) }}
        </div>
        <div class="pname">{{ e.user.name }}</div>
        <div class="font-numeric ppts" :style="{ color: MEDALS[slot] }">{{ e.points }}</div>
        <div
          class="pbar"
          :style="{ height: HEIGHTS[slot], background: `linear-gradient(180deg, ${MEDALS[slot]}, transparent)` }"
        >
          <span class="font-numeric prank">{{ e.rank }}º</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rk-panel {
  background: linear-gradient(150deg, color-mix(in srgb, var(--emerald) 10%, var(--bg-surface)), var(--bg-surface) 62%);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 16px 18px 26px;
}
.rk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 22px;
}
.rk-head-l {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.rk-eyebrow {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.rk-total {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.rk-total b {
  font-weight: 800;
}
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
}
.pcol {
  flex: 1;
  max-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pavatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 17px;
  border: 3px solid;
}
.pname {
  font-size: 13px;
  font-weight: 700;
  margin-top: 9px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.ppts {
  font-size: 24px;
  line-height: 1;
}
.pbar {
  width: 100%;
  margin-top: 8px;
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 9px;
}
.prank {
  font-size: 30px;
  color: #0a0e14;
}
</style>
