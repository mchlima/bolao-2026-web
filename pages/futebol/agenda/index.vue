<script setup lang="ts">
const seoTitle = 'Agenda de jogos — Cravei';
const seoDesc =
  'A agenda de jogos da Copa do Mundo 2026 e dos campeonatos, dia a dia: horários, placar ao vivo e palpites de cada partida, de todos os torneios.';
useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: `${useRuntimeConfig().public.siteUrl}/futebol/agenda`,
  twitterTitle: seoTitle,
  twitterDescription: seoDesc,
});
// Agenda global de todos os torneios. O recorte por campeonato vive no hub do
// campeonato (/futebol/campeonato/<slug>), pra onde o menu e os cards apontam.
</script>

<template>
  <div class="agenda">
    <FutebolSectionNav />
    <PageHero
      pillar="Futebol"
      title="Agenda"
      subtitle="Os jogos de cada dia, de todos os torneios."
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Futebol', to: '/futebol' }, { name: 'Agenda' }]"
    />
    <AgendaFeed />
  </div>
</template>

<style scoped>
.agenda {
  padding: 10px;
}
</style>
