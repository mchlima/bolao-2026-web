<script setup lang="ts">
// Drawer lateral = a árvore de navegação COMPLETA, aninhada. É a fonte única da
// estrutura (os 3 pilares + categorias de notícia + conta + secundários). No
// desktop substitui os antigos dropdowns de hover; no mobile resolve o submenu
// sem depender de hover. Abre por cima de tudo (Teleport), em qualquer tamanho.
import type { TermPage } from '~/types/api';
import { buildNewsTree, type MenuNode } from '~/utils/newsMenu';

const { open, closeDrawer } = useNavDrawer();
const auth = useAuthStore();
const route = useRoute();
const authLink = useAuthLink();

// Categorias (rollup) pra montar a árvore de Notícias. Falha silenciosa.
const { data: cats } = await useAsyncData('nav-drawer-cats', () =>
  useApi()<TermPage[]>('/content/categories').catch(() => [] as TermPage[]),
);
const newsTree = computed<MenuNode[]>(() => buildNewsTree(cats.value ?? []).slice(0, 8));

// Sub-destinos de Jogos (mesma lista dos chips de FutebolSectionNav).
const jogos = [
  { label: 'Jogos de hoje', to: '/futebol/jogos-de-hoje' },
  { label: 'Ao vivo', to: '/futebol/agenda?scope=live' },
  { label: 'Agenda completa', to: '/futebol/agenda' },
  { label: 'Campeonatos', to: '/futebol/torneios' },
  { label: 'Seleções', to: '/futebol/selecoes' },
];
const bolaoChildren = computed(() =>
  auth.isAuthenticated
    ? [
        { label: 'Meus bolões', to: '/boloes' },
        { label: 'Palpites pendentes', to: '/boloes/palpites' },
        { label: 'Ranking', to: '/boloes/ranking' },
      ]
    : [],
);
const bolaoRoot = computed(() => (auth.isAuthenticated ? '/boloes' : '/bolao-da-copa-do-mundo-2026'));

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

              <!-- NOTÍCIAS -->
              <div class="pillar">
                <div class="prow">
                  <NuxtLink to="/noticias" class="plink"><AppIcon name="news" :size="18" :stroke="2" /> Notícias</NuxtLink>
                  <button v-if="newsTree.length" class="pexp" :class="{ on: expanded.noticias }" aria-label="Expandir" @click="togglePillar('noticias')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.noticias && newsTree.length" class="psub">
                  <li v-for="n in newsTree" :key="n.slug">
                    <NuxtLink :to="`/noticias/categoria/${n.slug}`" class="slink">{{ n.name }}</NuxtLink>
                    <ul v-if="n.children.length" class="psub2">
                      <li v-for="c in n.children" :key="c.slug">
                        <NuxtLink :to="`/noticias/categoria/${c.slug}`" class="slink sm">{{ c.name }}</NuxtLink>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              <!-- JOGOS -->
              <div class="pillar">
                <div class="prow">
                  <NuxtLink to="/futebol/agenda" class="plink"><AppIcon name="calendar" :size="18" :stroke="2" /> Jogos</NuxtLink>
                  <button class="pexp" :class="{ on: expanded.jogos }" aria-label="Expandir" @click="togglePillar('jogos')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.jogos" class="psub">
                  <li v-for="j in jogos" :key="j.to"><NuxtLink :to="j.to" class="slink">{{ j.label }}</NuxtLink></li>
                </ul>
              </div>

              <!-- BOLÃO -->
              <div class="pillar bolao">
                <div class="prow">
                  <NuxtLink :to="bolaoRoot" class="plink"><AppIcon name="trophy" :size="18" :stroke="2" /> Bolão</NuxtLink>
                  <button v-if="bolaoChildren.length" class="pexp" :class="{ on: expanded.bolao }" aria-label="Expandir" @click="togglePillar('bolao')">
                    <AppIcon name="chevronDown" :size="16" :stroke="2.4" />
                  </button>
                </div>
                <ul v-if="expanded.bolao && bolaoChildren.length" class="psub">
                  <li v-for="b in bolaoChildren" :key="b.to"><NuxtLink :to="b.to" class="slink">{{ b.label }}</NuxtLink></li>
                </ul>
              </div>

              <div class="dsep" />

              <!-- CONTA -->
              <template v-if="auth.isAuthenticated">
                <AccountMenu @close="closeDrawer" />
              </template>
              <template v-else>
                <div class="dcta">
                  <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold" @click="closeDrawer">Criar conta grátis</NuxtLink>
                  <NuxtLink :to="authLink('/entrar')" class="btn" @click="closeDrawer">Entrar</NuxtLink>
                </div>
              </template>

              <div class="dsep" />

              <!-- SECUNDÁRIOS -->
              <NuxtLink to="/como-funciona" class="slink2" @click="closeDrawer">Como funciona</NuxtLink>
            </nav>
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
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg-elevated); z-index: 1; }
.dbrand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.dlogo { width: 34px; height: 34px; border-radius: 10px; background: var(--grad-trophy); display: grid; place-items: center; }
.dname { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 17px; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text); }
.dclose { display: grid; place-items: center; width: 36px; height: 36px; border: 0; background: transparent; color: var(--muted); border-radius: 9px; cursor: pointer; }
.dclose:hover { color: var(--text); background: var(--bg-surface); }

.dnav { padding: 10px 12px 24px; display: flex; flex-direction: column; }
.dcopa { display: flex; align-items: center; gap: 11px; padding: 13px 14px; margin-bottom: 8px; border-radius: 13px; background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 20%, var(--bg-surface)), var(--bg-surface) 75%); border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border)); color: var(--text); text-decoration: none; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; text-transform: uppercase; letter-spacing: 0.01em; }
.dcopa:hover { border-color: var(--gold); }
.dcopa-go { margin-left: auto; color: var(--muted); }
.pillar { padding: 2px 0; }
.prow { display: flex; align-items: center; gap: 4px; }
.plink { flex: 1; display: flex; align-items: center; gap: 11px; padding: 12px 12px; border-radius: 11px; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 0.01em; color: var(--text); text-decoration: none; }
.plink:hover { background: var(--bg-surface); }
.pillar.bolao .plink { color: var(--gold); }
.pexp { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border: 0; background: transparent; color: var(--muted); border-radius: 9px; cursor: pointer; transition: transform 0.16s, color 0.13s; }
.pexp:hover { color: var(--text); background: var(--bg-surface); }
.pexp.on { transform: rotate(180deg); }
.psub { list-style: none; margin: 2px 0 8px; padding: 0 0 0 12px; display: flex; flex-direction: column; gap: 1px; border-left: 2px solid var(--border); margin-left: 18px; }
.psub2 { list-style: none; margin: 0; padding-left: 10px; }
.slink { display: block; padding: 9px 12px; border-radius: 9px; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: none; }
.slink:hover { color: var(--text); background: var(--bg-surface); }
.slink.sm { font-size: 13px; opacity: 0.9; }
.slink.router-link-active { color: var(--azure); }
.dsep { height: 1px; background: var(--border); margin: 12px 6px; }
.dcta { display: flex; flex-direction: column; gap: 8px; padding: 0 6px; }
.dcta .btn { width: 100%; }
.slink2 { display: block; width: 100%; text-align: left; padding: 10px 12px; border: 0; background: none; color: var(--muted); font: inherit; font-size: 13.5px; font-weight: 600; border-radius: 9px; cursor: pointer; text-decoration: none; }
.slink2:hover { color: var(--text); background: var(--bg-surface); }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.24s ease; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(-100%); }
</style>
