<script setup lang="ts">
// Modelo granular de mercado ("dacopa"): acertar o vencedor/empate é o portão;
// dentro disso, quanto mais preciso o placar, mais pontos. Fonte da verdade:
// ScoringService (api) + bolao-2026-docs/api/scoring.md. Rótulos/cores espelham
// utils/format.ts e MatchCard.vue.
const seoTitle = 'Como funciona o bolão — pontuação e regras — Cravei';
const seoDesc =
  'Entenda a pontuação do bolão da Copa do Mundo 2026: cravar o placar vale mais, mas acertar o vencedor ou o empate já pontua. Veja os níveis, o multiplicador do mata-mata e como o ranking é calculado.';
useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: `${useRuntimeConfig().public.siteUrl}/como-funciona`,
  twitterTitle: seoTitle,
  twitterDescription: seoDesc,
});
// FAQPage structured data — Q&A mirror the visible "As regras" section (Google
// requires the answers to be present on the page).
const FAQ: [string, string][] = [
  [
    'Como funciona a pontuação do bolão?',
    'Acertar o vencedor ou o empate já pontua. Quanto mais preciso o placar, mais vale: gols do vencedor, saldo de gols, gols do perdedor — até cravar o placar exato, que vale o máximo da partida.',
  ],
  [
    'Quando posso palpitar?',
    'Por padrão os palpites ficam abertos enquanto a partida está agendada e antes do horário do apito; depois fecham automaticamente. O organizador também pode abrir ou fechar os palpites de uma partida na mão, inclusive reabrir um jogo já ao vivo.',
  ],
  [
    'Como funciona a pontuação ao vivo?',
    'Enquanto a partida rola, o ranking dela mostra quanto cada um está ganhando até o momento, calculado pelo placar parcial. Os pontos mudam a cada gol e só viram definitivos quando o jogo é encerrado.',
  ],
  [
    'Quais rankings existem?',
    'Dois: o do torneio (a soma dos seus pontos em todas as partidas, com pódio) e o da partida (só aquele jogo). Em caso de empate, quem palpitou primeiro fica na frente.',
  ],
  [
    'Os palpites ficam visíveis para todos?',
    'Sim, os palpites são visíveis para todos. Dá pra ver o que cada amigo apostou em cada partida — e quem cravou. Partidas canceladas não geram pontos para ninguém.',
  ],
];
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }),
    },
  ],
});

const tiers = [
  { label: 'Cravou', cond: 'Placar exato', pts: '25', color: 'var(--emerald)' },
  { label: 'Gols do vencedor', cond: 'Vencedor certo + os gols dele exatos', pts: '18', color: 'var(--azure)' },
  { label: 'Acertou o saldo', cond: 'Vencedor certo + mesmo saldo de gols', pts: '15', color: 'var(--gold)' },
  { label: 'Gols do perdedor', cond: 'Vencedor certo + os gols dele exatos', pts: '12', color: 'var(--scarlet)' },
  { label: 'Acertou o vencedor', cond: 'Só quem venceu (ou o empate)', pts: '10', color: 'var(--magenta)' },
  { label: 'Não pontuou', cond: 'Errou quem venceu / o empate', pts: '0', color: 'var(--muted)' },
];

// Um exemplo de cada caso contra o mesmo resultado real (mandante 2 × 1).
const cases = [
  { label: 'Cravou', guess: '2-1', why: 'Placar exato. O máximo da partida.', pts: '25', color: 'var(--emerald)' },
  { label: 'Gols do vencedor', guess: '2-0', why: 'Acertou em cheio os 2 gols do vencedor; só errou o perdedor.', pts: '18', color: 'var(--azure)' },
  { label: 'Acertou o saldo', guess: '3-2', why: 'Vencedor certo e mesmo saldo (+1), mas sem cravar os gols.', pts: '15', color: 'var(--gold)' },
  { label: 'Gols do perdedor', guess: '3-1', why: 'Cravou o 1 gol do perdedor; errou os gols do vencedor e o saldo.', pts: '12', color: 'var(--scarlet)' },
  { label: 'Acertou o vencedor', guess: '4-2', why: 'Só acertou quem venceu — gols, saldo e perdedor todos diferentes.', pts: '10', color: 'var(--magenta)' },
  { label: 'Não pontuou', guess: '0-2', why: 'Previu o visitante ganhando: errou o vencedor e zerou a partida.', pts: '0', color: 'var(--muted)' },
];

// Peso por fase (mata-mata) — padrão SCORING_PHASE_STEP=1, CAP=3 na Copa 2026.
const phases = [
  { name: 'Fase de grupos', w: '1×', color: 'var(--muted)' },
  { name: '16-avos de final', w: '2×', color: 'var(--azure)' },
  { name: 'Oitavas em diante', w: '3×', color: 'var(--gold)' },
];
</script>

