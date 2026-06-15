<script setup lang="ts">
// The tournament base route has no overview of its own — it lands on the Jogos
// tab. The section tabs (Jogos / Tabela / Bolão) live in the shell ([id].vue), so
// every section is reachable from there; this route just forwards to the default.
const route = useRoute();
await navigateTo(`/futebol/torneios/${route.params.id}/jogos`, {
  replace: true,
  redirectCode: 302,
});
</script>

<template>
  <div />
</template>
