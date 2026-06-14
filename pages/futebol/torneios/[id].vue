<script setup lang="ts">
// Tournament shell: a slim contextual header (back + title) + <NuxtPage>. No tab
// bar — the tournament home (index) is the menu into Jogos / Tabela / Bolão, and
// each is its own full-space page. The header title/back adapt to the route.
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
      ? `Jogos, tabela de classificação e ranking do bolão de ${current.value.name}. Palpite e acompanhe ao vivo.`
      : 'Jogos, tabela e ranking do torneio.',
  ogTitle: () => (current.value ? `${current.value.name} — Amigos do Bolão` : 'Torneio — Amigos do Bolão'),
  ogDescription: () =>
    current.value ? `Jogos, tabela e ranking de ${current.value.name}.` : 'Jogos, tabela e ranking do torneio.',
});

const SECTIONS: Record<string, string> = {
  jogos: 'Jogos',
  classificacao: 'Tabela',
  ranking: 'Bolão',
};
const section = computed<string | null>(() => {
  const p = route.path;
  if (p.includes('/matches/')) return 'match';
  if (p.endsWith('/jogos')) return 'jogos';
  if (p.endsWith('/classificacao')) return 'classificacao';
  if (p.endsWith('/ranking')) return 'ranking';
  return null; // home
});
const isHome = computed(() => section.value === null);
const isMatch = computed(() => section.value === 'match');
// Section pages show the section label + tournament as subtitle; home/match show
// the tournament name.
const headTitle = computed(() =>
  isHome.value || isMatch.value
    ? (current.value?.name ?? 'Torneio')
    : (SECTIONS[section.value!] ?? 'Torneio'),
);
const headSub = computed(() => (!isHome.value && !isMatch.value ? current.value?.name : null));
const backTo = computed(() => (isHome.value ? '/futebol/torneios' : `/futebol/torneios/${id}`));
// The match view has its own back button, so the shell omits its back there.
const showBack = computed(() => !isMatch.value);

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return (w[0]?.[0] ?? '') + (w[1]?.[0] ?? '');
}
</script>

<template>
  <div class="page">
    <header class="thead">
      <NuxtLink v-if="showBack" :to="backTo" class="back" aria-label="Voltar">
        <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
      </NuxtLink>
      <div v-if="isHome && current" class="brandmark font-display">{{ badge(current.name) }}</div>
      <div class="htitle">
        <span class="ht-main font-display">{{ headTitle }}</span>
        <span v-if="headSub" class="ht-sub">{{ headSub }}</span>
      </div>
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
  align-items: center;
  gap: 11px;
  padding: 6px 0 14px;
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
.ht-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