<template>
  <div class="page">
    <section class="hero">
      <div class="glow" aria-hidden="true" />
      <div class="hero-in">
        <span class="kicker">Guia do bolão</span>
        <h1 class="font-display">Como funciona</h1>
        <p class="sub">Você palpita o placar de cada partida antes dela começar. Acertar quem ganha já garante pontos — e quanto mais preciso for o placar, mais você leva. Veja as regras abaixo.</p>
      </div>
    </section>

    <h2 class="font-display sec">Como você pontua</h2>
    <p class="lead">Primeiro, o portão: é preciso <b>acertar quem venceu</b> (ou o empate). Quem erra isso <b>zera a partida</b>. Acertando o vencedor, você já garante a base — e sobe de faixa conforme cravou mais detalhes do placar, com o <b>saldo de gols</b> como critério, igual aos bolões tradicionais:</p>

    <div class="tiers">
      <div
        v-for="t in tiers"
        :key="t.label"
        class="tier"
        :style="{ borderColor: `color-mix(in srgb, ${t.color} 45%, var(--border))`, background: `color-mix(in srgb, ${t.color} 7%, var(--bg-surface))` }"
      >
        <span class="tier-dot" :style="{ background: t.color }" />
        <div class="tier-main">
          <span class="tier-name" :style="{ color: t.color }">{{ t.label }}</span>
          <span class="tier-cond">{{ t.cond }}</span>
        </div>
        <span class="tier-pts font-numeric" :style="{ color: t.color }">{{ t.pts === '0' ? '0' : '+' + t.pts }}</span>
      </div>
    </div>
    <p class="note">Cravar o placar inteiro é a glória: <b class="emerald">25 pontos</b>. E acertar quem venceu sempre vale mais do que qualquer detalhe sem o vencedor — quem erra o lado não pontua, por mais perto que tenha chegado.</p>

    <h2 class="font-display sec2">Um exemplo de cada caso</h2>
    <p class="lead">Todos com o mesmo resultado real — <b>mandante 2 × 1 visitante</b> — variando só o seu palpite:</p>

    <div class="cases">
      <div
        v-for="(c, i) in cases"
        :key="i"
        class="case"
        :style="{ borderColor: c.color, background: `color-mix(in srgb, ${c.color} 8%, var(--bg-surface))` }"
      >
        <div class="cg">
          <span class="cg-cap">palpite</span>
          <span class="font-numeric cg-sc">{{ c.guess.replace('-', ' : ') }}</span>
        </div>
        <div class="ci">
          <div class="cl" :style="{ color: c.color }">{{ c.label }}</div>
          <div class="cw">{{ c.why }}</div>
        </div>
        <div class="cp">
          <span class="font-numeric" :style="{ color: c.color }">{{ c.pts === '0' ? '0' : '+' + c.pts }}</span>
          <span class="cp-l">pts</span>
        </div>
      </div>
    </div>
    <p class="note">No <b>empate</b> não há vencedor nem perdedor: um empate certo com placar diferente vale sempre <b class="magenta">10</b> (ex.: você pôs 1 × 1 e deu 2 × 2). Cravar o empate (2 × 2) vale <b class="emerald">25</b>.</p>

    <h2 class="font-display sec2">Vale mais no mata-mata</h2>
    <p class="lead">Quanto mais decisiva a fase, mais valem os seus pontos. Os acertos do <b>mata-mata</b> são multiplicados — sobe a cada rodada rumo à final:</p>
    <div class="phases">
      <div v-for="p in phases" :key="p.name" class="phase" :style="{ '--c': p.color }">
        <span class="ph-w font-numeric">{{ p.w }}</span>
        <span class="ph-name">{{ p.name }}</span>
      </div>
    </div>
    <p class="note">O multiplicador mexe só nos <b>pontos</b> — a faixa do seu palpite (cravou, saldo…) é a mesma. Cravar uma final vale muito mais do que cravar um jogo de grupo.</p>

    <h2 class="font-display sec2">As regras</h2>
    <div class="cards">
      <div class="card rule">
        <div class="ric azure"><AppIcon name="clock" :size="20" /></div>
        <h3 class="font-display">Quando palpitar</h3>
        <p>Por padrão os palpites ficam abertos enquanto a partida está <b class="azure">agendada</b> e antes do horário do apito. Depois disso fecham automaticamente. O <b>organizador</b> também pode abrir ou fechar os palpites de uma partida na mão — inclusive reabrir um jogo já <b class="scarlet">ao vivo</b>, se decidir.</p>
      </div>
      <div class="card rule">
        <div class="ric scarlet"><AppIcon name="live" :size="20" /></div>
        <h3 class="font-display">Ao vivo é provisório</h3>
        <p>Enquanto a partida rola, o ranking dela mostra <b class="scarlet">quanto cada um está ganhando até o momento</b>, calculado pelo placar parcial (um 1 × 0 já conta como 1 a 0). Os pontos <b>mudam a cada gol</b> e só viram <b class="emerald">definitivos</b> quando o jogo é encerrado.</p>
      </div>
      <div class="card rule">
        <div class="ric gold"><AppIcon name="trophy" :size="20" /></div>
        <h3 class="font-display">Dois rankings</h3>
        <p><b>Do torneio:</b> a soma dos seus pontos em todas as partidas, com pódio. <b>Da partida:</b> só aquele jogo. <b>Empate?</b> quem <b class="gold">palpitou primeiro</b> fica na frente — no torneio vale o seu palpite mais antigo.</p>
      </div>
      <div class="card rule">
        <div class="ric magenta"><AppIcon name="eye" :size="20" /></div>
        <h3 class="font-display">Palpites à mostra</h3>
        <p>Os palpites são <b>visíveis para todos</b>. Dá pra ver o que cada amigo apostou em cada partida — e quem cravou. Partidas <b>canceladas</b> não geram pontos para ninguém.</p>
      </div>
    </div>

    <div class="cta-wrap">
      <NuxtLink to="/futebol/torneios" class="btn btn-primary">Ir palpitar</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 22px 0 40px; max-width: 1040px; margin: 0 auto; }
