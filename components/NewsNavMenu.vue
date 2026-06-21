<script setup lang="ts">
import type { TermPage } from '~/types/api';
import { buildNewsTree, type MenuNode } from '~/utils/newsMenu';

const route = useRoute();

// Categorias com matéria publicada (rollup) — montam a árvore do menu. Falha
// silenciosa: o menu ainda funciona com os links fixos (Todas/Categorias/Assuntos).
const { data } = await useAsyncData('news-menu-cats', () =>
  useApi()<TermPage[]>('/content/categories').catch(() => [] as TermPage[]),
);

const tree = computed<MenuNode[]>(() => buildNewsTree(data.value ?? []));

const active = computed(() => route.path === '/noticias' || route.path.startsWith('/noticias/'));
const hasCats = computed(() => tree.value.length > 0);
</script>

<template>
  <div class="nv">
    <NuxtLink to="/noticias" class="nav-link nv-trigger" :class="{ active }">
      Notícias
      <svg
        class="nv-caret" width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </NuxtLink>

    <div class="nv-panel">
      <div class="nv-card">
        <NuxtLink to="/noticias" class="nv-all">
          <AppIcon name="inbox" :size="15" :stroke="1.9" /> Todas as notícias
        </NuxtLink>

        <template v-if="hasCats">
          <div class="nv-label">Categorias</div>
          <ul class="nv-list">
            <NewsNavMenuItem v-for="n in tree" :key="n.slug" :node="n" />
          </ul>
        </template>

        <div class="nv-sep" />
        <div class="nv-foot">
          <NuxtLink to="/noticias/categoria" class="nv-foot-link">Ver categorias</NuxtLink>
          <NuxtLink to="/noticias/assunto" class="nv-foot-link">Assuntos</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nv { position: relative; }

/* Trigger — espelha .nav-link do AppHeader (escopo não atravessa componentes) */
.nv-trigger {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  padding: 7px 11px;
  border-radius: 9px;
  text-decoration: none;
  transition: color 0.13s, background 0.13s;
}
.nv-trigger:hover,
.nv:hover .nv-trigger,
.nv-trigger.active { color: var(--text); background: var(--bg-surface); }
.nv-caret { color: var(--muted); transition: transform 0.16s; }
.nv:hover .nv-caret { transform: rotate(180deg); color: var(--text); }

/* Painel — top:100% com bridge transparente (padding-top) p/ não fechar no vão */
.nv-panel {
  position: absolute;
  top: 100%;
  left: 0;
  padding-top: 7px;
  display: none;
  z-index: 60;
}
.nv:hover .nv-panel,
.nv:focus-within .nv-panel { display: block; }
.nv-card {
  min-width: 248px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 8px;
}

.nv-all {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  transition: background-color 0.13s, color 0.13s;
}
.nv-all:hover { background: var(--bg-surface); color: var(--azure); }
.nv-label {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 9px 10px 4px;
}
.nv-list { list-style: none; margin: 0; padding: 0; }
.nv-sep { height: 1px; background: var(--border); margin: 7px 4px; }
.nv-foot { display: flex; gap: 6px; padding: 0 4px 2px; }
.nv-foot-link {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--azure);
  text-decoration: none;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.13s, background-color 0.13s;
}
.nv-foot-link:hover { border-color: var(--azure); background: color-mix(in srgb, var(--azure) 8%, transparent); }
</style>
