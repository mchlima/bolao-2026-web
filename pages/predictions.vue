<script setup lang="ts">
import type { Prediction } from '~/types/api';

definePageMeta({ middleware: 'auth' });

const { data, pending } = await useAsyncData('my-predictions', () =>
  useApi()<Prediction[]>('/predictions/me'),
);
const predictions = computed(() => data.value ?? []);
const totalPoints = computed(() =>
  predictions.value.reduce((s, p) => s + (p.score?.points ?? 0), 0),
);

const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  ONE_TEAM_SCORE: 'var(--azure)',
  GOAL_DIFF: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  NONE: 'var(--muted)',
};
</script>

<template>
  <div class="page">
    <div class="head">
      <h1 class="font-display">Meus palpites</h1>
      <div class="total card">
        <span class="font-numeric">{{ totalPoints }}</span>
        <span class="cap">pontos</span>
      </div>
    </div>

    <p v-if="pending" class="muted">Carregando…</p>
    <p v-else-if="!predictions.length" class="muted">Você ainda não fez palpites.</p>
    <div v-else class="list">
      <div v-for="p in predictions" :key="p.id" class="card row">
        <TeamBadge :team="p.match.homeTeam" :placeholder="p.match.homeSourceLabel" :size="40" />
        <div class="mid">
          <div class="font-numeric guess">{{ p.homeScore }} : {{ p.awayScore }}</div>
          <div class="when">{{ formatKickoff(p.match.kickoffAt) }}</div>
        </div>
        <TeamBadge :team="p.match.awayTeam" :placeholder="p.match.awaySourceLabel" :size="40" />
        <span
          v-if="p.score"
          class="tier"
          :style="{ color: TIER_COLOR[p.score.tier], borderColor: TIER_COLOR[p.score.tier] }"
        >
          +{{ p.score.points }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.head h1 {
  font-weight: 700;
  font-size: 24px;
  text-transform: uppercase;
}
.total {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 14px;
}
.total .font-numeric {
  font-size: 30px;
  color: var(--gold);
}
.cap {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 40px 1fr 40px auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
}
.mid {
  text-align: center;
}
.guess {
  font-size: 28px;
  line-height: 0.9;
}
.when {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}
.tier {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 20px;
  border: 1px solid;
  border-radius: 999px;
  padding: 2px 10px;
}
</style>
