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
useSeoMeta({
  title: () => (current.value ? `${current.value.name} — Amigos do Bolão` : 'Torneio — Amigos do Bolão'),
  description: () =>
    current.value
      ? `Classificação, fases, rodadas e ranking de ${current.value.name}. Palpite e acompanhe ao vivo.`
      : 'Classificação, fases, rodadas e ranking do torneio.',
  ogTitle: () => (current.value ? `${current.value.name} — Amigos do Bolão` : 'Torneio — Amigos do Bolão'),
  ogDescription: () =>
    current.value
      ? `Classificação, fases e ranking de ${current.value.name}.`
      : 'Classificação, fases e ranking do torneio.',
});
const activeTab = computed(() => {
  if (route.path.endsWith('/ranking')) return 'ranking';
  if (route.path.endsWith('/classificacao')) return 'classificacao';
  if (route.path.endsWith('/jogos')) return 'jogos';
  return 'overview';
});

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
          <span v-if="current.matchCount != null" class="tag">{{ current.matchCount }} partidas</span>
        </div>
      </div>
    </div>

    <nav class="tabs">
      <NuxtLink :to="`/futebol/torneios/${id}`" class="tab" :class="{ on: activeTab === 'overview' }">Visão geral</NuxtLink>
      <NuxtLink :to="`/futebol/torneios/${id}/jogos`" class="tab" :class="{ on: activeTab === 'jogos' }">Jogos</NuxtLink>
      <NuxtLink :to="`/futebol/torneios/${id}/classificacao`" class="tab" :class="{ on: activeTab === 'classificacao' }">Classificação</NuxtLink>
      <NuxtLink :to="`/futebol/torneios/${id}/ranking`" class="tab" :class="{ on: activeTab === 'ranking' }">Ranking</NuxtLink>
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
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tab {
  flex: 1 1 auto;
  text-align: center;
  padding: 10px 8px;
  border-radius: 10px;
  font-weight: 700;
  font-size: clamp(11.5px, 2.9vw, 13.5px);
  white-space: nowrap;
  color: var(--muted);
  cursor: pointer;
  text-decoration: none;
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
}
</style>
