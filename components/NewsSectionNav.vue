<script setup lang="ts">
// Sub-navegação da seção de Notícias (descoberta entre Últimas / Categorias / Assuntos).
// Reutilizada no hub, nos índices e nas páginas de termo p/ consistência.
const route = useRoute();
const links = [
  {
    to: '/noticias',
    label: 'Últimas',
    match: (p: string) =>
      p === '/noticias' ||
      (p.startsWith('/noticias/') &&
        !p.startsWith('/noticias/categoria') &&
        !p.startsWith('/noticias/assunto')),
  },
  { to: '/noticias/categoria', label: 'Categorias', match: (p: string) => p.startsWith('/noticias/categoria') },
  { to: '/noticias/assunto', label: 'Assuntos', match: (p: string) => p.startsWith('/noticias/assunto') },
];
</script>

<template>
  <nav class="snav" aria-label="Seções de notícias">
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
  margin-bottom: 22px;
  padding-bottom: 2px;
}
.snav::-webkit-scrollbar { display: none; }
.snav-link {
  flex: 0 0 auto;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  text-decoration: none;
  padding: 7px 15px;
  border-radius: 20px;
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
