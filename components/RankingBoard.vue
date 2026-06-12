<script setup lang="ts">
import type { RankingEntry, RankingResponse } from '~/types/api';

// Presentational ranking board (podium + rows + sticky "me"). Shared by the
// tournament ranking page and the pool ("bolão") detail so both look identical.
const props = defineProps<{ data: RankingResponse }>();

const me = computed(() => props.data.currentUser ?? null);
const entries = computed(() => props.data.entries ?? []);
// Podium shows from 1 participant up; it renders only the slots that exist
// (no empty pedestals), so 1 → just 1st, 2 → 1st+2nd, 3+ → full top 3.
const top3 = computed(() => entries.value.slice(0, 3));
const rest = computed(() => entries.value.slice(3));
const inTop = computed(
  () => !!me.value && entries.value.some((e) => e.user.id === me.value!.user.id),
);

const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['84px', '64px', '50px'];
// visual order: 2nd, 1st, 3rd
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
function rowEntry(e: RankingEntry) {
  return { ...e, isMe: me.value?.user.id === e.user.id };
}
</script>

<template>
  <div>
    <p v-if="!entries.length" class="empty muted">
      Ainda não há participantes com palpites por aqui.
    </p>

    <!-- podium -->
    <div v-if="top3.length" class="podium">
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

    <!-- rows -->
    <div class="rows">
      <div
        v-for="e in rest.map(rowEntry)"
        :key="e.user.id"
        class="row"
        :class="{ me: e.isMe }"
      >
        <span class="font-numeric pos">{{ e.rank }}</span>
        <div class="who">
          <span class="av" :style="{ background: color(e.user.id) }">{{ initials(e.user.name) }}</span>
          <span class="nm">{{ e.user.name }}</span>
          <span v-if="e.isMe" class="youtag">Você</span>
        </div>
        <div class="pts"><span class="font-numeric">{{ e.points }}</span><span class="lbl">pts</span></div>
      </div>
    </div>

    <!-- sticky me -->
    <div v-if="me && !inTop" class="sticky">
      <div class="sticky-cap">Sua posição</div>
      <div class="row me big">
        <span class="font-numeric pos gold">{{ me.rank }}º</span>
        <div class="who">
          <span class="av pitch">{{ initials(me.user.name) }}</span>
          <span class="nm">{{ me.user.name }}</span>
          <span class="youtag">Você</span>
        </div>
        <div class="pts"><span class="font-numeric gold">{{ me.points }}</span><span class="lbl">pts</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding: 2rem 0;
  text-align: center;
}
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  margin-bottom: 26px;
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
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.row.me {
  border-color: var(--gold);
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-surface)), var(--bg-surface));
}
.pos {
  font-size: 20px;
  color: var(--muted);
  text-align: center;
}
.pos.gold {
  color: var(--gold);
}
.who {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.av {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 13px;
  flex: 0 0 auto;
}
.av.pitch {
  background: var(--grad-pitch);
}
.nm {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.youtag {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 5px;
  padding: 2px 6px;
  flex: 0 0 auto;
}
.pts {
  text-align: right;
  white-space: nowrap;
}
.pts .font-numeric {
  font-size: 24px;
}
.pts .gold {
  color: var(--gold);
}
.pts .lbl {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  margin-left: 4px;
}
.sticky {
  position: sticky;
  bottom: 14px;
  margin-top: 14px;
  z-index: 15;
}
.sticky-cap {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-align: center;
  margin-bottom: 6px;
}
.row.big {
  box-shadow: 0 14px 34px -10px rgba(244, 184, 30, 0.5);
}
.row.big .pos {
  font-size: 26px;
}
.row.big .pts .font-numeric {
  font-size: 26px;
}
</style>
