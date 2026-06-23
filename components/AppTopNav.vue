<script setup lang="ts">
// Menu da topbar (desktop) — espelha o UX/UI do drawer (hambúrguer): mesmos
// pilares em Oswald uppercase, Copa em destaque, ativo em azure e a MESMA árvore
// aninhada (useNavTree). Aqui ela vira dropdowns horizontais: passar o mouse (ou
// focar) num pilar abre o painel com a sub-árvore já expandida; clicar no pilar
// navega pra seção. Some no mobile (lá vale o drawer) — ver AppHeader.
const { newsTree, championships, bolaoFlat, bolaoRanking, bolaoRoot } = useNavTree();
const route = useRoute();

// Qual dropdown está aberto. '' = nenhum. Pequeno atraso ao sair pra não fechar
// quando o mouse cruza o vão entre o pilar e o painel.
const open = ref('');
let closeT: ReturnType<typeof setTimeout> | undefined;
function enter(k: string) {
  if (closeT) clearTimeout(closeT);
  open.value = k;
}
function leave() {
  if (closeT) clearTimeout(closeT);
  closeT = setTimeout(() => (open.value = ''), 120);
}
function close() {
  if (closeT) clearTimeout(closeT);
  open.value = '';
}

// Acende o pilar da rota atual.
const active = (prefix: string) =>
  prefix === '/' ? route.path === '/' : route.path.startsWith(prefix);

// Fecha ao navegar.
watch(() => route.fullPath, () => close());
</script>

<template>
  <nav class="tnav" aria-label="Navegação principal">
    <!-- COPA EM DESTAQUE (ímã de tráfego do evento ao vivo) -->
    <NuxtLink to="/futebol/campeonato/copa-do-mundo" class="tcopa">
      <AppIcon name="trophy" :size="15" :stroke="2" />
      <span>Copa 2026</span>
    </NuxtLink>

    <NuxtLink to="/" class="titem" :class="{ on: active('/') }">Início</NuxtLink>

    <!-- NOTÍCIAS -->
    <div class="tgroup" @mouseenter="enter('noticias')" @mouseleave="leave" @focusin="enter('noticias')" @focusout="leave">
      <NuxtLink to="/noticias" class="titem" :class="{ on: active('/noticias') }">
        Notícias
        <AppIcon v-if="newsTree.length" name="chevronDown" :size="14" :stroke="2.4" class="tcar" :class="{ on: open === 'noticias' }" />
      </NuxtLink>
      <Transition name="dd">
        <div v-if="open === 'noticias' && newsTree.length" class="ddpanel">
          <ul class="ddtree">
            <li v-for="n in newsTree" :key="n.slug" class="ddblock">
              <NuxtLink :to="`/noticias/categoria/${n.slug}`" class="dd-head">{{ n.name }}</NuxtLink>
              <ul v-if="n.children.length" class="dd-sub">
                <li v-for="c in n.children" :key="c.slug">
                  <NuxtLink :to="`/noticias/categoria/${c.slug}`" class="dd-link">{{ c.name }}</NuxtLink>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </Transition>
    </div>

    <!-- FUTEBOL -->
    <div class="tgroup" @mouseenter="enter('futebol')" @mouseleave="leave" @focusin="enter('futebol')" @focusout="leave">
      <NuxtLink to="/futebol" class="titem" :class="{ on: active('/futebol') }">
        Futebol
        <AppIcon name="chevronDown" :size="14" :stroke="2.4" class="tcar" :class="{ on: open === 'futebol' }" />
      </NuxtLink>
      <Transition name="dd">
        <div v-if="open === 'futebol'" class="ddpanel">
          <NuxtLink to="/futebol/campeonato" class="dd-grouphead">Campeonatos</NuxtLink>
          <ul v-if="championships.length" class="ddtree">
            <li v-for="c in championships" :key="c.id" class="ddblock">
              <NuxtLink :to="`/futebol/campeonato/${c.urlSlug}`" class="dd-head">{{ c.name }}</NuxtLink>
              <ul class="dd-sub">
                <li><NuxtLink :to="`/futebol/campeonato/${c.urlSlug}/jogos`" class="dd-link">Jogos</NuxtLink></li>
                <li><NuxtLink :to="`/futebol/campeonato/${c.urlSlug}/tabela`" class="dd-link">Tabela</NuxtLink></li>
              </ul>
            </li>
          </ul>
        </div>
      </Transition>
    </div>

    <!-- BOLÃO -->
    <div class="tgroup" @mouseenter="enter('bolao')" @mouseleave="leave" @focusin="enter('bolao')" @focusout="leave">
      <NuxtLink :to="bolaoRoot" class="titem bolao" :class="{ on: active('/boloes') }">
        Bolão
        <AppIcon v-if="bolaoFlat.length || bolaoRanking.length" name="chevronDown" :size="14" :stroke="2.4" class="tcar" :class="{ on: open === 'bolao' }" />
      </NuxtLink>
      <Transition name="dd">
        <div v-if="open === 'bolao' && (bolaoFlat.length || bolaoRanking.length)" class="ddpanel narrow">
          <ul class="ddtree">
            <li v-for="b in bolaoFlat" :key="b.to" class="ddflatitem">
              <NuxtLink :to="b.to" class="dd-head">{{ b.label }}</NuxtLink>
            </li>
            <!-- Ranking = bloco pai com as competições indentadas (igual Campeonatos) -->
            <li v-if="bolaoRanking.length" class="ddblock">
              <span class="dd-head as-parent">Ranking</span>
              <ul class="dd-sub">
                <li v-for="r in bolaoRanking" :key="r.to">
                  <NuxtLink :to="r.to" class="dd-link">{{ r.label }}</NuxtLink>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped>
