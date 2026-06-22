<script setup lang="ts">
import { BOLAO_FAQ, faqJsonLd } from '~/utils/bolaoFaq';

// Landing de SEO mirando "bolão da Copa do Mundo 2026" e variações. Página de
// conteúdo (texto de verdade) — a home é app-like; esta dá ao Google o conteúdo
// rico que falta pra associar o site ao termo. Pública (ver guard.global.ts).
definePageMeta({ layout: 'default' });

const auth = useAuthStore();
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/bolao-da-copa-do-mundo-2026`;
const authLink = useAuthLink();

const title = 'Bolão da Copa do Mundo 2026 grátis — crie e jogue com os amigos | Cravei';
const desc =
  'Faça seu bolão da Copa do Mundo 2026 grátis com os amigos: palpite nos 104 jogos, pontue pela precisão do placar e acompanhe o ranking ao vivo a cada gol. Sem instalar app.';

useSeoMeta({
  title,
  description: desc,
  ogTitle: title,
  ogDescription: desc,
  ogUrl: url,
  ogType: 'website',
  twitterTitle: title,
  twitterDescription: desc,
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    { key: 'ld-faq', type: 'application/ld+json', innerHTML: JSON.stringify(faqJsonLd()) },
    {
      key: 'ld-breadcrumb',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Bolão da Copa do Mundo 2026', item: url },
        ],
      }),
    },
  ],
});

const steps = [
  { n: 1, t: 'Crie seu bolão', d: 'Faça sua conta grátis e monte um bolão privado da Copa do Mundo 2026 em menos de um minuto.' },
  { n: 2, t: 'Chame a galera', d: 'Compartilhe o link de convite com os amigos. Cada um entra e palpita os placares dos jogos.' },
  { n: 3, t: 'Suba no ranking', d: 'Pontue pela precisão do placar e veja o ranking se mexer ao vivo a cada gol da Copa.' },
];
const reasons = [
  ['Ranking ao vivo', 'A classificação do seu bolão atualiza a cada gol, em tempo real.'],
  ['Placar automático', 'Os resultados dos 104 jogos entram sozinhos — você só palpita.'],
  ['Pontuação pela precisão', 'Cravar o placar exato vale mais do que só acertar quem ganha.'],
  ['Bolões privados', 'Crie bolões fechados só com a sua turma, com convite por link.'],
  ['Escalações e estatísticas', 'Acompanhe escalação, linha do tempo e números de cada partida.'],
  ['Grátis e sem app', 'Tudo de graça, direto no navegador. Instalar é opcional.'],
];
</script>

<template>
  <main class="lp container">
    <nav class="crumbs">
      <NuxtLink to="/">Início</NuxtLink>
      <span>›</span>
      <span>Bolão da Copa do Mundo 2026</span>
    </nav>

    <header class="hero">
      <span class="eyebrow">Copa do Mundo · 2026</span>
      <h1>Bolão da Copa do Mundo 2026</h1>
      <p class="lead">
        Crie seu <strong>bolão da Copa do Mundo 2026</strong> grátis e dispute com os amigos:
        palpite nos 104 jogos, pontue pela precisão do placar e veja o ranking se mexer
        <b>ao vivo</b> a cada gol. Sem instalar app, direto no navegador.
      </p>
      <div class="cta">
        <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold big">Criar bolão grátis</NuxtLink>
        <NuxtLink v-if="!auth.isAuthenticated" :to="authLink('/entrar')" class="btn big">Já tenho conta</NuxtLink>
      </div>
      <p class="trust"><span class="dot-ok" /> Grátis · sem app pra instalar · pronto em 1 minuto</p>
    </header>

    <section class="sec">
      <h2>O que é o bolão da Copa do Mundo 2026?</h2>
      <p>
        O bolão da Copa do Mundo 2026 é uma disputa entre amigos em que cada participante
        <strong>palpita os placares dos jogos</strong> da Copa e ganha pontos pela precisão dos acertos.
        No Cravei, você monta um bolão privado, convida a turma e acompanha quem está cravando mais —
        com o ranking atualizando ao vivo a cada gol das seleções.
      </p>
    </section>

    <section class="sec">
      <h2>Como funciona</h2>
      <div class="steps">
        <div v-for="s in steps" :key="s.n" class="step">
          <span class="step-n">{{ s.n }}</span>
          <h3>{{ s.t }}</h3>
          <p>{{ s.d }}</p>
        </div>
      </div>
    </section>

    <section class="sec">
      <h2>Por que fazer seu bolão da Copa no Cravei</h2>
      <ul class="reasons">
        <li v-for="[t, d] in reasons" :key="t">
          <strong>{{ t }}</strong><span>{{ d }}</span>
        </li>
      </ul>
    </section>

    <section class="sec">
      <h2>Como criar ou entrar num bolão com os amigos</h2>
      <p>
        Criar conta é grátis. Depois, é só montar um <strong>bolão privado</strong> e compartilhar o
        link de convite — ou entrar num bolão que um amigo criou. Você ainda pode acompanhar a
        <NuxtLink to="/futebol/agenda">agenda dos jogos da Copa do Mundo 2026</NuxtLink>, ler as
        <NuxtLink to="/noticias">notícias e resumos das partidas</NuxtLink> e ver
        <NuxtLink to="/como-funciona">como funciona a pontuação</NuxtLink> em detalhe.
      </p>
      <div class="cta">
        <NuxtLink :to="authLink('/cadastro')" class="btn btn-primary big">Começar meu bolão</NuxtLink>
      </div>
    </section>

    <section class="sec faq">
      <h2>Perguntas frequentes</h2>
      <details v-for="(f, i) in BOLAO_FAQ" :key="i">
        <summary>{{ f.q }}</summary>
        <p>{{ f.a }}</p>
      </details>
    </section>
  </main>
</template>

<style scoped>
.lp { max-width: 860px; margin: 0 auto; padding: 16px 16px 64px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin: 6px 0 18px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.hero { text-align: center; padding: 12px 0 26px; }
.eyebrow { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: var(--azure); }
.hero h1 { font-family: 'Oswald', sans-serif; font-size: clamp(30px, 6vw, 46px); font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; margin: 10px 0 14px; }
.lead { font-size: 17px; line-height: 1.6; color: var(--text); opacity: 0.92; max-width: 64ch; margin: 0 auto 20px; }
.cta { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.big { padding: 13px 22px; font-size: 15px; }
.trust { font-size: 13px; color: var(--muted); margin-top: 14px; display: inline-flex; align-items: center; gap: 7px; width: 100%; justify-content: center; }
.dot-ok { width: 8px; height: 8px; border-radius: 50%; background: var(--emerald); }
.sec { margin-top: 38px; }
.sec h2 { font-family: 'Oswald', sans-serif; font-size: clamp(22px, 4vw, 28px); font-weight: 700; margin: 0 0 14px; }
.sec p { font-size: 16px; line-height: 1.7; color: var(--text); }
.sec a { color: var(--azure); text-decoration: none; }
.sec a:hover { text-decoration: underline; }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 680px) { .steps { grid-template-columns: 1fr; } }
.step { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.step-n { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--grad-pitch); color: #fff; font-weight: 800; font-family: 'Oswald', sans-serif; }
.step h3 { font-size: 16px; margin: 10px 0 5px; }
.step p { font-size: 14px; line-height: 1.55; color: var(--muted); }
.reasons { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 680px) { .reasons { grid-template-columns: 1fr; } }
.reasons li { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.reasons strong { display: block; font-size: 15px; margin-bottom: 3px; }
.reasons span { font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.faq details { border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; }
.faq summary { font-weight: 700; font-size: 15px; cursor: pointer; }
.faq details p { color: var(--muted); font-size: 14.5px; line-height: 1.6; margin: 8px 0 0; }
</style>
