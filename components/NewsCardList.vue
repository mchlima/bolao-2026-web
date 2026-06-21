<script setup lang="ts">
import type { NewsCard } from '~/types/api';

defineProps<{ items: NewsCard[] }>();

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}
</script>

<template>
  <div class="news-grid">
    <NuxtLink v-for="n in items" :key="n.slug" :to="`/noticias/${n.slug}`" class="ncard">
      <span v-if="n.category" class="ncat">{{ n.category.name }}</span>
      <h2 class="ntitle">{{ n.title }}</h2>
      <p v-if="n.dek" class="ndek">{{ n.dek }}</p>
      <div class="nmeta">
        <time :datetime="n.publishedAt">{{ fmtDate(n.publishedAt) }}</time>
        <span v-if="n.source" class="nsrc">· {{ n.source }}</span>
      </div>
    </NuxtLink>
  </div>
</template>

<style scoped>
.news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.ncard { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-surface); text-decoration: none; color: var(--text); transition: border-color 0.15s, transform 0.15s; }
.ncard:hover { border-color: var(--azure); transform: translateY(-2px); }
.ncat { align-self: flex-start; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.ntitle { font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 700; line-height: 1.25; margin: 0; }
.ndek { font-size: 13.5px; line-height: 1.5; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nmeta { margin-top: auto; font-size: 12px; color: var(--muted); display: flex; gap: 5px; }
.nsrc { opacity: 0.8; }
</style>
