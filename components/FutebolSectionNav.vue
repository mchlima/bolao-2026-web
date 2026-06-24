<script setup lang="ts">
// Sub-navegação da seção Jogos (chips): Hoje / Ao vivo / Agenda / Campeonatos /
// Seleções. É a fonte da verdade no mobile (o drawer tem a mesma árvore; aqui é
// o contexto in-page + links internos pra SEO). Espelha NewsSectionNav.
const route = useRoute();
const links = [
  { to: '/futebol/jogos-de-hoje', label: 'Hoje', match: (p: string) => p.startsWith('/futebol/jogos-de-hoje') },
  { to: '/futebol/agenda?scope=live', label: 'Ao vivo', match: (p: string) => p.startsWith('/futebol/agenda') && route.query.scope === 'live' },
  { to: '/futebol/agenda', label: 'Agenda', match: (p: string) => p.startsWith('/futebol/agenda') && route.query.scope !== 'live' },
  { to: '/futebol/campeonato', label: 'Campeonatos', match: (p: string) => p.startsWith('/futebol/campeonato') },
  { to: '/futebol/selecoes', label: 'Seleções', match: (p: string) => p.startsWith('/futebol/selecoes') },
];
</script>

<template>
  <nav class="snav" aria-label="Seções de jogos">
    <NuxtLink
      v-for="l in links"
      :key="l.to"
      :to="l.to"
      class="snav-link"
      :class="{ active: l.match(route.path) }"
    >
      {{ l.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.snav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 18px;
  padding-bottom: 2px;
}
.snav::-webkit-scrollbar { display: none; }
.snav-link {
  flex: 0 0 auto;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--muted);
  text-decoration: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.snav-link:hover { color: var(--text); border-color: var(--muted); }
.snav-link.active {
  color: #fff;
  background: var(--azure);
  border-color: var(--azure);
}
</style>
