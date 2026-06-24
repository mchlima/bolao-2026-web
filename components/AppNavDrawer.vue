<script setup lang="ts">
// Drawer lateral = a árvore de navegação COMPLETA, aninhada. No mobile é a
// navegação principal (hambúrguer); resolve o submenu sem depender de hover. Abre
// por cima de tudo (Teleport). A estrutura (os 3 pilares + categorias de notícia
// + campeonatos + sub-bolão) vem de useNavTree — a MESMA fonte do menu da topbar
// (desktop), pra os dois nunca divergirem.
const { open, closeDrawer } = useNavDrawer();
const auth = useAuthStore();
const route = useRoute();
const authLink = useAuthLink();

const { newsTree, championships, bolaoFlat, bolaoRanking, bolaoRoot } = useNavTree();

// Subgrupo "Ranking" dentro de Bolão (Bolão > Ranking > competição). Começa aberto
// quando já estamos numa página de ranking por competição.
const rankOpen = ref(route.path.startsWith('/boloes/ranking'));

// Acordeão: cada pilar abre/fecha; o pilar da rota atual começa aberto.
const section = computed(() => {
  const p = route.path;
  if (p.startsWith('/noticias')) return 'noticias';
  if (p.startsWith('/boloes')) return 'bolao';
  if (p.startsWith('/futebol')) return 'jogos';
  return '';
});
const expanded = reactive<Record<string, boolean>>({ noticias: false, jogos: true, bolao: false });
watchEffect(() => {
  if (section.value) expanded[section.value] = true;
});
function togglePillar(k: string) {
  expanded[k] = !expanded[k];
}

// "Campeonatos" é o grupo pai (começa aberto); cada campeonato filho expande/recolhe
// individualmente (submenu Jogos/Tabela).
const campOpen = ref(true);
const compOpen = reactive<Record<string, boolean>>({});
function toggleComp(id: string) {
  compOpen[id] = !compOpen[id];
}

// Notícias: cada categoria com subcategorias expande/recolhe individualmente
// (mesmo padrão dos campeonatos no Futebol).
const newsOpen = reactive<Record<string, boolean>>({});
function toggleNews(slug: string) {
  newsOpen[slug] = !newsOpen[slug];
}

// Fecha ao navegar (clicar num link muda a rota).
watch(() => route.fullPath, () => closeDrawer());

