<script setup lang="ts">
const tiers = [
  { label: 'Cravou o placar', desc: 'Acertou o placar exato (mandante e visitante).', pts: 10, color: 'var(--emerald)' },
  { label: 'Acertou os gols de um time', desc: 'Acertou o número de gols de um dos times.', pts: 5, color: 'var(--azure)' },
  { label: 'Acertou o saldo de gols', desc: 'Mesmo vencedor e mesma diferença, sem cravar.', pts: 4, color: 'var(--gold)' },
  { label: 'Acertou o vencedor', desc: 'Acertou só quem ganhou (ou o empate).', pts: 3, color: 'var(--magenta)' },
  { label: 'Não pontuou', desc: 'O palpite não se encaixou em nenhum critério.', pts: 0, color: 'var(--muted)' },
];
</script>

<template>
  <div class="page">
    <section class="hero">
      <div class="glow" aria-hidden="true" />
      <div class="hero-in">
        <span class="kicker">Guia do bolão</span>
        <h1 class="font-display">Como funciona</h1>
        <p class="sub">Você palpita o placar de cada partida. Quanto mais perto do resultado real, mais pontos. Veja as regras abaixo.</p>
      </div>
    </section>

    <h2 class="font-display sec">Pontuação em camadas</h2>
    <p class="lead">Para cada partida vale <b>apenas o critério mais alto atingido</b> — os pontos não se somam. Tudo é calculado <b>só sobre o palpite de placar</b>.</p>

    <div class="tiers">
      <div v-for="t in tiers" :key="t.label" class="tier" :style="{ borderColor: t.color, background: `color-mix(in srgb, ${t.color} 9%, var(--bg-surface))` }">
        <span class="dot" :style="{ background: t.color }" />
        <div class="ti">
          <div class="tl">{{ t.label }}</div>
          <div class="td">{{ t.desc }}</div>
        </div>
        <div class="tp"><span class="font-numeric" :style="{ color: t.color }">{{ t.pts }}</span><div class="pl">pts</div></div>
      </div>
    </div>

    <div class="card example">
      <div class="ex-h">Exemplo</div>
      <div class="ex-grid">
        <div class="ex-box"><div class="ex-cap">Seu palpite</div><div class="font-numeric ex-sc">2 : 1</div></div>
        <div class="ex-box"><div class="ex-cap">Resultado</div><div class="font-numeric ex-sc">2 : 0</div></div>
      </div>
      <div class="ex-res">
        <span class="ck">✓</span>
        <div class="ex-txt">Acertou os gols de um time <span class="muted">— você cravou o 2 do mandante, mas não o placar exato.</span></div>
        <span class="font-numeric ex-pts">+5</span>
      </div>
    </div>

    <div class="cards">
      <div class="card rule">
        <div class="ric azure">◷</div>
        <h3 class="font-display">Quando palpitar</h3>
        <p>Os palpites só são aceitos enquanto a partida está <b class="azure">agendada</b>. Ao ficar <b class="scarlet">ao vivo</b>, encerrar ou ser cancelada, o palpite é bloqueado. Partidas <b>canceladas não geram pontos</b>.</p>
      </div>
      <div class="card rule">
        <div class="ric gold">🏆</div>
        <h3 class="font-display">Dois rankings</h3>
        <p><b>Ranking do torneio:</b> soma dos seus pontos no torneio (top 100, com pódio). <b>Ranking da partida:</b> só aquele jogo — <b class="scarlet">provisório</b> ao vivo, <b class="emerald">final</b> ao encerrar.</p>
      </div>
      <div class="card rule">
        <div class="ric magenta">👁</div>
        <h3 class="font-display">Palpites à mostra</h3>
        <p>Os palpites são <b>visíveis para todos</b>. Dá pra ver o que cada amigo apostou em cada partida — e quem cravou.</p>
      </div>
    </div>

    <div class="cta-wrap">
      <NuxtLink to="/" class="btn btn-primary">Ir palpitar</NuxtLink>
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
.lead { color: var(--muted); font-size: 13.5px; line-height: 1.55; margin-bottom: 16px; }
.lead b, .rule p b { color: var(--text); }
.tiers { display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px; }
.tier { display: flex; align-items: center; gap: 13px; padding: 14px; border-radius: 14px; border: 1px solid; }
.dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 auto; }
.ti { flex: 1; min-width: 0; }
.tl { font-size: 14.5px; font-weight: 800; }
.td { font-size: 12px; color: var(--muted); font-weight: 500; }
.tp { text-align: right; }
.tp .font-numeric { font-size: 30px; line-height: 0.8; }
.pl { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.example { padding: 18px; margin-bottom: 26px; }
.ex-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--gold); margin-bottom: 14px; }
.ex-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ex-box { text-align: center; background: var(--bg-base); border: 1px solid var(--border); border-radius: 13px; padding: 14px; }
.ex-cap { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
.ex-sc { font-size: 40px; line-height: 0.85; }
.ex-res { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--emerald); background: color-mix(in srgb, var(--emerald) 14%, transparent); }
.ck { color: var(--emerald); font-weight: 900; }
.ex-txt { flex: 1; font-size: 13px; font-weight: 700; color: var(--emerald); }
.ex-pts { font-size: 26px; color: var(--emerald); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; }
.rule { padding: 18px; }
.ric { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; margin-bottom: 12px; font-size: 18px; }
.ric.azure { color: var(--azure); background: color-mix(in srgb, var(--azure) 14%, transparent); }
.ric.gold { color: var(--gold); background: color-mix(in srgb, var(--gold) 16%, transparent); }
.ric.magenta { color: var(--magenta); background: color-mix(in srgb, var(--magenta) 14%, transparent); }
.rule h3 { font-weight: 600; font-size: 16px; text-transform: uppercase; margin-bottom: 7px; }
.rule p { font-size: 13px; color: var(--muted); line-height: 1.5; }
.azure { color: var(--azure); }
.scarlet { color: var(--scarlet); }
.emerald { color: var(--emerald); }
.cta-wrap { display: flex; justify-content: center; margin-top: 26px; }
</style>
