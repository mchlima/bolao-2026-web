<script setup lang="ts">
definePageMeta({ layout: 'landing' });
useHead({ title: 'Amigos do Bolão · Copa 2026' });

const steps = [
  {
    n: '01',
    title: 'Faça seu palpite',
    text: 'Cravou o placar de cada partida antes do apito. Dá pra ajustar até a bola rolar.',
  },
  {
    n: '02',
    title: 'Pontue por acerto',
    text: 'Acertou o vencedor já vale. Chegou perto do placar vale mais. Cravar vale o máximo.',
  },
  {
    n: '03',
    title: 'Suba no ranking',
    text: 'Acompanhe sua posição ao vivo, partida a partida, e dispute o topo com a galera.',
  },
];

const features = [
  {
    title: 'Todas as partidas',
    text: 'Da fase de grupos à final — palpite em cada jogo do torneio.',
    color: 'var(--emerald)',
    icon: '<path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5"/>',
  },
  {
    title: 'Pontuação por proximidade',
    text: 'Quanto mais perto do placar real, mais pontos. Cravar é a glória.',
    color: 'var(--gold)',
    icon: '<path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/>',
  },
  {
    title: 'Ranking ao vivo',
    text: 'Sua pontuação muda em tempo real conforme o placar acontece.',
    color: 'var(--azure)',
    icon: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 4-5"/>',
  },
  {
    title: 'Placares automáticos',
    text: 'Os resultados entram sozinhos — sem ninguém precisar atualizar na mão.',
    color: 'var(--magenta)',
    icon: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/>',
  },
];
</script>

<template>
  <div class="land-page">
    <!-- HERO -->
    <section class="hero">
      <div class="glow glow-a" aria-hidden="true" />
      <div class="glow glow-b" aria-hidden="true" />
      <div class="hero-grid">
        <div class="hero-text">
          <span class="eyebrow">Copa do Mundo · 2026</span>
          <h1 class="font-display title">
            O bolão da<br />Copa com<br /><span class="hl">os amigos</span>
          </h1>
          <p class="lead">
            Palpite nos 104 jogos, pontue por acerto e dispute o topo do ranking
            em tempo real. Grátis, rápido e entre quem você conhece.
          </p>
          <div class="cta">
            <NuxtLink to="/register" class="btn btn-gold big">Criar conta grátis</NuxtLink>
            <NuxtLink to="/login" class="btn big">Já tenho conta</NuxtLink>
          </div>
        </div>

        <div class="hero-card" aria-hidden="true">
          <div class="card mock">
            <div class="mock-top">
              <span class="mlbl">Grupo A · hoje</span>
              <span class="mstatus"><span class="d" />Ao vivo</span>
            </div>
            <div class="mock-row">
              <div class="mteam"><span class="flag">🇧🇷</span><b>BRA</b></div>
              <div class="font-numeric mscore">2<span>:</span>1</div>
              <div class="mteam"><b>ARG</b><span class="flag">🇦🇷</span></div>
            </div>
            <div class="mock-foot">
              <span class="mchip">Seu palpite 2:1 · Cravou +10</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="block">
      <h2 class="font-display sec-title">Como funciona</h2>
      <div class="steps">
        <div v-for="s in steps" :key="s.n" class="step card">
          <span class="font-display snum">{{ s.n }}</span>
          <h3>{{ s.title }}</h3>
          <p>{{ s.text }}</p>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="block">
      <h2 class="font-display sec-title">Por que jogar aqui</h2>
      <div class="feats">
        <div v-for="f in features" :key="f.title" class="feat card">
          <span class="fic" :style="{ color: f.color, borderColor: f.color }">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="f.icon" />
          </span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="final">
      <div class="glow glow-c" aria-hidden="true" />
      <h2 class="font-display">Bora cravar esse placar?</h2>
      <p>Crie sua conta e comece a palpitar em minutos.</p>
      <div class="cta">
        <NuxtLink to="/register" class="btn btn-gold big">Criar conta grátis</NuxtLink>
        <NuxtLink to="/login" class="btn big">Entrar</NuxtLink>
      </div>
    </section>

    <footer class="lfoot">
      Amigos do Bolão · Copa do Mundo 2026
    </footer>
  </div>