// Trava o scroll do body enquanto aberto.
watch(open, (v) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = v ? 'hidden' : '';
});
onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="open" class="dwrap" @click.self="closeDrawer">
          <aside class="drawer" role="dialog" aria-label="Menu">
            <header class="dhead">
              <NuxtLink to="/" class="dbrand" @click="closeDrawer">
                <span class="dlogo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
                </span>
                <span class="dname">Cravei</span>
              </NuxtLink>
              <button class="dclose" aria-label="Fechar" @click="closeDrawer">
                <AppIcon name="close" :size="20" :stroke="2.2" />
              </button>
            </header>

            <nav class="dnav">
              <!-- COPA EM DESTAQUE (ímã de tráfego do evento ao vivo) -->
              <NuxtLink to="/copa-do-mundo-2026" class="dcopa" @click="closeDrawer">
                <AppIcon name="trophy" :size="18" :stroke="2" />
                <span>Copa do Mundo 2026</span>
                <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="dcopa-go" />
              </NuxtLink>

              <!-- INÍCIO -->
              <div class="pillar">
                <div class="prow">
                  <NuxtLink to="/" class="plink"><AppIcon name="home" :size="18" :stroke="2" /> Início</NuxtLink>
                </div>
              </div>

              <!-- NOTÍCIAS -->
              <div class="pillar">
                <div class="prow">
                  <NuxtLink to="/noticias" class="plink"><AppIcon name="news" :size="18" :stroke="2" /> Notícias</NuxtLink>
                  <button v-if="newsTree.length" class="pexp" :class="{ on: expanded.noticias }" aria-label="Expandir" @click="togglePillar('noticias')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.noticias && newsTree.length" class="psub">
                  <li v-for="n in newsTree" :key="n.slug" class="comp-block">
                    <div class="comp-row">
                      <NuxtLink :to="`/noticias/categoria/${n.slug}`" class="comp-head">
                        <span class="comp-name">{{ n.name }}</span>
                      </NuxtLink>
                      <button v-if="n.children.length" class="pexp" :class="{ on: newsOpen[n.slug] }" aria-label="Expandir" @click="toggleNews(n.slug)">
                        <AppIcon name="chevronDown" :size="15" :stroke="2.4" />
                      </button>
                    </div>
                    <ul v-if="n.children.length && newsOpen[n.slug]" class="comp-sub">
                      <li v-for="c in n.children" :key="c.slug">
                        <NuxtLink :to="`/noticias/categoria/${c.slug}`" class="slink sm">{{ c.name }}</NuxtLink>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              <!-- FUTEBOL -->
              <div class="pillar">
                <div class="prow">
                  <NuxtLink to="/futebol" class="plink"><AppIcon name="calendar" :size="18" :stroke="2" /> Futebol</NuxtLink>
                  <button class="pexp" :class="{ on: expanded.jogos }" aria-label="Expandir" @click="togglePillar('jogos')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.jogos" class="psub">
                  <!-- CAMPEONATOS: grupo pai; os campeonatos são filhos dele -->
                  <li v-if="championships.length" class="camp-group">
                    <div class="comp-row">
                      <NuxtLink to="/futebol/campeonato" class="camp-head">Campeonatos</NuxtLink>
                      <button class="pexp" :class="{ on: campOpen }" aria-label="Expandir" @click="campOpen = !campOpen">
                        <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                      </button>
                    </div>
                    <ul v-if="campOpen" class="camp-sub">
                      <li v-for="c in championships" :key="c.id" class="comp-block">
                        <div class="comp-row">
                          <NuxtLink :to="`/futebol/campeonato/${c.urlSlug}`" class="comp-head">
                            <span class="comp-name">{{ c.name }}</span>
                          </NuxtLink>
                          <button class="pexp" :class="{ on: compOpen[c.id] }" aria-label="Expandir" @click="toggleComp(c.id)">
                            <AppIcon name="chevronDown" :size="15" :stroke="2.4" />
                          </button>
                        </div>
                        <ul v-if="compOpen[c.id]" class="comp-sub">
                          <li><NuxtLink :to="`/futebol/campeonato/${c.urlSlug}/jogos`" class="slink sm">Jogos</NuxtLink></li>
                          <li><NuxtLink :to="`/futebol/campeonato/${c.urlSlug}/tabela`" class="slink sm">Tabela</NuxtLink></li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              <!-- BOLÃO -->
              <div class="pillar bolao">
                <div class="prow">
                  <NuxtLink :to="bolaoRoot" class="plink"><AppIcon name="trophy" :size="18" :stroke="2" /> Bolão</NuxtLink>
                  <button v-if="bolaoFlat.length || bolaoRanking.length" class="pexp" :class="{ on: expanded.bolao }" aria-label="Expandir" @click="togglePillar('bolao')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.bolao && (bolaoFlat.length || bolaoRanking.length)" class="psub">
                  <li v-for="b in bolaoFlat" :key="b.to"><NuxtLink :to="b.to" class="slink">{{ b.label }}</NuxtLink></li>
                  <!-- RANKING = subgrupo (Bolão > Ranking > competição) -->
                  <li v-if="bolaoRanking.length" class="camp-group">
                    <div class="comp-row">
                      <span class="camp-head" role="button" tabindex="0" @click="rankOpen = !rankOpen" @keydown.enter="rankOpen = !rankOpen">Ranking</span>
                      <button class="pexp" :class="{ on: rankOpen }" aria-label="Expandir" @click="rankOpen = !rankOpen">
                        <AppIcon name="chevronDown" :size="15" :stroke="2.4" />
                      </button>
                    </div>
                    <ul v-if="rankOpen" class="comp-sub">
                      <li v-for="r in bolaoRanking" :key="r.to"><NuxtLink :to="r.to" class="slink sm">{{ r.label }}</NuxtLink></li>
                    </ul>
                  </li>
                </ul>
              </div>

            </nav>

            <!-- CONTA: fixa no rodapé do drawer (avatar abre o menu suspenso). -->
            <footer class="dfoot">
              <template v-if="auth.isAuthenticated">
                <AccountMenu dropup @close="closeDrawer" />
              </template>
              <template v-else>
                <div class="dcta">
                  <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold" @click="closeDrawer">Criar conta grátis</NuxtLink>
                  <NuxtLink :to="authLink('/entrar')" class="btn" @click="closeDrawer">Entrar</NuxtLink>
                </div>
              </template>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.dwrap { position: fixed; inset: 0; z-index: 90; background: rgba(8, 12, 18, 0.5); display: flex; }
