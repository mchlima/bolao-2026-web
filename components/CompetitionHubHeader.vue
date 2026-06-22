<script setup lang="ts">
// Cabeçalho de conteúdo do campeonato (hub + sub-rotas Jogos/Tabela): delega ao
// PageHero (padrão dos 3 pilares) com eyebrow "Futebol" + logo da competição.
// Quando `current` é passado (Jogos/Tabela), entra como último item do breadcrumb
// e o nome da competição vira link pro hub; o título concatena "Jogos: ...".
const props = defineProps<{
  comp: { name: string; logoUrl: string | null; logoUrlDark: string | null } | null;
  compName: string;
  slug: string;
  /** Sub-página atual (ex.: 'Jogos', 'Tabela'); omitido no hub. */
  current?: string;
}>();

const title = computed(() => (props.current ? `${props.current}: ${props.compName}` : props.compName));

const crumbs = computed(() => {
  const base = [
    { name: 'Início', to: '/' },
    { name: 'Futebol', to: '/futebol' },
    { name: 'Campeonatos', to: '/futebol/campeonato' },
  ];
  return props.current
    ? [...base, { name: props.compName, to: `/futebol/campeonato/${props.slug}` }, { name: props.current }]
    : [...base, { name: props.compName }];
});
</script>

<template>
  <PageHero pillar="Futebol" :title="title" :crumbs="crumbs" :comp="comp" />
</template>
