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
  meta: [
    {
      name: 'keywords',
      content:
        'bolão da copa do mundo 2026, bolão da copa, bolão copa 2026, palpites copa do mundo, bolão online grátis, bolão entre amigos, ranking ao vivo, mundial 2026, bolão de seleções',
    },
  ],
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

// Faixa de números da Copa do Mundo 2026 — chamativo + fatos (bom sinal GEO).
const stats = [
  { n: '104', l: 'jogos pra palpitar' },
  { n: '48', l: 'seleções na disputa' },
  { n: 'R$ 0', l: 'pra jogar, sempre' },
];

const steps = [
  { n: 1, t: 'Crie seu bolão', d: 'Faça sua conta grátis e monte um bolão privado da Copa do Mundo 2026 em menos de um minuto.', c: 'var(--emerald)' },
  { n: 2, t: 'Chame a galera', d: 'Compartilhe o link de convite com os amigos. Cada um entra e palpita os placares dos jogos.', c: 'var(--gold)' },
  { n: 3, t: 'Suba no ranking', d: 'Pontue pela precisão do placar e veja o ranking se mexer ao vivo a cada gol da Copa.', c: 'var(--azure)' },
];

// Motivos com ícone + cor (contraste e leitura rápida).
const reasons = [
  { i: 'live', c: 'var(--scarlet)', t: 'Ranking ao vivo', d: 'A classificação do seu bolão atualiza a cada gol, em tempo real.' },
  { i: 'refresh', c: 'var(--azure)', t: 'Placar automático', d: 'Os resultados dos 104 jogos entram sozinhos — você só palpita.' },
  { i: 'star', c: 'var(--gold)', t: 'Pontuação pela precisão', d: 'Cravar o placar exato vale mais do que só acertar quem ganha.' },
  { i: 'users', c: 'var(--emerald)', t: 'Bolões privados', d: 'Crie bolões fechados só com a sua turma, com convite por link.' },
  { i: 'list', c: 'var(--magenta)', t: 'Escalações e estatísticas', d: 'Acompanhe escalação, linha do tempo e números de cada partida.' },
  { i: 'check', c: 'var(--emerald)', t: 'Grátis e sem app', d: 'Tudo de graça, direto no navegador. Instalar é opcional.' },
];

// Ranking-mock do hero (igual à home — reforça a marca).
const ranking = [
  { pos: 1, name: 'Você', pts: 84, you: true },
  { pos: 2, name: 'Rafa', pts: 81 },
  { pos: 3, name: 'Bia', pts: 79 },
];
</script>

