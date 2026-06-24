<script setup lang="ts">
import type { TermPage } from '~/types/api';
import { buildNewsTree, type MenuNode } from '~/utils/newsMenu';

const route = useRoute();

// Categorias com matéria publicada (rollup) — montam a árvore do submenu. Falha
// silenciosa: sem categorias, "Notícias" vira um link simples (sem dropdown).
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
        v-if="hasCats"
        class="nv-caret" width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </NuxtLink>

    <div v-if="hasCats" class="nv-panel">
      <div class="nv-card">
        <ul class="nv-list">
          <NewsNavMenuItem v-for="n in tree" :key="n.slug" :node="n" />
        </ul>
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
  font-size: var(--fs-sm);
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

.nv-list { list-style: none; margin: 0; padding: 0; }
</style>
