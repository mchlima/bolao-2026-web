<script setup lang="ts">
import type { TermPage } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/noticias/categoria`;

const { data } = await useAsyncData('cat-hub', () => useApi()<TermPage[]>('/content/categories'));
const terms = computed(() => data.value ?? []);

useSeoMeta({
  title: 'Categorias — Notícias | Cravei',
  description: 'Navegue as notícias do Cravei por categoria: Copa do Mundo, Brasileirão, análises e mais.',
  ogTitle: 'Categorias — Notícias',
  ogUrl: url,
  ogType: 'website',
});
useHead({ link: [{ rel: 'canonical', href: url }] });
</script>

<template>
  <div class="hub">
    <nav class="crumbs">
      <NuxtLink to="/noticias">Notícias</NuxtLink>
      <span>›</span><span>Categorias</span>
    </nav>
    <header class="hub-hero">
      <h1>Categorias</h1>
      <p>Explore as notícias por seção.</p>
    </header>

    <NewsSectionNav />

    <ul v-if="terms.length" class="term-cards">
      <li v-for="t in terms" :key="t.slug">
        <NuxtLink :to="`/noticias/categoria/${t.slug}`" class="tcard">
          <div class="tc-main">
            <span class="tc-name">{{ t.name }}</span>
            <span v-if="t.description" class="tc-desc">{{ t.description }}</span>
            <span class="tc-count">{{ t.total }} {{ t.total === 1 ? 'matéria' : 'matérias' }}</span>
          </div>
          <AppIcon name="ball" :size="16" :stroke="1.8" class="tc-arrow" />
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="hub-empty">
      <AppIcon name="list" :size="30" :stroke="1.6" />
      <p>Nenhuma categoria com matéria publicada ainda.</p>
    </div>
  </div>
</template>

<style scoped>
.hub { width: 100%; padding: 8px 16px 40px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 14px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.hub-hero { margin-bottom: 18px; }
.hub-hero h1 { font-family: 'Oswald', sans-serif; font-size: clamp(26px, 5vw, 32px); font-weight: 700; letter-spacing: -0.01em; margin: 0 0 4px; }
.hub-hero p { color: var(--muted); font-size: 14.5px; margin: 0; }

.term-cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.tcard {
  display: flex; align-items: center; gap: 12px; justify-content: space-between;
  padding: 15px 17px; border: 1px solid var(--border); border-radius: 14px;
  background: var(--bg-surface); text-decoration: none; color: var(--text);
  transition: border-color 0.15s, transform 0.15s;
}
.tcard:hover { border-color: var(--azure); transform: translateY(-2px); }
.tc-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tc-name { font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 700; line-height: 1.2; }
.tc-desc { font-size: 12.5px; color: var(--muted); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tc-count { font-size: 11.5px; font-weight: 700; color: var(--azure); margin-top: 2px; }
.tc-arrow { flex-shrink: 0; color: var(--muted); transition: color 0.15s, transform 0.15s; }
.tcard:hover .tc-arrow { color: var(--azure); transform: translateX(2px); }

.hub-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 56px 20px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 16px; }
.hub-empty p { font-size: 14px; margin: 0; }
</style>
