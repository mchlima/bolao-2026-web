<script setup lang="ts">
// Tournament layout: header + tab bar (Partidas · Ranking) + <NuxtPage>. Each
// tab is its own route, so the URL reflects the tab and the chrome stays put.
import type { Paginated, Tournament } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data: tournaments } = await useAsyncData('tournaments-list', () =>
  useApi()<Paginated<Tournament>>('/seasons?pageSize=100').then((r) => r.data),
);
const current = computed(
  () => (tournaments.value ?? []).find((t) => t.id === id) ?? null,
);
const activeTab = computed(() => {
  if (route.path.endsWith('/ranking')) return 'ranking';
  if (route.path.endsWith('/fases')) return 'fases';
  return 'matches';
});

function onPickTournament(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  if (v && v !== id) navigateTo(`/tournaments/${v}`);
}
function badge(name: string): string {
  const w = name
    .split(/\s+/)
    .filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return (w[0]?.[0] ?? '') + (w[1]?.[0] ?? '');
}
</script>

<template>
  <div class="page">
    <div v-if="current" class="thead">
      <div class="badge font-display">{{ badge(current.name) }}</div>
      <div class="meta">
        <h1 class="font-display name">{{ current.name }}</h1>
        <div class="tags">
          <span class="tag azure">Grupos + mata-mata</span>
          <span v-if="current.matchCount != null" class="tag">{{ current.matchCount }} partidas</span>
        </div>
      </div>
      <select
        v-if="(tournaments?.length ?? 0) > 1"
        class="tourn-sel"
        :value="id"
        aria-label="Trocar de torneio"
        @change="onPickTournament"
      >
        <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>

    <nav class="tabs">
      <NuxtLink :to="`/tournaments/${id}`" class="tab" :class="{ on: activeTab === 'matches' }">Partidas</NuxtLink>
      <NuxtLink :to="`/tournaments/${id}/ranking`" class="tab" :class="{ on: activeTab === 'ranking' }">Ranking</NuxtLink>
      <NuxtLink :to="`/tournaments/${id}/fases`" class="tab" :class="{ on: activeTab === 'fases' }">Fases</NuxtLink>
    </nav>

    <NuxtPage />
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.thead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.badge {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
  font-size: 17px;
  flex: 0 0 auto;
}
.meta {
  flex: 1;
  min-width: 200px;
}
.name {
  font-weight: 700;
  font-size: clamp(22px, 4vw, 30px);
  text-transform: uppercase;
  line-height: 1;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.tag {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
}
.tag.azure {
  color: var(--azure);
  background: rgba(30, 127, 240, 0.14);
  border-color: rgba(30, 127, 240, 0.3);
}
.tourn-sel {
  flex: 0 1 auto;
  max-width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  padding: 0 10px;
  height: 40px;
  cursor: pointer;
}
.tabs {
  display: flex;
  gap: 5px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 5px;
  margin-bottom: 16px;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--muted);
  cursor: pointer;
  text-decoration: none;
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
}
</style>
