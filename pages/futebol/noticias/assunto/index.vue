<script setup lang="ts">
import type { TermPage } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/futebol/noticias/assunto`;

const { data } = await useAsyncData('tag-hub', () => useApi()<TermPage[]>('/content/tags'));
const terms = computed(() => data.value ?? []);

useSeoMeta({
  title: 'Assuntos — Notícias | Cravei',
  description: 'Navegue as notícias do Cravei por assunto: times, jogadores e competições.',
  ogTitle: 'Assuntos — Notícias',
  ogUrl: url,
  ogType: 'website',
});
useHead({ link: [{ rel: 'canonical', href: url }] });
</script>

<template>
  <div class="hub">
    <nav class="crumbs">
      <NuxtLink to="/futebol/noticias">Notícias</NuxtLink>
      <span>›</span><span>Assuntos</span>
    </nav>
    <header class="hub-hero">
      <h1>Assuntos</h1>
      <p>Times, jogadores e competições em pauta.</p>
    </header>

    <ul v-if="terms.length" class="term-list">
      <li v-for="t in terms" :key="t.slug">
        <NuxtLink :to="`/futebol/noticias/assunto/${t.slug}`" class="term-chip">
          <span class="tc-name">{{ t.name }}</span>
          <span class="tc-count">{{ t.total }}</span>
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="hub-empty"><p>Nenhum assunto com matéria publicada ainda.</p></div>
  </div>
</template>

<style scoped>
.hub { max-width: 760px; margin: 0 auto; padding: 8px 0 32px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 16px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.hub-hero { margin-bottom: 20px; }
.hub-hero h1 { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 4px; }
.hub-hero p { color: var(--muted); font-size: 14.5px; margin: 0; }
.term-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.term-chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border: 1px solid var(--border); border-radius: 24px; background: var(--bg-surface); text-decoration: none; color: var(--text); transition: border-color 0.15s, color 0.15s; }
.term-chip:hover { border-color: var(--azure); color: var(--azure); }
.tc-name { font-weight: 700; font-size: 14px; }
.tc-count { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-base); border-radius: 20px; padding: 1px 8px; }
.hub-empty { padding: 50px 20px; text-align: center; color: var(--muted); }
</style>
