<script setup lang="ts">
import type { NewsCard } from '~/types/api';

const props = defineProps<{ items: NewsCard[]; featured?: boolean }>();

// Com `featured`, a 1ª matéria (mais recente) vira um card-destaque largo; o resto
// segue na grade. Sem imagens no pipeline, o destaque é tipográfico.
const hero = computed(() => (props.featured && props.items.length ? props.items[0] : null));
const rest = computed(() => (hero.value ? props.items.slice(1) : props.items));

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}
</script>

<template>
  <div class="news-list">
    <!-- Destaque (matéria mais recente) -->
    <NuxtLink v-if="hero" :to="`/noticias/${hero.slug}`" class="ncard hero">
      <div class="hero-body">
        <div class="ntop">
          <span v-if="hero.category" class="ncat">{{ hero.category.name }}</span>
          <span class="nbadge">Destaque</span>
        </div>
        <h2 class="ntitle">{{ hero.title }}</h2>
        <p v-if="hero.dek" class="ndek">{{ hero.dek }}</p>
        <div class="nfoot">
          <div class="nmeta">
            <time :datetime="hero.publishedAt">{{ fmtDate(hero.publishedAt) }}</time>
            <span v-if="hero.source" class="nsrc">· {{ hero.source }}</span>
          </div>
          <span v-if="hero.tags.length" class="ntags">
            <span v-for="t in hero.tags.slice(0, 4)" :key="t.slug" class="ntag">{{ t.name }}</span>
          </span>
        </div>
      </div>
    </NuxtLink>

    <!-- Grade -->
    <div v-if="rest.length" class="news-grid">
      <NuxtLink v-for="n in rest" :key="n.slug" :to="`/noticias/${n.slug}`" class="ncard">
        <span v-if="n.category" class="ncat">{{ n.category.name }}</span>
        <h2 class="ntitle">{{ n.title }}</h2>
        <p v-if="n.dek" class="ndek">{{ n.dek }}</p>
        <div class="nfoot">
          <div class="nmeta">
            <time :datetime="n.publishedAt">{{ fmtDate(n.publishedAt) }}</time>
            <span v-if="n.source" class="nsrc">· {{ n.source }}</span>
          </div>
          <span v-if="n.tags.length" class="ntags">
            <span v-for="t in n.tags.slice(0, 2)" :key="t.slug" class="ntag">{{ t.name }}</span>
          </span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.news-list { display: flex; flex-direction: column; gap: 16px; }
.news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; }

.ncard {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-surface);
  text-decoration: none;
  color: var(--text);
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
/* faixa de acento que cresce no hover */
.ncard::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--azure);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.18s ease;
}
.ncard:hover { border-color: var(--azure); transform: translateY(-2px); box-shadow: var(--shadow); }
.ncard:hover::before { transform: scaleY(1); }

.ncat {
  align-self: flex-start;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--azure);
}
.ntop { display: flex; align-items: center; gap: 10px; }
.nbadge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 20px;
  padding: 1px 8px;
}
.ntitle { font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 700; line-height: 1.25; margin: 0; }
.ndek {
  font-size: 13.5px; line-height: 1.55; color: var(--muted); margin: 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.nfoot { margin-top: auto; padding-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.nmeta { font-size: 12px; color: var(--muted); display: flex; gap: 5px; }
.nsrc { opacity: 0.8; }
.ntags { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.ntag {
  font-size: 11px; font-weight: 600; color: var(--muted);
  background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 1px 9px;
}

/* Destaque */
.ncard.hero { padding: 26px 28px; background: var(--bg-elevated, var(--bg-surface)); }
.ncard.hero .ntitle { font-size: clamp(24px, 4vw, 32px); line-height: 1.16; letter-spacing: -0.01em; }
.ncard.hero .ndek { font-size: 15.5px; -webkit-line-clamp: 4; max-width: 68ch; }
.ncard.hero::before { width: 4px; transform: scaleY(1); opacity: 0.85; }
.ncard.hero:hover::before { opacity: 1; }

@media (max-width: 600px) {
  .ncard { padding: 16px 17px; }
  .ncard.hero { padding: 20px; }
}
</style>
