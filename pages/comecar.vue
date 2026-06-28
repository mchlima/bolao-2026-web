<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';

// Onboarding pós-cadastro (sem convite): termina no PRIMEIRO PALPITE, não na home.
// Reusa MatchList (mesma UI de palpite, salva em /predictions global — não precisa
// de bolão pra cravar). Depois do 1º palpite, revela o CTA "entre num bolão".
definePageMeta({ middleware: 'auth' });

const { track } = useTrack();
const siteUrl = String(useRuntimeConfig().public.siteUrl);

// Próximos jogos abertos (na janela da Copa, são os jogos dela). Limita aos
// primeiros pra não sobrecarregar quem acabou de chegar.
const { data, pending } = await useAsyncData('comecar-agenda', () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=upcoming&limit=40'),
);
const now = useNow();
const matches = computed<Match[]>(() =>
  (data.value?.days ?? [])
    .flatMap((d) => d.matches)
    .filter((m) => m.status === 'SCHEDULED')
    .sort(listingComparator(now.value))
    .slice(0, 8),
);

// Palpites já feitos (semeiam os cards) + atualização ao salvar.
const { data: preds } = await useAsyncData('comecar-me', () =>
  useApi()<Prediction[]>('/predictions/me').catch(() => [] as Prediction[]),
);
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of preds.value ?? []) m[p.matchId] = p;
  predMap.value = m;
});

const hasPalpite = computed(() => Object.keys(predMap.value).length > 0);
let firstTracked = false;
function onSaved(p: Prediction) {
  const wasEmpty = !hasPalpite.value;
  predMap.value = { ...predMap.value, [p.matchId]: p };
  if (wasEmpty && !firstTracked) {
    firstTracked = true;
    track('onboarding_primeiro_palpite', { match_id: p.matchId });
  }
}

useSeoMeta({ title: 'Comece por aqui — Cravei', robots: 'noindex' });
useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/comecar` }] });
</script>

<template>
  <div class="page container">
    <section class="welcome">
      <span class="eyebrow">Bem-vindo ao Cravei</span>
      <h1 class="wtitle">Comece cravando seus palpites</h1>
      <p class="wsub">
        Acerte os placares dos próximos jogos. Um palpite vale em todos os seus bolões —
        você nem precisa estar em um ainda.
      </p>
    </section>

    <SkeletonList v-if="pending && !data" variant="card" :count="4" />

    <EmptyState
      v-else-if="!matches.length"
      icon="ball"
      title="Sem jogos abertos agora"
      description="Assim que a próxima rodada abrir, os jogos aparecem aqui pra você palpitar."
    >
      <template #action>
        <NuxtLink to="/futebol/agenda" class="btn btn-primary">Ver a agenda</NuxtLink>
      </template>
    </EmptyState>

    <template v-else>
      <MatchList :matches="matches" :predictions="predMap" show-season @saved="onSaved" />

      <div class="next" :class="{ on: hasPalpite }">
        <div class="next-in">
          <div class="next-txt">
            <strong class="next-t">{{ hasPalpite ? 'Boa! Palpite cravado 🎉' : 'Já cravou? Próximo passo' }}</strong>
            <p class="next-s">Entre num bolão pra pontuar e competir com a galera no ranking.</p>
          </div>
          <NuxtLink to="/boloes" class="btn btn-primary next-cta">Entrar num bolão</NuxtLink>
        </div>
      </div>

      <NuxtLink to="/" class="skip">Pular por agora</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding-top: 22px;
  padding-bottom: 40px;
  max-width: 760px;
}
.welcome {
  margin-bottom: 18px;
}
.eyebrow {
  display: inline-block;
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gold);
  margin-bottom: 6px;
}
.wtitle {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-2xl);
  text-transform: uppercase;
  letter-spacing: 0.01em;
  margin: 0 0 8px;
}
.wsub {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-base);
  max-width: 60ch;
}
/* CTA pós-palpite — discreto antes do 1º palpite, acende (borda/realce) depois. */
.next {
  margin-top: 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-surface);
  padding: 16px 18px;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.next.on {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
  background: color-mix(in srgb, var(--gold) 7%, var(--bg-surface));
}
.next-in {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.next-t {
  display: block;
  font-size: var(--fs-base);
  font-weight: 800;
}
.next-s {
  margin: 3px 0 0;
  font-size: var(--fs-sm);
  color: var(--muted);
}
.next-cta {
  flex: none;
}
.skip {
  display: inline-block;
  margin-top: 16px;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--muted);
}
.skip:hover {
  color: var(--text);
}
</style>
