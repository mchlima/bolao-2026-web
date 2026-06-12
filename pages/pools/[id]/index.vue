<script setup lang="ts">
// /pools/:id → land on the Ranking tab.
const route = useRoute();
await navigateTo(`/pools/${route.params.id}/ranking`, { replace: true });
</script>

<template>
  <div />
</template>