.tnav {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Copa em destaque — mesma linguagem do .dcopa do drawer (gradiente dourado). */
.tcopa {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 999px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 22%, var(--bg-surface)), var(--bg-surface) 78%);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
  color: var(--text);
  text-decoration: none;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition: border-color 0.13s;
}
.tcopa:hover {
  border-color: var(--gold);
}

.tgroup {
  position: relative;
}
/* Pilar — mesmo tom dos .plink do drawer (Oswald uppercase). */
.titem {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 9px 12px;
  border-radius: 11px;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14.5px;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.13s, color 0.13s;
}
.titem:hover {
  background: var(--bg-surface);
}
.titem.on {
  color: var(--azure);
}
.titem.bolao {
  color: var(--gold);
}
.tcar {
  color: var(--muted);
  transition: transform 0.16s;
}
.tcar.on {
  transform: rotate(180deg);
}

/* Painel do dropdown — mesma "casca" do menu de conta (elevado, borda, sombra). */
.ddpanel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 50;
  min-width: 240px;
  max-width: 320px;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(8, 12, 18, 0.18));
}
.ddpanel.narrow {
  min-width: 200px;
}

.ddtree {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ddblock + .ddblock {
  margin-top: 1px;
}

/* Rótulo de grupo (Campeonatos) — header tipo seção, como no drawer. */
.dd-grouphead {
  display: block;
  padding: 8px 10px;
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  text-decoration: none;
  border-radius: 8px;
}
.dd-grouphead:hover {
  color: var(--text);
  background: var(--bg-surface);
}

/* Pai (categoria / campeonato) — peso 700, mesmo tom do .comp-name do drawer. */
.dd-head {
  display: block;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dd-head:hover {
  background: var(--bg-surface);
}
/* "Ranking" é rótulo-pai (não navega) — sem hover/cursor de clique. */
.dd-head.as-parent {
  cursor: default;
}
.dd-head.as-parent:hover {
  background: transparent;
}
.dd-head.router-link-active {
  color: var(--azure);
}

/* Filhos indentados sob o pai, com a guia à esquerda (igual .psub do drawer). */
.dd-sub {
  list-style: none;
  margin: 1px 0 4px;
  padding: 0 0 0 10px;
  margin-left: 10px;
  border-left: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ddtree.flat .dd-head {
  font-weight: 600;
}
.dd-link {
  display: block;
  padding: 7px 10px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  text-decoration: none;
}
.dd-link:hover {
  color: var(--text);
  background: var(--bg-surface);
}
.dd-link.router-link-active {
  color: var(--azure);
}

.dd-enter-active,
.dd-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.dd-enter-from,
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
