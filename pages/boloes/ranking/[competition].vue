<script setup lang="ts">
// Ranking PÚBLICO do bolão por competição (BOLÃO > Ranking > <competição>).
// É indexável (SEO/GEO): o anônimo NÃO vê o ranking real (privacidade), vê uma
// landing contextual sobre o bolão daquela competição + CTAs que dão vontade de
// entrar. O logado vê o top-100 da temporada vigente (pódio animado + tabela com
// pontos, cravadas e partidas pontuadas — a ordem do desempate).
import type { CompetitionRankingResponse } from '~/types/api';

const route = useRoute();
const auth = useAuthStore();
const authLink = useAuthLink();
const siteUrl = String(useRuntimeConfig().public.siteUrl);

const slug = computed(() => String(route.params.competition));

const { data } = await useAsyncData(
  () => `comp-ranking-${slug.value}`,
  () =>
    useApi()<CompetitionRankingResponse>(`/competitions/${slug.value}/ranking`).catch(
      () => null,
    ),
  { watch: [slug] },
);

const comp = computed(() => data.value?.competition ?? null);
const season = computed(() => data.value?.season ?? null);
const ranking = computed(() => data.value?.ranking ?? null);
const total = computed(() => data.value?.totalParticipants ?? 0);

const compName = computed(() => comp.value?.name ?? 'Futebol');
const label = computed(() => season.value?.seasonLabel ?? '');
const heroTitle = computed(() => `${compName.value} — Ranking do Bolão`);
const boardSub = computed(
  () => `Ranking do bolão${label.value ? ` · ${label.value}` : ''} · top 100`,
);
const crowd = computed(() => total.value);

const canonical = computed(() => `${siteUrl}/boloes/ranking/${slug.value}`);
const crumbs = computed(() => [
  { name: 'Início', to: '/' },
  { name: 'Bolão', to: auth.isAuthenticated ? '/boloes' : '/bolao-da-copa-do-mundo-2026' },
  { name: `Ranking · ${compName.value}` },
]);

// ---- SEO/GEO ----
const seoTitle = computed(
  () =>
    `${compName.value}${label.value ? ` ${label.value}` : ''}: ranking do bolão — pontos, cravadas e líderes | Cravei`,
);
const seoDesc = computed(
  () =>
    `Acompanhe o ranking do bolão de ${compName.value}: quem mais cravou placares, total de pontos e as primeiras posições${
      crowd.value ? `, com ${crowd.value} participantes na disputa` : ''
    }. Crie sua conta grátis, dê seus palpites e suba no ranking.`,
);

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDesc.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDesc.value,
  ogUrl: () => canonical.value,
  ogType: 'website',
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDesc.value,
});

const faq = computed(() => [
  {
    q: `Como funciona o ranking do bolão de ${compName.value}?`,
    a: `Você dá palpites nos placares dos jogos de ${compName.value}. A cada partida, ganha pontos pela precisão — acertar o placar exato (a "cravada") vale mais. O ranking soma os pontos de todos os jogos da temporada e mostra as 100 primeiras posições.`,
  },
  {
    q: 'Como é o desempate no ranking?',
    a: 'Empatou em pontos? Desempata quem tem mais cravadas (placares exatos); depois quem tem mais partidas pontuadas; e, por fim, quem palpitou em mais partidas.',
  },
  {
    q: `Quanto custa para participar do bolão de ${compName.value}?`,
    a: 'É grátis. Crie sua conta, faça seus palpites e dispute o ranking com os amigos — dá para criar um bolão privado ou competir no ranking geral.',
  },
]);

useHead({
  link: [{ rel: 'canonical', key: 'canonical', href: () => canonical.value }],
  script: [
    {
      key: 'ld-ranking',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify([
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: heroTitle.value,
            description: seoDesc.value,
            url: canonical.value,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.value.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.name,
              ...(c.to ? { item: `${siteUrl}${c.to}` } : {}),
            })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.value.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]),
    },
  ],
});

const steps = [
  { n: '1', t: 'Palpite nos jogos', d: 'Cravou o placar de cada partida da temporada antes da bola rolar.' },
  { n: '2', t: 'Pontue pela precisão', d: 'Quanto mais perto do resultado, mais pontos. Placar exato é cravada e vale mais.' },
  { n: '3', t: 'Suba no ranking', d: 'Seus pontos somam a cada rodada e te colocam frente a frente com a galera.' },
];
</script>

