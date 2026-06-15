<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

const auth = useAuthStore();
const route = useRoute();
const id = route.params.id as string;

// The ranking is members-only (the API requires auth). Skip the request entirely
// when logged out and show a login gate instead.
const { data, pending, error, refresh } = await useAsyncData(`ranking-${id}`, () =>
  auth.token
    ? useApi()<RankingResponse>(`/seasons/${id}/ranking`)
    : Promise.resolve(null),
);
useRealtime(() => (auth.token ? [`tournament:${id}`] : []), () => refresh());
</script>

<template>
  <div>
    <div v-if="!auth.isAuthenticated" class="gate">
      <div class="gate-ic"><AppIcon name="users" :size="26" :stroke="1.8" /></div>
      <h3 class="font-display">Entre para ver o ranking</h3>
      <p class="muted">O ranking do bolão mostra a pontuação dos participantes — disponível para quem tem conta. Entre ou cadastre-se para acompanhar.</p>
      <div class="gate-actions">
        <NuxtLink to="/login" class="btn btn-gold">Entrar</NuxtLink>
        <NuxtLink to="/register" class="btn">Criar conta</NuxtLink>
      </div>
    </div>
    <SkeletonList v-else-if="pending && !data" variant="row" :count="8" />
    <p v-else-if="error || !data" class="muted load">Ranking indisponível.</p>
    <template v-else>
      <div class="head">
        <h3 class="font-display">Ranking do bolão</h3>
        <span class="sub">Top 100 de {{ data.totalParticipants }} participantes</span>
      </div>

      <RankingBoard :data="data" />
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.load {
  padding: 2rem 0;
}
.back {
  display: inline-block;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 16px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 18px;
}
.head h3 {
  font-weight: 600;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sub {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
.gate {
  max-width: 380px;
  margin: 6vh auto 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.gate-ic {
  width: 60px;
  height: 60px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--muted);
}
.gate h3 {
  font-weight: 700;
  font-size: clamp(18px, 4.6vw, 22px);
  text-transform: uppercase;
  line-height: 1.1;
}
.gate p {
  font-size: 14px;
  line-height: 1.5;
}
.gate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
}
</style>
