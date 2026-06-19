<script setup lang="ts">
// Conta → Meus times: seguir times para receber lembrete ~1h antes do jogo.
useSeoMeta({ title: 'Meus times — Cravei' });
</script>

<template>
  <div class="container page">
    <h1 class="page-title">Meus times</h1>
    <div class="card pad">
      <ClientOnly>
        <FollowedTeams />
        <template #fallback>
          <div class="ph">Carregando…</div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding-top: 22px;
  padding-bottom: 40px;
  max-width: 620px;
}
.page-title {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 24px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 16px;
}
.pad {
  padding: 22px;
}
.ph {
  color: var(--muted);
  font-size: 13px;
}
</style>