</template>

<style scoped>
.land-page {
  padding: 8px 0 24px;
}

/* hero */
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(15, 179, 107, 0.16), rgba(30, 127, 240, 0.14)), var(--bg-surface);
  padding: clamp(24px, 5vw, 52px);
  margin: 14px 0 34px;
}
.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(6px);
}
.glow-a {
  width: 320px;
  height: 320px;
  right: -80px;
  top: -90px;
  background: radial-gradient(circle, rgba(244, 184, 30, 0.26), transparent 70%);
}
.glow-b {
  width: 280px;
  height: 280px;
  left: -90px;
  bottom: -110px;
  background: radial-gradient(circle, rgba(15, 179, 107, 0.22), transparent 70%);
}
.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 32px;
}
.eyebrow {
  display: inline-block;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--azure);
  margin-bottom: 14px;
}
.title {
  font-weight: 700;
  font-size: clamp(36px, 6.5vw, 60px);
  line-height: 0.95;
  text-transform: uppercase;
}
.hl {
  color: var(--gold);
}
.lead {
  margin-top: 18px;
  max-width: 460px;
  color: var(--muted);
  font-size: clamp(14px, 2.4vw, 16px);
  line-height: 1.55;
}
.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 26px;
}
.btn.big {
  font-size: 15px;
  padding: 13px 22px;
}

/* hero mock card */
.hero-card {
  display: flex;
  justify-content: center;
}
.mock {
  width: 100%;
  max-width: 320px;
  border-radius: 18px;
  padding: 16px;
  transform: rotate(2deg);
  box-shadow: var(--shadow);
}
.mock-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.mlbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.mstatus {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--scarlet);
  border: 1px solid var(--scarlet);
  border-radius: 999px;
  padding: 4px 9px;
}
.mstatus .d {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
}
.mock-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}
.mteam {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
}
.mteam:last-child {
  justify-content: flex-end;
}
.flag {
  font-size: 26px;
  line-height: 1;
}
.mscore {
  font-size: 40px;
  line-height: 0.8;
}
.mscore span {
  color: var(--muted);
  margin: 0 3px;
}
.mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}
.mchip {
  font-size: 11px;
  font-weight: 800;
  color: var(--emerald);
  border: 1px solid var(--emerald);
  border-radius: 999px;
  padding: 4px 11px;
}

/* sections */
.block {
  margin: 36px 0;
}
.sec-title {
  font-weight: 600;
  font-size: clamp(20px, 3.5vw, 26px);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 18px;
}
.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 14px;
}
.step {
  border-radius: 18px;
  padding: 22px;
}
.snum {
  font-size: 30px;
  color: var(--gold);
  font-weight: 700;
}
.step h3,
.feat h3 {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 17px;
  margin: 10px 0 6px;
}
.step p,
.feat p {
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.5;
}
.feats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 14px;
}
.feat {
  border-radius: 18px;
  padding: 20px;
}
.fic {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1.5px solid;
  background: var(--bg-base);
}

/* final cta */
.final {
  position: relative;
  overflow: hidden;
  text-align: center;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(244, 184, 30, 0.14), rgba(224, 33, 138, 0.12)), var(--bg-surface);
  padding: clamp(30px, 6vw, 52px) 20px;
  margin: 40px 0 26px;
}
.glow-c {
  width: 340px;
  height: 340px;
  left: 50%;
  top: -120px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(244, 184, 30, 0.2), transparent 70%);
}
.final h2 {
  position: relative;
  font-weight: 700;
  font-size: clamp(24px, 5vw, 36px);
  text-transform: uppercase;
}
.final p {
  position: relative;
  color: var(--muted);
  margin-top: 8px;
  font-size: 15px;
}
.final .cta {
  position: relative;
  justify-content: center;
}
.lfoot {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  padding: 20px 0;
}

@media (max-width: 760px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 26px;
  }
  .hero-card {
    order: -1;
  }
  .mock {
    transform: none;
  }
}
</style>
