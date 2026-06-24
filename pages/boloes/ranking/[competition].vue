<script setup lang="ts">
// Ranking PÚBLICO do bolão por competição (BOLÃO > Ranking > <competição>).
// É indexável (SEO/GEO). O LOGADO vê o top-100 real da temporada vigente. O ANÔNIMO
// vê o MESMO layout de ranking, porém com dados FICTÍCIOS (não expõe ninguém real),
// levemente borrado, com um CTA por cima "escondendo mal" — pra dar desejo de criar
// conta e participar, sem virar uma página de venda.
import type { CompetitionRankingResponse, RankingResponse } from '~/types/api';

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

// Ranking FICTÍCIO pro anônimo (sem expor dados reais). Determinístico (estável no
// SSR). Mostrado borrado, só pra dar desejo — o CTA por cima convida a criar conta.
const FAKE = [
  { name: 'Lucas Andrade', pts: 247 },
  { name: 'Mariana Costa', pts: 231 },
  { name: 'Rafael Oliveira', pts: 218 },
  { name: 'Beatriz Souza', pts: 196 },
  { name: 'Thiago Lima', pts: 180 },
  { name: 'Camila Rocha', pts: 165 },
  { name: 'Pedro Henrique', pts: 151 },
  { name: 'Juliana Alves', pts: 138 },
  { name: 'Gustavo Martins', pts: 120 },
  { name: 'Fernanda Dias', pts: 104 },
  { name: 'Bruno Carvalho', pts: 92 },
];
const fakeRanking = computed<RankingResponse>(() => ({
  entries: FAKE.map((f, i) => ({
    rank: i + 1,
    user: { id: `demo-${i}`, name: f.name, avatarUrl: null },
    points: f.pts,
    exactCount: Math.round(f.pts / 45),
    scoredCount: Math.round(f.pts / 9),
    predictedCount: Math.round(f.pts / 9) + 4,
  })),
  currentUser: null,
  totalParticipants: Math.max(crowd.value, FAKE.length),
}));

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

      <!-- ANÔNIMO: ranking (fictício) borrado + CTA por cima -->
      <section v-else class="preview">
        <div class="preview-blur" aria-hidden="true">
          <RankingBoard :data="fakeRanking" :title="compName" :subtitle="boardSub" detailed />
        </div>
        <div class="preview-cta">
          <div class="pc-card">
            <span class="pc-ico"><AppIcon name="trophy" :size="26" :stroke="1.8" /></span>
            <h2>Veja o ranking do bolão de {{ compName }}</h2>
            <p>
              Crie sua conta grátis pra ver o ranking de verdade e entrar na disputa<template v-if="crowd"> com <b>{{ crowd }}</b> {{ crowd === 1 ? 'palpiteiro' : 'palpiteiros' }}</template>.
            </p>
            <div class="pc-btns">
              <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold">Criar conta grátis</NuxtLink>
              <NuxtLink :to="authLink('/entrar')" class="btn">Entrar</NuxtLink>
            </div>
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
.empty-state h2 { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xl); color: var(--text); margin: 4px 0 0; }
.empty-state p { max-width: 46ch; font-size: var(--fs-sm); line-height: 1.55; margin: 0 0 6px; }

/* anônimo: ranking fictício borrado + CTA sobreposto */
.preview { position: relative; margin-bottom: 8px; }
.preview-blur {
  filter: blur(3.5px);
  pointer-events: none;
  user-select: none;
  max-height: 540px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent);
  mask-image: linear-gradient(to bottom, #000 60%, transparent);
}
.preview-cta {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  /* leve foco no card sem esconder demais o ranking atrás */
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-base) 35%, transparent), transparent 75%);
}
.pc-card {
  text-align: center;
  max-width: 440px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 26px 24px;
  box-shadow: var(--shadow-lg, 0 22px 50px rgba(8, 12, 18, 0.28));
}
.pc-ico {
  display: inline-grid; place-items: center;
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--bg-surface); border: 1px solid var(--border); color: var(--gold);
  margin-bottom: 12px;
}
.pc-card h2 { font-family: 'Oswald', sans-serif; font-size: clamp(1.25rem, 3.6vw, 1.625rem); line-height: 1.1; margin: 0 0 8px; }
.pc-card p { font-size: var(--fs-sm); line-height: 1.55; color: var(--muted); margin: 0 0 18px; }
.pc-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

/* seções de conteúdo */
.sec-h { font-family: 'Oswald', sans-serif; font-size: var(--fs-lg); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin: 28px 0 14px; }
.how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.how-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.how-n {
  display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
  background: var(--grad-trophy, linear-gradient(135deg, #ffb020, #ff7a59));
  color: #0a0e14; font-family: 'Oswald', sans-serif; font-weight: 700; margin-bottom: 10px;
}
.how-card h3 { font-size: var(--fs-base); font-weight: 700; margin: 0 0 5px; }
.how-card p { font-size: var(--fs-sm); line-height: 1.5; color: var(--muted); margin: 0; }

.faq-item { border: 1px solid var(--border); border-radius: 14px; padding: 4px 16px; margin-bottom: 8px; background: var(--bg-surface); }
.faq-item summary { cursor: pointer; padding: 12px 0; font-size: var(--fs-base); font-weight: 700; list-style: none; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item p { margin: 0 0 14px; font-size: var(--fs-sm); line-height: 1.6; color: var(--muted); }

@media (max-width: 720px) {
  .preview-blur { max-height: 460px; }
  .how-grid { grid-template-columns: 1fr; }
}
</style>
