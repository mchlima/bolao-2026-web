<script setup lang="ts">
// Área do Bolão → Ranking: a sua posição em cada escopo (GERAL do torneio + cada
// bolão), reusando o StandingHeroSlider (self-contido: busca /me/standings e se
// atualiza ao vivo). Atalho pra abrir o ranking completo de cada bolão.
import type { PoolSummary } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const pools = usePools();
const { data: mine } = await useAsyncData('ranking-pools', () => pools.listMine().catch(() => [] as PoolSummary[]));

useSeoMeta({ title: 'Ranking dos seus bolões — Cravei', robots: 'noindex' });
useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/boloes/ranking` }] });
</script>

<template>
  <div class="page">
    <BolaoSectionNav />
    <PageHeader title="Ranking" subtitle="Sua posição no geral do torneio e em cada bolão." />

    <StandingHeroSlider />

    <section v-if="mine?.length" class="rk-pools">
      <h2 class="rk-h">Abrir ranking completo</h2>
      <div class="rk-grid">
        <NuxtLink v-for="p in (mine as PoolSummary[])" :key="p.id" :to="`/boloes/${p.id}/ranking`" class="rk-card">
          <span class="rk-name font-display">{{ p.name }}</span>
          <span class="rk-meta">{{ p.tournament.name }} · {{ p.memberCount }} {{ p.memberCount === 1 ? 'membro' : 'membros' }}</span>
          <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="rk-go" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { padding: 10px; }
.rk-pools { margin-top: 24px; }
.rk-h { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin: 0 0 12px; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.rk-card {
  position: relative;
  display: flex; flex-direction: column; gap: 3px;
  padding: 14px 38px 14px 16px;
  border: 1px solid var(--border); border-radius: 14px; background: var(--bg-surface);
  text-decoration: none; color: var(--text);
  transition: border-color 0.14s, transform 0.14s;
}
.rk-card:hover { border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); transform: translateY(-1px); }
.rk-name { font-weight: 600; font-size: 15px; }
.rk-meta { font-size: 12px; color: var(--muted); }
.rk-go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
</style>
