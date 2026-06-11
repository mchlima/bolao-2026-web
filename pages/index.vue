<script setup lang="ts">
import type { Paginated, Tournament } from '~/types/api';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  UPCOMING: 'Em breve',
  ONGOING: 'Em andamento',
  FINISHED: 'Encerrado',
};

const { data, pending, error } = await useAsyncData('tournaments', () =>
  useApi()<Paginated<Tournament>>('/tournaments'),
);
const tournaments = computed(() => data.value?.data ?? []);
</script>

<template>
  <section>
    <h1>Torneios</h1>
    <p v-if="pending" class="muted">Carregando…</p>
    <p v-else-if="error" class="muted">Não foi possível carregar os torneios.</p>
    <p v-else-if="!tournaments.length" class="muted">Nenhum torneio ainda.</p>
    <div v-else class="grid">
      <NuxtLink
        v-for="t in tournaments"
        :key="t.id"
        :to="`/tournaments/${t.id}`"
        class="card item"
      >
        <div class="head">
          <h2>{{ t.name }}</h2>
          <span class="badge">{{ STATUS_LABEL[t.status] ?? t.status }}</span>
        </div>
        <p v-if="t.startDate" class="muted">
          {{ formatDate(t.startDate) }} — {{ formatDate(t.endDate) }}
        </p>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.item {
  padding: 1rem;
  transition: border-color 0.15s, transform 0.05s;
}
.item:hover {
  border-color: var(--primary);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.head h2 {
  margin: 0;
  font-size: 1.1rem;
}
</style>
