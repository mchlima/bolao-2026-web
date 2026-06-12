<script setup lang="ts">
// Each case is a worked example against the same real result (2 × 1), so the
// gradient from "cravou" to "errou" is easy to compare.
const cases = [
  { label: 'Cravou o placar', guess: '2-1', why: 'Placar exato: base 4 + cravou os dois times (+3 e +3).', pts: '10', color: 'var(--emerald)' },
  { label: 'Acertou um placar', guess: '2-0', why: 'Base 4 + cravou o 2 do mandante (+3) + errou o fora por 1 (+1).', pts: '8', color: 'var(--azure)' },
  { label: 'Acertou um placar', guess: '3-1', why: 'Base 4 + cravou o 1 do visitante (+3) + errou o mando por 1 (+1).', pts: '8', color: 'var(--azure)' },
  { label: 'Quase', guess: '3-2', why: 'Vencedor certo; cada time ficou a 1 gol (+1 e +1).', pts: '6', color: 'var(--gold)' },
  { label: 'Acertou o vencedor', guess: '4-0', why: 'Acertou quem venceu; o visitante ficou a 1 gol (+1), o mando longe.', pts: '5', color: 'var(--magenta)' },
  { label: 'Acertou o vencedor', guess: '5-3', why: 'Só o vencedor: os dois times ficaram a 2+ gols. Piso da base.', pts: '4', color: 'var(--magenta)' },
  { label: 'Não pontuou', guess: '1-2', why: 'Previu o visitante vencendo — errou quem ganhou.', pts: '0', color: 'var(--muted)' },
];
</script>

<template>
  <div class="page">
    <section class="hero">
      <div class="glow" aria-hidden="true" />
      <div class="hero-in">
        <span class="kicker">Guia do bolão</span>
        <h1 class="font-display">Como funciona</h1>
        <p class="sub">Você palpita o placar de cada partida antes dela começar. Quanto mais perto do resultado real, mais pontos. Veja as regras abaixo.</p>
      </div>
    </section>

    <h2 class="font-display sec">Pontuação por proximidade</h2>
    <p class="lead">Primeiro, é preciso <b>acertar quem venceu</b> (ou o empate) — isso vale uma <b>base de 4 pontos</b>. A partir daí, <b>cada time</b> soma pela proximidade do seu palpite:</p>

    <div class="formula">
      <div class="fr"><span class="fk">Acertou o vencedor / empate</span><span class="fv">+4 base</span></div>
      <div class="fr"><span class="fk">Cravou os gols de um time</span><span class="fv gold">+3 por time</span></div>
      <div class="fr"><span class="fk">Errou um time por 1 gol</span><span class="fv gold">+1 por time</span></div>
      <div class="fr"><span class="fk">Errou quem venceu</span><span class="fv muted">0 — zerou a partida</span></div>
    </div>
    <p class="note">Cravar o placar inteiro dá o máximo: <b class="emerald">10 pontos</b> (4 + 3 + 3).</p>

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

    <h2 class="font-display sec2">As regras</h2>
    <div class="cards">
      <div class="card rule">
        <div class="ric azure">◷</div>
        <h3 class="font-display">Quando palpitar</h3>
        <p>Por padrão os palpites ficam abertos enquanto a partida está <b class="azure">agendada</b> e antes do horário do apito. Depois disso fecham automaticamente. O <b>organizador</b> também pode abrir ou fechar os palpites de uma partida na mão — inclusive reabrir um jogo já <b class="scarlet">ao vivo</b>, se decidir.</p>
      </div>
      <div class="card rule">
        <div class="ric scarlet">●</div>
        <h3 class="font-display">Ao vivo é provisório</h3>
        <p>Enquanto a partida rola, o ranking dela mostra <b class="scarlet">quanto cada um está ganhando até o momento</b>, calculado pelo placar parcial (um 1 × 0 já conta como 1 a 0). Os pontos <b>mudam a cada gol</b> e só viram <b class="emerald">definitivos</b> quando o jogo é encerrado.</p>
      </div>
      <div class="card rule">
        <div class="ric gold">🏆</div>
        <h3 class="font-display">Dois rankings</h3>
        <p><b>Do torneio:</b> a soma dos seus pontos em todas as partidas (top 100, com pódio). <b>Da partida:</b> só aquele jogo. <b>Empate?</b> quem <b class="gold">palpitou primeiro</b> fica na frente — no torneio vale o seu palpite mais antigo.</p>
      </div>
      <div class="card rule">
        <div class="ric magenta">👁</div>
        <h3 class="font-display">Palpites à mostra</h3>
        <p>Os palpites são <b>visíveis para todos</b>. Dá pra ver o que cada amigo apostou em cada partida — e quem cravou. Partidas <b>canceladas</b> não geram pontos para ninguém.</p>
      </div>
    </div>

    <div class="cta-wrap">
      <NuxtLink to="/tournaments" class="btn btn-primary">Ir palpitar</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 22px 0 40px; max-width: 760px; margin: 0 auto; }
.hero { position: relative; overflow: hidden; border-radius: 22px; border: 1px solid var(--border); background: linear-gradient(135deg, rgba(244, 184, 30, 0.2), rgba(224, 33, 138, 0.16)), var(--bg-surface); box-shadow: var(--shadow); padding: clamp(20px, 4vw, 30px); margin-bottom: 24px; }
.glow { position: absolute; right: -30px; top: -30px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 184, 30, 0.3), transparent 70%); }
.hero-in { position: relative; }
.kicker { display: inline-block; background: rgba(244, 184, 30, 0.16); border: 1px solid rgba(244, 184, 30, 0.4); color: var(--gold); border-radius: 999px; padding: 5px 11px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; }
.hero-in h1 { font-weight: 700; font-size: clamp(28px, 5vw, 40px); text-transform: uppercase; line-height: 1; }
.sub { color: var(--muted); margin-top: 10px; font-size: 14.5px; max-width: 520px; }
.sec { font-weight: 600; font-size: 19px; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
.sec2 { font-weight: 600; font-size: 19px; text-transform: uppercase; letter-spacing: 0.02em; margin: 30px 0 6px; }
.lead { color: var(--muted); font-size: 13.5px; line-height: 1.55; margin-bottom: 14px; }
.lead b, .rule p b { color: var(--text); }
.note { font-size: 13px; color: var(--muted); margin: 12px 0 0; }

/* formula */
.formula { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
.fr { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; border-top: 1px solid var(--border); }
.fr:first-child { border-top: none; }
.fk { font-size: 13.5px; font-weight: 600; }
.fv { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; white-space: nowrap; }
.fv.gold { color: var(--gold); }
.fv.muted { color: var(--muted); }

/* example cases */
.cases { display: flex; flex-direction: column; gap: 9px; }
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
.cta-wrap { display: flex; justify-content: center; margin-top: 26px; }
</style>
