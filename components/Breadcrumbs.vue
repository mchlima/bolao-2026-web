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
    <!-- Cada segmento = [separador líder] + crumb, agrupados (inline-flex, nowrap) →
         na quebra de linha o "›" desce JUNTO com o crumb seguinte em vez de ficar
         pendurado no fim da linha anterior. -->
    <span v-for="(it, i) in items" :key="i" class="seg" :class="{ cur: i === items.length - 1 }">
      <AppIcon v-if="i > 0" name="chevronRight" :size="13" :stroke="2.4" class="sep" />
      <NuxtLink v-if="it.to && i < items.length - 1" :to="it.to" class="crumb">{{ it.name }}</NuxtLink>
      <span v-else class="crumb cur" aria-current="page">{{ it.name }}</span>
    </span>
  </nav>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: nowrap; /* uma linha só */
  align-items: center;
  gap: 5px;
  font-size: var(--fs-sm);
  margin-bottom: 14px;
  max-width: 100%;
  /* Trilha profunda (até 6 níveis) não cabe no mobile → a FAIXA rola na horizontal
     (a página não), sem quebra e sem "›" órfão. Scrollbar escondida. */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
  -webkit-overflow-scrolling: touch;
  /* Fade na borda direita sinaliza que a faixa continua (rolável) em vez de um
     corte seco no meio de uma palavra. */
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent);
}
.crumbs::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
.seg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none; /* não encolhe → conteúdo natural, rola se passar da largura */
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
}
.sep {
  color: var(--muted);
  opacity: 0.5;
  flex: none;
}
</style>
