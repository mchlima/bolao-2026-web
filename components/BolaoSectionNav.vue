<script setup lang="ts">
// Sub-navegação da Área do Bolão (chips): Meus bolões / Palpites pendentes /
// Ranking. Acento DOURADO (troféu) — o sotaque visual que separa o bolão do
// portal informativo (azul). Mostrada no topo das telas de nível /boloes.
const route = useRoute();
const links = [
  { to: '/boloes', label: 'Meus bolões', match: (p: string) => p === '/boloes' },
  { to: '/boloes/palpites', label: 'Palpites pendentes', match: (p: string) => p.startsWith('/boloes/palpites') },
  { to: '/boloes/ranking', label: 'Ranking', match: (p: string) => p.startsWith('/boloes/ranking') },
];
</script>

<template>
  <nav class="bnav" aria-label="Área do bolão">
    <NuxtLink
      v-for="l in links"
      :key="l.to"
      :to="l.to"
      class="bnav-link"
      :class="{ active: l.match(route.path) }"
    >
      {{ l.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bnav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 18px;
  padding-bottom: 2px;
}
.bnav::-webkit-scrollbar { display: none; }
.bnav-link {
  flex: 0 0 auto;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  text-decoration: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.bnav-link:hover { color: var(--text); border-color: color-mix(in srgb, var(--gold) 50%, var(--border)); }
.bnav-link.active {
  color: #0a0e14;
  background: var(--gold);
  border-color: var(--gold);
}
</style>
