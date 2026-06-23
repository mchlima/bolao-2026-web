<script setup lang="ts">
// Rodapé global do layout padrão — fundo escuro (contraste com o app claro), marca +
// colunas de navegação por seção + barra legal. Aparece em todas as páginas (vive no
// <main>, abaixo do conteúdo). Mobile empilha as colunas.
const auth = useAuthStore();
const year = new Date().getFullYear();
const bolaoRoot = computed(() => (auth.isAuthenticated ? '/boloes' : '/bolao-da-copa-do-mundo-2026'));

const columns = computed(() => [
  {
    title: 'Futebol',
    links: [
      { label: 'Copa do Mundo 2026', to: '/copa-do-mundo-2026' },
      { label: 'Agenda', to: '/futebol/agenda' },
      { label: 'Jogos de hoje', to: '/futebol/jogos-de-hoje' },
      { label: 'Ao vivo', to: '/futebol/agenda?scope=live' },
      { label: 'Campeonatos', to: '/futebol/campeonato' },
      { label: 'Seleções', to: '/futebol/selecoes' },
    ],
  },
  {
    title: 'Notícias',
    links: [
      { label: 'Últimas notícias', to: '/noticias' },
      { label: 'Categorias', to: '/noticias/categoria' },
      { label: 'Assuntos', to: '/noticias/assunto' },
    ],
  },
  {
    title: 'Bolão',
    links: [
      { label: 'Bolão da Copa do Mundo', to: bolaoRoot.value },
      { label: 'Como funciona', to: '/como-funciona' },
    ],
  },
]);
</script>

<template>
  <footer class="foot">
    <div class="foot-inner">
      <div class="foot-top">
        <!-- Marca -->
        <div class="foot-brand">
          <NuxtLink to="/" class="fb-logo" aria-label="Cravei — início">
            <span class="fb-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
            </span>
            <span class="fb-name font-display">Cravei</span>
          </NuxtLink>
          <p class="fb-tag">Notícias, jogos e o bolão da Copa do Mundo — crave os placares e dispute o ranking com a galera.</p>
          <NuxtLink :to="bolaoRoot" class="fb-cta">Criar meu bolão</NuxtLink>
          <p class="fb-contact">
            Encontrou um problema ou tem uma sugestão? Escreva para
            <a href="mailto:dev@cravei.app?subject=Problema%20ou%20sugest%C3%A3o%20no%20Cravei" class="fb-mail">dev@cravei.app</a>.
          </p>
        </div>

        <!-- Colunas de links -->
        <nav class="foot-cols">
          <div v-for="c in columns" :key="c.title" class="foot-col">
            <h3 class="fc-title">{{ c.title }}</h3>
            <ul class="fc-list">
              <li v-for="l in c.links" :key="l.to + l.label">
                <NuxtLink :to="l.to" class="fc-link">{{ l.label }}</NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div class="foot-bottom">
        <p class="fb-disc">
          Plataforma independente. Sem qualquer vínculo, patrocínio ou endosso da FIFA ou de
          entidades organizadoras. Marcas e nomes de competições citados pertencem aos seus
          respectivos titulares.
        </p>
        <span class="fb-copy">© {{ year }} Cravei</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  margin-top: 40px;
  background: #0a0e15;
  color: #c4cad6;
}
.foot-inner {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 40px 16px 28px;
}
.foot-top {
  display: grid;
  grid-template-columns: 1.4fr 2.6fr;
  gap: 32px 24px;
}

/* Marca */
.foot-brand { min-width: 0; }
.fb-logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
.fb-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--grad-trophy, linear-gradient(135deg, #ffb020, #ff7a59)); display: grid; place-items: center; }
.fb-name { font-weight: 700; font-size: 19px; text-transform: uppercase; letter-spacing: 0.03em; color: #fff; }
.fb-tag { margin: 13px 0 0; font-size: 13px; line-height: 1.55; color: #9aa3b4; max-width: 40ch; }
.fb-cta {
  display: inline-block;
  margin-top: 16px;
  padding: 9px 16px;
  border-radius: 999px;
  background: var(--gold, #ffb020);
  color: #0a0e14;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  transition: filter 0.14s;
}
.fb-cta:hover { filter: brightness(1.06); }
.fb-contact { margin: 16px 0 0; font-size: 12.5px; line-height: 1.55; color: #9aa3b4; max-width: 40ch; }
.fb-mail { color: var(--gold, #ffb020); font-weight: 700; text-decoration: none; white-space: nowrap; }
.fb-mail:hover { text-decoration: underline; }

/* Colunas */
.foot-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.fc-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #fff;
  margin-bottom: 12px;
}
.fc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.fc-link {
  font-size: 13.5px;
  font-weight: 600;
  color: #9aa3b4;
  text-decoration: none;
  transition: color 0.13s;
}
.fc-link:hover { color: #fff; }

/* Barra legal */
.foot-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  flex-wrap: wrap;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}
.fb-disc { margin: 0; max-width: 70ch; font-size: 11px; line-height: 1.55; color: #6f7888; }
.fb-copy { flex: none; font-size: 12px; font-weight: 700; color: #8b94a6; white-space: nowrap; }

@media (max-width: 860px) {
  .foot-top { grid-template-columns: 1fr; gap: 28px; }
  .foot-cols { grid-template-columns: repeat(2, 1fr); gap: 24px 16px; }
}
@media (max-width: 420px) {
  .foot-inner { padding: 32px 16px 24px; }
}
</style>
