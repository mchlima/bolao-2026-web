<script setup lang="ts">
// Tournament shell: a contextual header (back + badge + tournament name) with the
// section tabs (Jogos / Tabela / Bolão) as pill tags, then <NuxtPage>. Each tab is
// a nested route, so switching one swaps ONLY the page content — the header and
// tabs stay mounted. The base route redirects to Jogos (see index.vue), so there
// is no separate overview; the active tag marks the section instead of the title.
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
  title: () => (current.value ? `${current.value.name} — Cravei` : 'Torneio — Cravei'),
  description: () =>
    current.value
      ? `Jogos, tabela de classificação e ranking do bolão de ${current.value.name}. Palpite e acompanhe ao vivo.`
      : 'Jogos, tabela e ranking do torneio.',
  ogTitle: () => (current.value ? `${current.value.name} — Cravei` : 'Torneio — Cravei'),
  ogDescription: () =>
    current.value ? `Jogos, tabela e ranking de ${current.value.name}.` : 'Jogos, tabela e ranking do torneio.',
});

// Active section from the route. The base path (which redirects to /jogos) and
// /jogos both resolve to 'jogos', so the Jogos tag stays lit through the redirect.
const section = computed<string>(() => {
  const p = route.path;
  if (p.includes('/matches/')) return 'match';
  if (p.endsWith('/classificacao')) return 'classificacao';
  if (p.endsWith('/ranking')) return 'ranking';
  return 'jogos';
});
const isMatch = computed(() => section.value === 'match');

const tabs = computed(() => [
  { key: 'jogos', label: 'Jogos', to: `/futebol/torneios/${id}/jogos` },
  { key: 'classificacao', label: 'Tabela', to: `/futebol/torneios/${id}/classificacao` },
  { key: 'ranking', label: 'Bolão', to: `/futebol/torneios/${id}/ranking` },
]);

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return (w[0]?.[0] ?? '') + (w[1]?.[0] ?? '');
}
</script>

<template>
  <div class="page">
    <header class="thead">
      <div class="trow">
        <NuxtLink v-if="!isMatch" to="/futebol/torneios" class="back" aria-label="Voltar">
          <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
        </NuxtLink>
        <div v-if="current && !isMatch" class="brandmark font-display">{{ badge(current.name) }}</div>
        <div class="htitle">
          <span class="ht-main font-display">{{ current?.name ?? 'Torneio' }}</span>
        </div>
      </div>

      <!-- Section tabs: route-based pill tags; clicking swaps only <NuxtPage>. -->
      <nav v-if="!isMatch" class="ttabs" aria-label="Seções do torneio">
        <NuxtLink
          v-for="t in tabs"
          :key="t.key"
          :to="t.to"
          class="ttag"
          :class="{ on: section === t.key }"
          :aria-current="section === t.key ? 'page' : undefined"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>
    </header>

    <NuxtPage />
  </div>
</template>

<style scoped>
.page {
  padding: 0 0 40px;
}
.thead {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 6px 0 16px;
}
.trow {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.back {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
}
.back:hover {
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.brandmark {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}
.htitle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ht-main {
  font-weight: 700;
  font-size: clamp(17px, 4.4vw, 24px);
  text-transform: uppercase;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Section tabs — small pill tags. Active uses the pitch gradient, matching the
   tournament badge so the lit tag reads as "you're in this section". */
.ttabs {
  display: flex;
  gap: 8px;
}
.ttag {
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ttag:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.ttag.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