<template>
  <main class="lp container">
    <nav class="crumbs">
      <NuxtLink to="/">Início</NuxtLink>
      <span>›</span>
      <span>Bolão da Copa do Mundo 2026</span>
    </nav>

    <!-- HERO -->
    <header class="hero">
      <div class="glow glow-a" aria-hidden="true" />
      <div class="glow glow-b" aria-hidden="true" />
      <div class="hero-grid">
        <div class="hero-text">
          <span class="eyebrow"><span class="eb-dot" />Copa do Mundo · 2026</span>
          <h1>Bolão da <span class="hl">Copa do Mundo 2026</span></h1>
          <p class="lead">
            Crie seu <strong>bolão da Copa do Mundo 2026</strong> grátis e dispute com os amigos:
            palpite nos 104 jogos, pontue pela precisão do placar e veja o ranking se mexer
            <b>ao vivo</b> a cada gol. Sem instalar app, direto no navegador.
          </p>
          <div class="cta">
            <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold big">
              Criar bolão grátis <AppIcon name="arrowRight" :size="18" :stroke="2.5" />
            </NuxtLink>
            <NuxtLink v-if="!auth.isAuthenticated" :to="authLink('/entrar')" class="btn big ghost">Já tenho conta</NuxtLink>
          </div>
          <p class="trust"><span class="dot-ok" /> Grátis · sem app pra instalar · pronto em 1 minuto</p>
        </div>

        <div class="hero-art" aria-hidden="true">
          <div class="card mock live">
            <div class="mock-top">
              <span class="mlbl">Grupo C · 2º tempo</span>
              <span class="mstatus"><span class="d" />Ao vivo</span>
            </div>
            <div class="mock-row">
              <div class="mteam"><img class="crest" src="https://cdn.cravei.app/teams/55ae4284-8ded-4d23-a8ce-5025ff8c2823.webp" alt="" loading="lazy" /><b>BRA</b></div>
              <div class="font-numeric mscore">2<span>:</span>1</div>
              <div class="mteam"><b>ARG</b><img class="crest" src="https://cdn.cravei.app/teams/fd5bd1db-daf1-4cd9-b254-c277c1f5d28b.webp" alt="" loading="lazy" /></div>
            </div>
            <div class="mock-foot">
              <span class="mchip">Seu palpite 2:1</span>
              <span class="mpts font-numeric">+25</span>
            </div>
          </div>

          <div class="card mock rank">
            <span class="rk-cap">Ranking do bolão</span>
            <div v-for="r in ranking" :key="r.pos" class="rk-row" :class="{ me: r.you }">
              <span class="rk-pos" :class="`p${r.pos}`">{{ r.pos }}</span>
              <span class="rk-name">{{ r.name }}</span>
              <span class="rk-pts font-numeric">{{ r.pts }}</span>
            </div>
          </div>

          <span class="float-badge font-display">CRAVOU! <b>+25</b></span>
        </div>
      </div>

      <!-- faixa de números (chamativo + GEO) -->
      <div class="stats">
        <div v-for="s in stats" :key="s.l" class="stat">
          <span class="stat-n font-numeric">{{ s.n }}</span>
          <span class="stat-l">{{ s.l }}</span>
        </div>
      </div>
    </header>

    <section class="sec intro">
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
        <div v-for="s in steps" :key="s.n" class="step" :style="{ '--c': s.c }">
          <span class="step-n">{{ s.n }}</span>
          <h3>{{ s.t }}</h3>
          <p>{{ s.d }}</p>
        </div>
      </div>
    </section>

    <section class="sec">
      <h2>Por que fazer seu bolão da Copa no Cravei</h2>
      <ul class="reasons">
        <li v-for="r in reasons" :key="r.t" :style="{ '--c': r.c }">
          <span class="r-ic"><AppIcon :name="r.i" :size="20" :stroke="2.1" /></span>
          <div class="r-txt">
            <strong>{{ r.t }}</strong><span>{{ r.d }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="sec band">
      <div class="glow glow-c" aria-hidden="true" />
      <div class="band-in">
        <h2>Como criar ou entrar num bolão com os amigos</h2>
        <p>
          Criar conta é grátis. Depois, é só montar um <strong>bolão privado</strong> e compartilhar o
          link de convite — ou entrar num bolão que um amigo criou. Você ainda pode acompanhar a
          <NuxtLink to="/futebol/agenda">agenda dos jogos da Copa do Mundo 2026</NuxtLink>, ler as
          <NuxtLink to="/noticias">notícias e resumos das partidas</NuxtLink> e ver
          <NuxtLink to="/como-funciona">como funciona a pontuação</NuxtLink> em detalhe.
        </p>
        <div class="cta">
          <NuxtLink :to="authLink('/cadastro')" class="btn btn-primary big">
            Começar meu bolão <AppIcon name="arrowRight" :size="18" :stroke="2.5" />
          </NuxtLink>
        </div>
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
.lp { max-width: 1180px; margin: 0 auto; padding: 16px 16px 64px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: var(--fs-xs); color: var(--muted); margin: 6px 0 16px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }

/* ===== HERO ===== */
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.18), rgba(30, 127, 240, 0.15)), var(--bg-surface);
  padding: clamp(22px, 4.5vw, 44px);
  margin-bottom: 12px;
}
.glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(8px); }
.glow-a {
  width: 340px; height: 340px; right: -90px; top: -110px;
  background: radial-gradient(circle, rgba(244, 184, 30, 0.28), transparent 70%);
  animation: spotShift 9s ease-in-out infinite;
}
.glow-b {
  width: 300px; height: 300px; left: -100px; bottom: -120px;
  background: radial-gradient(circle, rgba(15, 179, 107, 0.24), transparent 70%);
  animation: spotShift 11s ease-in-out infinite reverse;
}
.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: 36px;
}
.eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: var(--fs-xs); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--azure); margin-bottom: 14px;
}
.eb-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 10px 1px rgba(244, 184, 30, 0.7); }
.hero-text h1 {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(2rem, 6vw, 3.25rem); line-height: 1.02; letter-spacing: -0.01em;
  text-transform: uppercase; margin: 0 0 14px;
}
.hl { color: var(--gold); }
.lead { font-size: var(--fs-base); line-height: 1.6; color: var(--text); opacity: 0.92; max-width: 52ch; margin: 0 0 22px; }
.lead b, .lead strong { color: var(--text); font-weight: 800; }
.cta { display: flex; gap: 11px; flex-wrap: wrap; }
.big { padding: 14px 22px; font-size: var(--fs-base); }
.btn-gold.big { box-shadow: 0 14px 30px -12px rgba(244, 184, 30, 0.8); }
.ghost { background: transparent; }
.trust { font-size: var(--fs-sm); color: var(--muted); margin-top: 16px; display: inline-flex; align-items: center; gap: 7px; font-weight: 600; }
.dot-ok { width: 8px; height: 8px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 10px 1px rgba(15, 179, 107, 0.6); }