/* Keep prose readable even on the wide layout. */
.sub, .lead, .note { max-width: 680px; }
.hero { position: relative; overflow: hidden; border-radius: 22px; border: 1px solid var(--border); background: linear-gradient(135deg, rgba(244, 184, 30, 0.2), rgba(224, 33, 138, 0.16)), var(--bg-surface); box-shadow: var(--shadow); padding: clamp(20px, 4vw, 30px); margin-bottom: 24px; }
.glow { position: absolute; right: -30px; top: -30px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 184, 30, 0.3), transparent 70%); }
.hero-in { position: relative; }
.kicker { display: inline-block; background: rgba(244, 184, 30, 0.16); border: 1px solid rgba(244, 184, 30, 0.4); color: var(--gold); border-radius: 999px; padding: 5px 11px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; }
.hero-in h1 { font-weight: 700; font-size: clamp(28px, 5vw, 40px); text-transform: uppercase; line-height: 1; }
.sub { color: var(--muted); margin-top: 10px; font-size: 14.5px; max-width: 540px; }
.sec { font-weight: 600; font-size: 19px; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
.sec2 { font-weight: 600; font-size: 19px; text-transform: uppercase; letter-spacing: 0.02em; margin: 30px 0 6px; }
.lead { color: var(--muted); font-size: 13.5px; line-height: 1.55; margin-bottom: 14px; }
.lead b, .rule p b { color: var(--text); }
.note { font-size: 13px; color: var(--muted); margin: 12px 0 0; }
.note b { color: var(--text); }

/* tiers ladder — two columns on wide screens (reads 25→0 left-to-right, row by row) */
.tiers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
.tier { display: flex; align-items: center; gap: 12px; padding: 12px 15px; border: 1px solid; border-radius: 13px; }
.tier-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.tier-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tier-name { font-size: 14px; font-weight: 800; }
.tier-cond { font-size: 12px; color: var(--muted); font-weight: 500; }
.tier-pts { font-size: 26px; line-height: 0.9; flex: none; }

/* example cases — two columns on wide screens */
.cases { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
.case { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; border: 1px solid; }
.cg { text-align: center; flex: 0 0 auto; }
.cg-cap { display: block; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.cg-sc { font-size: 24px; line-height: 1; letter-spacing: 0.02em; }
.ci { flex: 1; min-width: 0; }
.cl { font-size: 14px; font-weight: 800; }
.cw { font-size: 12px; color: var(--muted); font-weight: 500; line-height: 1.4; margin-top: 2px; }
.cp { text-align: right; flex: 0 0 auto; }
.cp .font-numeric { font-size: 28px; line-height: 0.8; }
.cp-l { display: block; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }

/* phase weights */
.phases { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.phase { border: 1px solid color-mix(in srgb, var(--c) 40%, var(--border)); background: color-mix(in srgb, var(--c) 7%, var(--bg-surface)); border-radius: 14px; padding: 16px 12px; text-align: center; }
.ph-w { display: block; font-size: 34px; line-height: 0.8; color: var(--c); }
.ph-name { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin-top: 8px; }

/* rules */
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; }
.rule { padding: 18px; }
.ric { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; margin-bottom: 12px; font-size: 18px; }
.ric.azure { color: var(--azure); background: color-mix(in srgb, var(--azure) 14%, transparent); }
.ric.scarlet { color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); }
.ric.gold { color: var(--gold); background: color-mix(in srgb, var(--gold) 16%, transparent); }
.ric.magenta { color: var(--magenta); background: color-mix(in srgb, var(--magenta) 14%, transparent); }
.rule h3 { font-weight: 600; font-size: 16px; text-transform: uppercase; margin-bottom: 7px; }
.rule p { font-size: 13px; color: var(--muted); line-height: 1.5; }
.azure { color: var(--azure); }
.scarlet { color: var(--scarlet); }
.emerald { color: var(--emerald); }
.gold { color: var(--gold); }
.magenta { color: var(--magenta); }
.cta-wrap { display: flex; justify-content: center; margin-top: 26px; }

@media (max-width: 680px) {
  .tiers, .cases { grid-template-columns: 1fr; }
}
@media (max-width: 460px) {
  .phases { grid-template-columns: 1fr; }
}
</style>
