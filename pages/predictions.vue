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
</script>

<template>
  <section>
    <h1>Meus palpites</h1>
    <p class="muted">
      Total de pontos: <strong class="pts">{{ totalPoints }}</strong>
    </p>
    <p v-if="pending" class="muted">Carregando…</p>
    <p v-else-if="!predictions.length" class="muted">
      Você ainda não fez palpites.
    </p>
    <div v-else class="list">
      <div v-for="p in predictions" :key="p.id" class="card row">
        <div class="teams">
          <TeamBadge :team="p.match.homeTeam" :placeholder="p.match.homeSourceLabel" />
          <span class="guess">{{ p.homeScore }}×{{ p.awayScore }}</span>
          <TeamBadge
            :team="p.match.awayTeam"
            :placeholder="p.match.awaySourceLabel"
            align="right"
          />
        </div>
        <div class="foot muted">
          <span>{{ formatKickoff(p.match.kickoffAt) }}</span>
          <span v-if="p.score">
            {{ tierLabel(p.score.tier) }} <strong class="pts">+{{ p.score.points }}</strong>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.row {
  padding: 0.75rem 0.85rem;
}
.teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
}
.guess {
  font-weight: 800;
  white-space: nowrap;
}
.foot {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}
.pts {
  color: var(--primary);
}
</style>