/* hero art (mock match + ranking + badge) */
.hero-art { position: relative; display: flex; justify-content: center; min-height: 270px; }
.mock { border-radius: 18px; padding: 16px; box-shadow: var(--shadow); }
.mock.live {
  width: min(100%, 320px); transform: rotate(-2deg);
  border-color: color-mix(in srgb, var(--scarlet) 30%, var(--border));
}
.mock-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.mlbl { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
.mstatus {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--scarlet); border: 1px solid var(--scarlet); border-radius: 999px; padding: 4px 9px;
}
.mstatus .d { width: 6px; height: 6px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }
.mock-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.mteam { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: var(--fs-base); }
.mteam:last-child { justify-content: flex-end; }
.crest { width: 28px; height: 28px; object-fit: contain; flex: none; }
.mscore { font-size: 2.625rem; line-height: 0.8; }
.mscore span { color: var(--muted); margin: 0 3px; }
.mock-foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.mchip { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
.mpts { font-size: var(--fs-2xl); line-height: 1; color: var(--emerald); }
.mock.rank {
  position: absolute; right: -6px; bottom: -8px; width: 200px; padding: 12px 13px;
  transform: rotate(3deg); background: var(--bg-elevated);
}
.rk-cap { display: block; font-size: var(--fs-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 8px; }
.rk-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
.rk-row.me { font-weight: 800; }
.rk-pos { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; font-size: var(--fs-xs); font-weight: 800; background: var(--bg-base); color: var(--muted); }
.rk-pos.p1 { background: var(--gold); color: #0a0e14; }
.rk-pos.p2 { background: #c7ccd4; color: #0a0e14; }
.rk-pos.p3 { background: #d8924a; color: #0a0e14; }
.rk-name { flex: 1; min-width: 0; font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-row.me .rk-name { color: var(--emerald); }
.rk-pts { font-size: var(--fs-lg); line-height: 1; }
.float-badge {
  position: absolute; left: -8px; top: 4px;
  font-size: var(--fs-sm); font-weight: 700; letter-spacing: 0.03em; color: #0a0e14;
  background: var(--gold); border-radius: 10px; padding: 7px 12px;
  box-shadow: 0 10px 24px -10px rgba(244, 184, 30, 0.8);
  transform: rotate(-7deg); animation: ignite 2.6s ease-in-out infinite;
}
.float-badge b { font-family: 'Bebas Neue', sans-serif; font-size: var(--fs-lg); }

/* faixa de números */
.stats {
  position: relative;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin-top: clamp(22px, 4vw, 34px);
  padding-top: clamp(20px, 3vw, 26px);
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.stat { text-align: center; }
.stat-n { display: block; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 0.9; color: var(--text); }
.stat-l { font-size: var(--fs-2xs); font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }

/* ===== sections ===== */
.sec { margin-top: 40px; }
.sec h2 { font-family: 'Oswald', sans-serif; font-size: clamp(1.375rem, 4vw, 1.8125rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 16px; }
.sec p { font-size: var(--fs-base); line-height: 1.7; color: var(--text); max-width: 72ch; }
.sec a { color: var(--azure); text-decoration: none; font-weight: 600; }
.sec a:hover { text-decoration: underline; }
/* botões dentro das seções não herdam a cor/sublinhado de link (senão o texto
   fica azul sobre o gradiente do .btn-primary = sem contraste). */
.sec a.btn { color: #fff; font-weight: 600; }
.sec a.btn:hover { text-decoration: none; }

/* intro destacada */
.intro {
  border-radius: 18px; border: 1px solid var(--border);
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 9%, transparent), transparent 60%), var(--bg-surface);
  padding: clamp(20px, 3.5vw, 30px);
}
.intro p { color: var(--muted); }
.intro strong { color: var(--text); }

/* passos */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 680px) { .steps { grid-template-columns: 1fr; } }
.step {
  position: relative; overflow: hidden;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-top: 3px solid var(--c); border-radius: 14px; padding: 20px;
  box-shadow: var(--shadow);
}
.step-n {
  display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 11px;
  background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c);
  font-weight: 800; font-family: 'Oswald', sans-serif; font-size: var(--fs-lg);
}
.step h3 { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: var(--fs-lg); margin: 12px 0 5px; }
.step p { font-size: var(--fs-sm); line-height: 1.55; color: var(--muted); }

/* motivos */
.reasons { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 900px) { .reasons { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .reasons { grid-template-columns: 1fr; } }
.reasons li {
  display: flex; gap: 13px; align-items: flex-start;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px;
  transition: border-color 0.14s, transform 0.14s;
}
.reasons li:hover { border-color: color-mix(in srgb, var(--c) 45%, var(--border)); transform: translateY(-1px); }
.r-ic {
  flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px;
  background: color-mix(in srgb, var(--c) 14%, transparent); color: var(--c);
}
.r-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.r-txt strong { font-size: var(--fs-base); }
.r-txt span { font-size: var(--fs-sm); line-height: 1.5; color: var(--muted); }

/* banda CTA "como criar" */
.band {
  position: relative; overflow: hidden; text-align: center;
  border-radius: 22px; border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(244, 184, 30, 0.14), rgba(224, 33, 138, 0.1)), var(--bg-surface);
  padding: clamp(28px, 5vw, 44px) 20px;
}
.glow-c {
  width: 340px; height: 340px; left: 50%; top: -130px; transform: translateX(-50%);
  background: radial-gradient(circle, rgba(244, 184, 30, 0.2), transparent 70%);
}
.band-in { position: relative; max-width: 620px; margin: 0 auto; }
.band h2 { margin-bottom: 12px; }
.band p { color: var(--muted); font-size: var(--fs-base); }
.band .cta { justify-content: center; margin-top: 20px; }

/* faq */
.faq details { border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; background: var(--bg-surface); }
.faq summary { font-weight: 700; font-size: var(--fs-base); cursor: pointer; }
.faq details p { color: var(--muted); font-size: var(--fs-sm); line-height: 1.65; margin: 8px 0 0; }

/* ===== responsive ===== */
@media (max-width: 760px) {
  .hero-grid { grid-template-columns: 1fr; gap: 28px; }
  .hero-art { order: -1; min-height: 230px; }
  .mock.live { transform: none; }
}
</style>
