<script setup lang="ts">
import type { RankingEntry, RankingResponse } from '~/types/api';

// Presentational ranking board (podium + rows + sticky "me"). Shared by the
// tournament ranking page and the pool ("bolão") detail so both look identical.
// `title`/`subtitle` name the leaderboard (tournament or pool) for the header
// and the shareable image.
// `detailed` adiciona as colunas de cravadas + partidas pontuadas (a ordem do
// desempate) — usado no ranking público da competição; os demais usos (bolão)
// seguem com a coluna única de pontos.
const props = defineProps<{
  data: RankingResponse;
  title: string;
  subtitle?: string;
  detailed?: boolean;
}>();

const me = computed(() => props.data.currentUser ?? null);
const entries = computed(() => props.data.entries ?? []);
// Só vai pro pódio quem pontuou (> 0), no máx. 3 — mesma regra do RankingPodium.
// Antes de pontuar o pódio fica vazio e TODOS aparecem na tabela.
const podiumCount = computed(
  () => Math.min(3, entries.value.filter((e) => e.points > 0).length),
);
// As linhas listam todo mundo que não está no pódio (inclui os zerados).
const rest = computed(() => entries.value.slice(podiumCount.value));
const inTop = computed(
  () => !!me.value && entries.value.some((e) => e.user.id === me.value!.user.id),
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

    <template v-else>
      <RankingPodium :data="data" :title="title" :subtitle="subtitle" :detailed="detailed" class="rk-podium" />

      <!-- rows -->
      <div v-if="rest.length" class="rows">
        <div
          v-for="e in rest.map(rowEntry)"
          :key="e.user.id"
          class="row"
          :class="{ me: e.isMe, detailed }"
        >
        <span class="font-numeric pos">{{ e.rank }}</span>
        <div class="who">
          <span class="av" :style="{ background: color(e.user.id) }">
            <img v-if="e.user.avatarUrl" class="av-img" :src="e.user.avatarUrl" alt="" >
            <template v-else>{{ initials(e.user.name) }}</template>
          </span>
          <span class="nm">{{ e.user.name }}</span>
          <span v-if="e.isMe" class="youtag">Você</span>
        </div>
        <div class="pts"><span class="font-numeric">{{ e.points }}</span><span class="lbl">pts</span></div>
        <template v-if="detailed">
          <div class="stat"><span class="font-numeric">{{ e.exactCount }}</span><span class="lbl">crav</span></div>
          <div class="stat"><span class="font-numeric">{{ e.scoredCount }}</span><span class="lbl">pont</span></div>
        </template>
      </div>
    </div>

    <!-- sticky me -->
    <div v-if="me && !inTop" class="sticky">
      <div class="sticky-cap">Sua posição</div>
      <div class="row me big" :class="{ detailed }">
        <span class="font-numeric pos gold">{{ me.rank }}º</span>
        <div class="who">
          <span class="av pitch">
            <img v-if="me.user.avatarUrl" class="av-img" :src="me.user.avatarUrl" alt="" >
            <template v-else>{{ initials(me.user.name) }}</template>
          </span>
          <span class="nm">{{ me.user.name }}</span>
          <span class="youtag">Você</span>
        </div>
        <div class="pts"><span class="font-numeric gold">{{ me.points }}</span><span class="lbl">pts</span></div>
        <template v-if="detailed">
          <div class="stat"><span class="font-numeric">{{ me.exactCount }}</span><span class="lbl">crav</span></div>
          <div class="stat"><span class="font-numeric">{{ me.scoredCount }}</span><span class="lbl">pont</span></div>
        </template>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.empty {
  padding: 2rem 0;
  text-align: center;
}
.rk-podium {
  display: block;
  margin-bottom: 14px;
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
/* Modo detalhado: ordem PONTOS · CRAVADAS · PONTUADAS (ordem do desempate). */
.row.detailed {
  grid-template-columns: 36px 1fr auto auto auto;
  gap: 14px;
}
.stat {
  text-align: right;
  white-space: nowrap;
}
/* Os três números (pts/crav/pont) com o MESMO tamanho, empilhados (nº + rótulo). */
.row.detailed .pts,
.row.detailed .stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.05;
}
.row.detailed .pts .font-numeric,
.row.detailed .stat .font-numeric {
  font-size: var(--fs-2xl);
}
.row.detailed .stat .font-numeric {
  color: var(--text);
}
.row.detailed .pts .lbl,
.row.detailed .stat .lbl {
  margin-left: 0;
  margin-top: 2px;
  font-size: var(--fs-2xs);
}
.row.me {
  border-color: var(--gold);
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-surface)), var(--bg-surface));
}
.pos {
  font-size: var(--fs-xl);
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
  overflow: hidden;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-sm);
  flex: 0 0 auto;
}
.av-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.av.pitch {
  background: var(--grad-pitch);
}
.nm {
  font-size: var(--fs-sm);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.youtag {
  font-size: var(--fs-2xs);
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
  font-size: var(--fs-2xl);
}
.pts .gold {
  color: var(--gold);
}
.pts .lbl {
  font-size: var(--fs-2xs);
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
  font-size: var(--fs-2xs);
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
  font-size: var(--fs-2xl);
}
.row.big .pts .font-numeric,
.row.big.detailed .stat .font-numeric {
  font-size: var(--fs-2xl);
}
</style>
