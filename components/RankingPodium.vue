<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

// Podium panel: header (label + total + share) over the top-3 pedestals.
// Extracted from RankingBoard so it can also stand alone on the pool overview.
// `detailed` mostra cravadas + partidas pontuadas sob os pontos (ranking público
// da competição); nos demais usos (bolão) o pódio segue só com os pontos.
const props = defineProps<{ data: RankingResponse; title: string; subtitle?: string; detailed?: boolean }>();

const entries = computed(() => props.data.entries ?? []);
const total = computed(() => props.data.totalParticipants ?? entries.value.length);
// Só ocupa um lugar no pódio quem JÁ pontuou (> 0); os zerados ficam na tabela.
const scored = computed(() => entries.value.filter((e) => e.points > 0).slice(0, 3));

const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['84px', '64px', '50px'];
// SEMPRE 3 pedestais (ordem visual 2º, 1º, 3º). Lugares sem pontuador ficam
// VAZIOS (placeholder, aguardando alguém subir) — o pódio não some.
const podium = computed(() => [
  { e: scored.value[1] ?? null, slot: 1 },
  { e: scored.value[0] ?? null, slot: 0 },
  { e: scored.value[2] ?? null, slot: 2 },
]);
const posOf = (slot: number) => (slot === 0 ? 1 : slot === 1 ? 2 : 3);

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
  <div v-if="entries.length" class="rk-panel">
    <div class="rk-head">
      <div class="rk-head-l">
        <span class="rk-eyebrow">Classificação</span>
        <span class="rk-total"><b>{{ total }}</b> participante{{ total === 1 ? '' : 's' }}</span>
      </div>
      <ShareRanking :data="data" :title="title" :subtitle="subtitle" />
    </div>

    <div class="podium">
      <div v-for="{ e, slot } in podium" :key="slot" class="pcol" :class="{ champ: slot === 0 && e, empty: !e }">
        <!-- Lugar PREENCHIDO -->
        <template v-if="e">
          <AppIcon v-if="slot === 0" name="trophy" :size="20" :stroke="2" class="pcrown" />
          <div
            class="pavatar"
            :style="{ background: color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 22px -4px ${MEDALS[slot]}` }"
          >
            <img v-if="e.user.avatarUrl" class="pavatar-img" :src="e.user.avatarUrl" alt="" >
            <template v-else>{{ initials(e.user.name) }}</template>
          </div>
          <div class="pname">{{ e.user.name }}</div>
          <div class="font-numeric ppts" :style="{ color: MEDALS[slot] }">{{ e.points }}</div>
          <div class="ppts-l">pts</div>
          <div v-if="detailed" class="pstats">
            <span class="ps"><b class="font-numeric">{{ e.exactCount }}</b><i>crav</i></span>
            <span class="ps"><b class="font-numeric">{{ e.scoredCount }}</b><i>pont</i></span>
          </div>
        </template>
        <!-- Lugar VAZIO (aguardando alguém pontuar) -->
        <template v-else>
          <div class="pavatar pavatar-empty" aria-hidden="true" />
          <div class="pname pname-empty">A definir</div>
        </template>
        <div
          class="pbar"
          :class="{ 'pbar-empty': !e }"
          :style="{ height: HEIGHTS[slot], background: e ? `linear-gradient(180deg, ${MEDALS[slot]}, transparent)` : undefined }"
        >
          <span class="font-numeric prank">{{ e ? e.rank : posOf(slot) }}º</span>
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
  font-size: var(--fs-2xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.rk-total {
  font-size: var(--fs-base);
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
/* 1º lugar em destaque: troféu flutuante sobre o avatar + brilho dourado pulsante. */
.pcrown {
  color: var(--gold);
  margin-bottom: 5px;
  filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--gold) 55%, transparent));
  animation: champFloat 2.6s ease-in-out infinite;
}
.champ .pavatar {
  animation: champGlow 2.2s ease-in-out infinite;
}
@keyframes champGlow {
  0%, 100% { box-shadow: 0 0 16px -4px var(--gold); }
  50% { box-shadow: 0 0 30px 2px var(--gold); }
}
@keyframes champFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .pcrown { animation: none; }
  .champ .pavatar { animation: none; }
}
.pavatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-lg);
  border: 3px solid;
}
.pavatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Lugar vazio: círculo tracejado + pedestal neutro (aguardando pontuar). */
.pavatar-empty {
  background: transparent;
  border: 2px dashed color-mix(in srgb, var(--muted) 45%, transparent);
  box-shadow: none;
}
.pname-empty {
  color: var(--muted);
  font-weight: 600;
}
.pbar-empty {
  background: linear-gradient(180deg, color-mix(in srgb, var(--muted) 20%, transparent), transparent);
}
.pbar-empty .prank {
  color: var(--muted);
}
.pname {
  font-size: var(--fs-sm);
  font-weight: 700;
  margin-top: 9px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.ppts {
  font-size: var(--fs-2xl);
  line-height: 1;
}
.ppts-l {
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-top: 2px;
}
/* cravadas + pontuadas do pódio (ordem: pontos acima, depois crav, pont) */
.pstats {
  display: flex;
  gap: 12px;
  margin-top: 7px;
}
.ps {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
}
.ps b {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--text);
}
.ps i {
  font-style: normal;
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
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
  font-size: var(--fs-3xl);
  color: #0a0e14;
}
</style>
