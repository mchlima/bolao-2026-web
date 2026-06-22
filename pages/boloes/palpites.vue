<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';

// Área do Bolão → Palpites pendentes: a tela onde se CRAVA, em lote, os jogos
// abertos (desacoplado da vitrine informativa, que é só leitura). Lista vertical
// pensada pro mobile (stepper grande, um jogo por vez). Palpite é global/único.
const siteUrl = String(useRuntimeConfig().public.siteUrl);

const { data, pending, refresh } = await useAsyncData('palpites-agenda', () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=upcoming&limit=100'),
);
const matches = computed<Match[]>(() => (data.value?.days ?? []).flatMap((d) => d.matches));

// Palpites já feitos (semeiam os cards) + atualização ao salvar.
const { data: preds } = await useAsyncData('palpites-me', () =>
  useApi()<Prediction[]>('/predictions/me').catch(() => [] as Prediction[]),
);
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of preds.value ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

const now = useNow();
const sorted = computed(() => [...matches.value].sort(listingComparator(now.value)));
// "Pendentes" = jogos abertos ainda sem palpite (pro contador do cabeçalho).
const pendingCount = computed(
  () => matches.value.filter((m) => m.status === 'SCHEDULED' && !predMap.value[m.id]).length,
);

// Realtime: refaz quando o robô mexe nos torneios em jogo.
const liveChannels = computed(() =>
  [...new Set(matches.value.map((m) => m.seasonId).filter(Boolean))].map((s) => `tournament:${s}`),
);
useRealtime(() => liveChannels.value, () => refresh());

useSeoMeta({ title: 'Palpites pendentes — Cravei', robots: 'noindex' });
useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/boloes/palpites` }] });
</script>

<template>
  <div class="page">
    <BolaoSectionNav />
    <PageHeader title="Palpites pendentes" subtitle="Crave os placares dos próximos jogos. Um palpite vale em todos os seus bolões.">
      <template v-if="pendingCount" #actions>
        <span class="pend-chip">{{ pendingCount }} {{ pendingCount === 1 ? 'jogo sem palpite' : 'jogos sem palpite' }}</span>
      </template>
    </PageHeader>

    <SkeletonList v-if="pending && !data" variant="card" :count="4" />

    <EmptyState
      v-else-if="!sorted.length"
      icon="check"
      title="Nada pendente por aqui"
      description="Não há jogos abertos pra palpitar agora. Assim que a próxima rodada abrir, ela aparece aqui."
    >
      <template #action>
        <NuxtLink to="/futebol/agenda" class="btn btn-primary">Ver a agenda</NuxtLink>
      </template>
    </EmptyState>

    <MatchList v-else :matches="sorted" :predictions="predMap" show-season @saved="onSaved" />
  </div>
</template>

<style scoped>
.page { padding: 10px; }
.pend-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; font-weight: 800; color: #0a0e14;
  background: var(--gold); border-radius: 999px; padding: 5px 12px;
}
</style>