<template>
  <div class="page">
    <PageHero
      pillar="Bolão"
      :title="heroTitle"
      :subtitle="
        crowd
          ? `${crowd} ${crowd === 1 ? 'palpiteiro está' : 'palpiteiros estão'} disputando o ranking de ${compName}.`
          : `Dê seus palpites em ${compName} e dispute o ranking do bolão.`
      "
      tone="gold"
      icon="trophy"
      :crumbs="crumbs"
    />

    <!-- SEM temporada vigente -->
    <section v-if="!season" class="empty-state">
      <AppIcon name="trophy" :size="34" :stroke="1.6" />
      <h2>Ranking em breve</h2>
      <p>Ainda não há uma temporada ativa de {{ compName }} por aqui. Volte quando a competição começar para disputar o ranking.</p>
      <NuxtLink to="/futebol/campeonato" class="btn btn-gold">Ver campeonatos</NuxtLink>
    </section>

    <template v-else>
      <!-- LOGADO: ranking real -->
      <RankingBoard
        v-if="ranking"
        :data="ranking"
        :title="compName"
        :subtitle="boardSub"
        detailed
      />

      <!-- ANÔNIMO: teaser + CTA (sem expor dados de ninguém) -->
      <section v-else class="locked">
        <div class="locked-card">
          <span class="locked-ico"><AppIcon name="trophy" :size="26" :stroke="1.8" /></span>
          <h2>Quem está liderando o bolão de {{ compName }}?</h2>
          <p>
            O ranking completo — pódio, pontos e cravadas de cada participante — é
            exclusivo para quem está na disputa.
            <template v-if="crowd"> Já são <b>{{ crowd }}</b> palpiteiros no páreo.</template>
          </p>
          <div class="locked-cta">
            <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold">Criar conta grátis</NuxtLink>
            <NuxtLink :to="authLink('/entrar')" class="btn">Entrar</NuxtLink>
          </div>
        </div>

        <!-- pódio "borrado" só ilustrativo (sem nomes reais) -->
        <div class="ghost-podium" aria-hidden="true">
          <div v-for="(h, i) in [64, 84, 50]" :key="i" class="gp-col">
            <span class="gp-av" :class="{ champ: i === 1 }" />
            <span class="gp-bar" :style="{ height: `${h}px` }">{{ [2, 1, 3][i] }}º</span>
          </div>
        </div>
      </section>

      <!-- COMO FUNCIONA (vale p/ todos; gera desejo + conteúdo SSR p/ SEO/GEO) -->
      <section class="how">
        <h2 class="sec-h">Como funciona o bolão de {{ compName }}</h2>
        <div class="how-grid">
          <div v-for="s in steps" :key="s.n" class="how-card">
            <span class="how-n">{{ s.n }}</span>
            <h3>{{ s.t }}</h3>
            <p>{{ s.d }}</p>
          </div>
        </div>
      </section>

      <!-- FAQ (GEO: respostas diretas + JSON-LD acima) -->
      <section class="faq">
        <h2 class="sec-h">Perguntas frequentes</h2>
        <details v-for="(f, i) in faq" :key="i" class="faq-item" :open="i === 0">
          <summary>{{ f.q }}</summary>
          <p>{{ f.a }}</p>
        </details>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 10px; }

/* estado vazio / sem temporada */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  padding: 48px 16px;
  color: var(--muted);
}
.empty-state h2 { font-family: 'Oswald', sans-serif; font-size: 22px; color: var(--text); margin: 4px 0 0; }
.empty-state p { max-width: 46ch; font-size: 14px; line-height: 1.55; margin: 0 0 6px; }

/* teaser do anônimo */
.locked { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; align-items: center; margin-bottom: 8px; }
.locked-card {
  background: linear-gradient(150deg, color-mix(in srgb, var(--gold) 12%, var(--bg-surface)), var(--bg-surface) 62%);
  border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--border));
  border-radius: 20px;
  padding: 24px;
}
.locked-ico {
  display: inline-grid; place-items: center;
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--bg-surface); border: 1px solid var(--border); color: var(--gold);
  margin-bottom: 12px;
}
.locked-card h2 { font-family: 'Oswald', sans-serif; font-size: clamp(20px, 3.6vw, 26px); line-height: 1.1; margin: 0 0 8px; }
.locked-card p { font-size: 14.5px; line-height: 1.55; color: var(--muted); margin: 0 0 18px; max-width: 50ch; }
.locked-cta { display: flex; gap: 10px; flex-wrap: wrap; }

.ghost-podium { display: flex; align-items: flex-end; justify-content: center; gap: 12px; padding: 10px; filter: blur(0.5px); opacity: 0.85; }
.gp-col { flex: 1; max-width: 110px; display: flex; flex-direction: column; align-items: center; }
.gp-av {
  width: 50px; height: 50px; border-radius: 50%;
  background: repeating-linear-gradient(135deg, var(--bg-surface), var(--bg-surface) 6px, color-mix(in srgb, var(--muted) 18%, var(--bg-surface)) 6px, color-mix(in srgb, var(--muted) 18%, var(--bg-surface)) 12px);
  border: 3px solid var(--border);
}
.gp-av.champ { border-color: var(--gold); box-shadow: 0 0 18px -4px var(--gold); }
.gp-bar {
  width: 100%; margin-top: 8px; border-radius: 12px 12px 0 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--muted) 30%, transparent), transparent);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 8px;
  font-family: 'Oswald', sans-serif; font-weight: 700; color: var(--muted);
}

/* seções de conteúdo */
.sec-h { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin: 28px 0 14px; }
.how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.how-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.how-n {
  display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
  background: var(--grad-trophy, linear-gradient(135deg, #ffb020, #ff7a59));
  color: #0a0e14; font-family: 'Oswald', sans-serif; font-weight: 700; margin-bottom: 10px;
}
.how-card h3 { font-size: 15px; font-weight: 700; margin: 0 0 5px; }
.how-card p { font-size: 13.5px; line-height: 1.5; color: var(--muted); margin: 0; }

.faq-item { border: 1px solid var(--border); border-radius: 14px; padding: 4px 16px; margin-bottom: 8px; background: var(--bg-surface); }
.faq-item summary { cursor: pointer; padding: 12px 0; font-size: 15px; font-weight: 700; list-style: none; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item p { margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: var(--muted); }

@media (max-width: 720px) {
  .locked { grid-template-columns: 1fr; }
  .ghost-podium { order: -1; }
  .how-grid { grid-template-columns: 1fr; }
}
</style>
