<script setup lang="ts">
import type { TermPage } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/noticias/assunto`;

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
    <PageHero
      pillar="Notícias"
      title="Assuntos"
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Notícias', to: '/noticias' }, { name: 'Assuntos' }]"
    />

    <ul v-if="terms.length" class="term-list">
      <li v-for="t in terms" :key="t.slug">
        <NuxtLink :to="`/noticias/assunto/${t.slug}`" class="term-chip">
          <span class="tc-hash">#</span>
          <span class="tc-name">{{ t.name }}</span>
          <span class="tc-count">{{ t.total }}</span>
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="hub-empty">
      <AppIcon name="ball" :size="30" :stroke="1.6" />
      <p>Nenhum assunto com matéria publicada ainda.</p>
    </div>
  </div>
</template>

<style scoped>
.hub { width: 100%; padding: 8px 16px 40px; }

.term-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.term-chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px;
  border: 1px solid var(--border); border-radius: 24px; background: var(--bg-surface);
  text-decoration: none; color: var(--text); transition: border-color 0.15s, color 0.15s;
}
.term-chip:hover { border-color: var(--azure); color: var(--azure); }
.tc-hash { font-weight: 800; color: var(--azure); opacity: 0.7; }
.tc-name { font-weight: 700; font-size: var(--fs-sm); }
.tc-count { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); background: var(--bg-base); border-radius: 20px; padding: 1px 8px; }

.hub-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 56px 20px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 16px; }
.hub-empty p { font-size: var(--fs-sm); margin: 0; }
</style>
