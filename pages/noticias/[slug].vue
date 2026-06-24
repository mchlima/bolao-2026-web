<script setup lang="ts">
import type { PublicNewsArticle, TermRef } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);

const { data: article, error } = await useAsyncData(`news-${slug}`, () =>
  useApi()<PublicNewsArticle>(`/content/news/${slug}`),
);
if (error.value || !article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Matéria não encontrada', fatal: true });
}

const a = article.value;
const url = `${siteUrl}/noticias/${slug}`;
// Se a capa falhar ao carregar (404/objeto removido do R2), some com a figure em
// vez de mostrar alt-text/ícone quebrado.
const coverFailed = ref(false);
const paragraphs = computed(() => a.body.split(/\n+/).map((s) => s.trim()).filter(Boolean));
const readingMins = computed(() => Math.max(1, Math.round(a.body.split(/\s+/).filter(Boolean).length / 200)));
// Caminho completo da categoria (Futebol > Copa do Mundo > 2026); fallback p/ a folha em itens antigos.
const catPath = computed<TermRef[]>(() => (a.categoryPath?.length ? a.categoryPath : a.category ? [a.category] : []));
// Trilha no padrão das demais páginas (Início › Notícias › … categoria › título).
const crumbs = computed(() => [
  { name: 'Início', to: '/' },
  { name: 'Notícias', to: '/noticias' },
  ...catPath.value.map((c) => ({ name: c.name, to: `/noticias/categoria/${c.slug}` })),
  { name: a.title },
]);

const ui = useUiStore();
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}
/** Compartilha via Web Share (mobile) ou copia o link (desktop). */
async function share() {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: a.title, text: a.dek || a.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    ui.toast('success', 'Link copiado!');
  } catch { /* usuário cancelou */ }
}

useSeoMeta({
  title: a.metaTitle || a.title,
  description: a.metaDescription || a.dek,
  keywords: [a.focusKeyword, ...a.keywords].filter(Boolean).join(', '),
  ogTitle: a.metaTitle || a.title,
  ogDescription: a.metaDescription || a.dek,
  ogUrl: url,
  ogType: 'article',
  // Sem imagem programática: só compartilha capa quando há uma definida manualmente
  // (coverUrl). null sobrescreve o fallback global /og-cover.png do app.vue.
  ogImage: a.coverUrl || null,
  twitterImage: a.coverUrl || null,
  articlePublishedTime: a.publishedAt,
  articleModifiedTime: a.updatedAt,
  articleSection: a.category?.name || undefined,
  twitterCard: 'summary_large_image',
  twitterTitle: a.metaTitle || a.title,
  twitterDescription: a.metaDescription || a.dek,
});

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-article',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'NewsArticle',
            headline: a.title,
            description: a.metaDescription || a.dek,
            articleBody: a.body,
            datePublished: a.publishedAt,
            dateModified: a.updatedAt,
            articleSection: a.category?.name || undefined,
            keywords: [a.focusKeyword, ...a.keywords].filter(Boolean),
            inLanguage: 'pt-BR',
            mainEntityOfPage: { '@type': 'WebPage', '@id': url },
            url,
            author: { '@type': 'Organization', name: 'Cravei', url: siteUrl },
            publisher: { '@type': 'Organization', name: 'Cravei', url: siteUrl },
          },
          ...(a.faq.length
            ? [
                {
                  '@type': 'FAQPage',
                  mainEntity: a.faq.map((q) => ({
                    '@type': 'Question',
                    name: q.question,
                    acceptedAnswer: { '@type': 'Answer', text: q.answer },
                  })),
                },
              ]
            : []),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Notícias', item: `${siteUrl}/noticias` },
              ...catPath.value.map((c, i) => ({
                '@type': 'ListItem',
                position: 3 + i,
                name: c.name,
                item: `${siteUrl}/noticias/categoria/${c.slug}`,
              })),
              { '@type': 'ListItem', position: 3 + catPath.value.length, name: a.title, item: url },
            ],
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <article v-if="a" class="art">
    <PageHero pillar="Notícias" :title="a.title" :crumbs="crumbs" />

    <p v-if="a.dek" class="art-dek">{{ a.dek }}</p>
    <div class="art-meta">
      <time :datetime="a.publishedAt">{{ fmtDate(a.publishedAt) }}</time>
      <span v-if="a.source">· {{ a.source }}</span>
      <span>· {{ readingMins }} min de leitura</span>
      <button class="share-btn" type="button" @click="share">
        <AppIcon name="share" :size="14" :stroke="2" /> Compartilhar
      </button>
    </div>

    <figure v-if="a.coverUrl && !coverFailed" class="art-cover">
      <img :src="a.coverUrl" :alt="a.imageAlt || a.title" @error="coverFailed = true" />
    </figure>

    <div class="art-body">
      <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
    </div>

    <section v-if="a.faq.length" class="art-faq">
      <h2>Perguntas frequentes</h2>
      <div v-for="(q, i) in a.faq" :key="i" class="faq-item">
        <h3>{{ q.question }}</h3>
        <p>{{ q.answer }}</p>
      </div>
    </section>

    <div v-if="a.tags.length" class="art-tags">
      <NuxtLink v-for="t in a.tags" :key="t.slug" :to="`/noticias/assunto/${t.slug}`" class="tag">{{ t.name }}</NuxtLink>
    </div>

    <BolaoCtaBand class="art-cta-band" variant="inline" />
  </article>
</template>

<style scoped>
/* Container 100% do espaço; o HEADER (título, dek, meta) usa largura total. Só a
   coluna de LEITURA (corpo + FAQ) fica estreita p/ legibilidade. Seções separadas. */
.art { width: 100%; padding: 8px 16px 48px; }
.art-dek { font-size: var(--fs-lg); line-height: 1.5; color: var(--text); opacity: 0.9; margin: 0 0 14px; }
.art-meta { font-size: var(--fs-sm); color: var(--muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-bottom: 18px; border-bottom: 1px solid var(--border); margin-bottom: 28px; }
.share-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 700; color: var(--azure); background: none; border: 1px solid var(--border); border-radius: 20px; padding: 5px 12px; cursor: pointer; transition: border-color 0.15s, background-color 0.15s; }
.share-btn:hover { border-color: var(--azure); background: color-mix(in srgb, var(--azure) 10%, transparent); }
.art-cover { margin: 0 auto 28px; max-width: 860px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 16px; background: var(--bg-base); }
.art-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.art-body { font-size: var(--fs-lg); line-height: 1.8; color: var(--text); max-width: 760px; margin: 0 auto; }
.art-body p { margin: 0 0 18px; }
.art-faq { margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--border); max-width: 760px; }
.art-faq h2 { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xl); font-weight: 700; margin: 0 0 18px; }
.faq-item { margin-bottom: 18px; }
.faq-item h3 { font-size: var(--fs-base); font-weight: 700; margin: 0 0 5px; }
.faq-item p { font-size: var(--fs-base); line-height: 1.6; color: var(--muted); margin: 0; }
.art-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--border); }
.tag { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; text-decoration: none; transition: border-color 0.15s, color 0.15s; }
.tag:hover { color: var(--azure); border-color: var(--azure); }
.art-cta-band { margin-top: 40px; }
@media (max-width: 600px) { .art-body { font-size: var(--fs-base); } }
</style>
