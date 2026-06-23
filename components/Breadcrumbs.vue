<script setup lang="ts">
// Trilha de navegação reusável: renderiza a nav visível E emite o BreadcrumbList
// (JSON-LD) — fonte única, sempre com a URL final (sem redirect). O último item é
// a página atual (sem link).
const props = defineProps<{ items: { name: string; to?: string }[] }>();
const siteUrl = String(useRuntimeConfig().public.siteUrl);

useHead({
  script: [
    {
      key: 'ld-breadcrumbs',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: props.items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            ...(it.to ? { item: `${siteUrl}${it.to}` } : {}),
          })),
        }),
    },
  ],
});
</script>

<template>
  <nav class="crumbs" aria-label="Trilha">
    <template v-for="(it, i) in items" :key="i">
      <NuxtLink v-if="it.to && i < items.length - 1" :to="it.to" class="crumb">{{ it.name }}</NuxtLink>
      <span v-else class="crumb cur" aria-current="page">{{ it.name }}</span>
      <AppIcon v-if="i < items.length - 1" name="chevronRight" :size="13" :stroke="2.4" class="sep" />
    </template>
  </nav>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  margin-bottom: 14px;
}
.crumb {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}
.crumb:hover {
  color: var(--text);
}
.crumb.cur {
  color: var(--text);
  font-weight: 700;
  /* Página atual (ex.: título da matéria) pode ser uma frase longa → trunca com
     reticências em vez de estourar a largura (no mobile/PWA virava scroll lateral).
     min-width:0 + flex-shrink deixam o item encolher abaixo do tamanho do conteúdo. */
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sep {
  color: var(--muted);
  opacity: 0.5;
  flex: none;
}
</style>