.drawer {
  width: min(86vw, 320px);
  height: 100%;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dhead { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
.dbrand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.dlogo { width: 34px; height: 34px; border-radius: 10px; background: var(--grad-trophy); display: grid; place-items: center; }
.dname { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-lg); text-transform: uppercase; letter-spacing: 0.02em; color: var(--text); }
.dclose { display: grid; place-items: center; width: 36px; height: 36px; border: 0; background: transparent; color: var(--muted); border-radius: 9px; cursor: pointer; }
.dclose:hover { color: var(--text); background: var(--bg-surface); }

.dnav { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 10px 12px 16px; display: flex; flex-direction: column; }
.dfoot { flex: none; padding: 10px 12px; border-top: 1px solid var(--border); background: var(--bg-elevated); }
.dcopa { display: flex; align-items: center; gap: 11px; padding: 13px 14px; margin-bottom: 8px; border-radius: 13px; background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 20%, var(--bg-surface)), var(--bg-surface) 75%); border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border)); color: var(--text); text-decoration: none; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: var(--fs-base); text-transform: uppercase; letter-spacing: 0.01em; }
.dcopa:hover { border-color: var(--gold); }
.dcopa-go { margin-left: auto; color: var(--muted); }
.pillar { padding: 2px 0; }
.prow { display: flex; align-items: center; gap: 4px; }
.plink { flex: 1; display: flex; align-items: center; gap: 11px; padding: 12px 12px; border-radius: 11px; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: var(--fs-base); text-transform: uppercase; letter-spacing: 0.01em; color: var(--text); text-decoration: none; }
.plink:hover { background: var(--bg-surface); }
.pillar.bolao .plink { color: var(--gold); }
/* Filhos de Bolão na mesma cor/peso dos filhos de Futebol (campeonatos). */
.pillar.bolao .slink { color: var(--text); font-weight: 700; }
.pillar.bolao .slink.router-link-active { color: var(--azure); }
.pexp { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border: 0; background: transparent; color: var(--muted); border-radius: 9px; cursor: pointer; transition: transform 0.16s, color 0.13s; }
.pexp:hover { color: var(--text); background: var(--bg-surface); }
.pexp.on { transform: rotate(180deg); }
.psub { list-style: none; margin: 2px 0 8px; padding: 0 0 0 12px; display: flex; flex-direction: column; gap: 1px; border-left: 2px solid var(--border); margin-left: 18px; }
.slink { display: block; padding: 9px 12px; border-radius: 9px; font-size: var(--fs-base); font-weight: 600; color: var(--muted); text-decoration: none; }
.slink:hover { color: var(--text); background: var(--bg-surface); }
.slink.sm { font-size: var(--fs-base); opacity: 0.9; }
.slink.router-link-active { color: var(--azure); }
/* CAMPEONATOS = grupo pai (header tipo rótulo de seção). */
.camp-group { margin: 6px 0 2px; }
.camp-head { flex: 1; min-width: 0; padding: 8px 12px; font-size: var(--fs-base); font-weight: 700; text-transform: capitalize; color: var(--text); text-decoration: none; border-radius: 7px; cursor: pointer; }
.camp-head:hover { color: var(--text); background: var(--bg-surface); }
.camp-head.router-link-active { color: var(--azure); }
/* Filhos de CAMPEONATOS, indentados sob o grupo. */
.camp-sub { list-style: none; margin: 1px 0 2px; padding: 0; border-left: 2px solid var(--border); margin-left: 12px; padding-left: 6px; }
.comp-block { margin: 1px 0; }
.comp-row { display: flex; align-items: center; gap: 4px; }
.comp-head { flex: 1; min-width: 0; display: flex; align-items: center; padding: 8px 12px; border-radius: 9px; text-decoration: none; }
.comp-head:hover { background: var(--bg-surface); }
.comp-name { min-width: 0; font-size: var(--fs-base); font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.comp-sub { list-style: none; margin: 0 0 4px; padding: 0 0 0 14px; display: flex; flex-direction: column; gap: 1px; }
.dsep { height: 1px; background: var(--border); margin: 12px 6px; }
.dcta { display: flex; flex-direction: column; gap: 8px; padding: 0 6px; }
.dcta .btn { width: 100%; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.24s ease; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(-100%); }
</style>
