<script setup lang="ts">
import type { MenuNode } from '~/utils/newsMenu';
// Item recursivo do menu de Notícias. Categoria com filhos abre um submenu em
// cascata à direita (puro CSS via :hover/:focus-within). Auto-referência funciona
// pelo auto-import do Nuxt (componente nomeado pelo arquivo).
defineProps<{ node: MenuNode }>();
</script>

<template>
  <li class="nvi" :class="{ branch: node.children.length }">
    <NuxtLink :to="`/noticias/categoria/${node.slug}`" class="nvi-row">
      <span class="nvi-name">{{ node.name }}</span>
      <span class="nvi-count">{{ node.total }}</span>
      <svg
        v-if="node.children.length"
        class="nvi-caret"
        width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </NuxtLink>
    <ul v-if="node.children.length" class="nvi-sub">
      <NewsNavMenuItem v-for="c in node.children" :key="c.slug" :node="c" />
    </ul>
  </li>
</template>

<style scoped>
.nvi { position: relative; list-style: none; }
.nvi-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
  transition: background-color 0.13s, color 0.13s;
}
.nvi-row:hover { background: var(--bg-surface); color: var(--azure); }
.nvi-name { font-size: var(--fs-sm); font-weight: 600; flex: 1; white-space: nowrap; }
.nvi-count {
  font-size: var(--fs-xs); font-weight: 700; color: var(--muted);
  background: var(--bg-base); border-radius: 20px; padding: 0 6px;
}
.nvi-caret { color: var(--muted); margin-right: -2px; flex-shrink: 0; }
.branch:hover > .nvi-row .nvi-caret { color: var(--azure); }

/* submenu em cascata — encosta no item (left:100%, sem vão morto) */
.nvi-sub {
  position: absolute;
  left: 100%;
  top: -7px;
  margin: 0;
  padding: 7px;
  min-width: 210px;
  list-style: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: none;
}
.branch:hover > .nvi-sub,
.branch:focus-within > .nvi-sub { display: block; }
</style>
