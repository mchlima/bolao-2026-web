<script setup lang="ts">
import type { PublicNewsArticle } from '~/types/api';

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
const url = `${siteUrl}/futebol/noticias/${slug}`;
const paragraphs = computed(() => a.body.split(/\n+/).map((s) => s.trim()).filter(Boolean));

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

useSeoMeta({
  title: a.metaTitle || a.title,
  description: a.metaDescription || a.dek,
  keywords: [a.focusKeyword, ...a.keywords].filter(Boolean).join(', '),
  ogTitle: a.metaTitle || a.title,
  ogDescription: a.metaDescription || a.dek,
  ogUrl: url,
  ogType: 'article',
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
              { '@type': 'ListItem', position: 2, name: 'Notícias', item: `${siteUrl}/futebol/noticias` },
              { '@type': 'ListItem', position: 3, name: a.title, item: url },
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
    <nav class="crumbs">
      <NuxtLink to="/futebol/noticias">Notícias</NuxtLink>
      <span>›</span>
      <NuxtLink v-if="a.category" :to="`/futebol/noticias/categoria/${a.category.slug}`">{{ a.category.name }}</NuxtLink>
    </nav>

    <NuxtLink v-if="a.category" :to="`/futebol/noticias/categoria/${a.category.slug}`" class="art-cat">{{ a.category.name }}</NuxtLink>
    <h1 class="art-title">{{ a.title }}</h1>
    <p v-if="a.dek" class="art-dek">{{ a.dek }}</p>
    <div class="art-meta">
      <time :datetime="a.publishedAt">{{ fmtDate(a.publishedAt) }}</time>
      <span v-if="a.source">· {{ a.source }}</span>
    </div>

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
      <NuxtLink v-for="t in a.tags" :key="t.slug" :to="`/futebol/noticias/assunto/${t.slug}`" class="tag">{{ t.name }}</NuxtLink>
    </div>

    <aside class="art-cta">
      <p>Curtiu? No <strong>Cravei</strong> você palpita nos jogos e disputa o bolão com a galera.</p>
      <NuxtLink to="/" class="btn btn-primary">Entrar no bolão</NuxtLink>
    </aside>
  </article>
</template>

<style scoped>
.art { max-width: 680px; margin: 0 auto; padding: 8px 0 40px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 18px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.art-cat { display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); margin-bottom: 8px; text-decoration: none; }
.art-cat:hover { text-decoration: underline; }
.crumbs a:hover { text-decoration: underline; }
.art-title { font-family: 'Oswald', sans-serif; font-size: 34px; font-weight: 700; line-height: 1.18; letter-spacing: -0.01em; margin: 0 0 12px; }
.art-dek { font-size: 18px; line-height: 1.5; color: var(--text); opacity: 0.9; margin: 0 0 14px; }
.art-meta { font-size: 13px; color: var(--muted); display: flex; gap: 6px; padding-bottom: 18px; border-bottom: 1px solid var(--border); margin-bottom: 22px; }
.art-body { font-size: 17px; line-height: 1.8; color: var(--text); }
.art-body p { margin: 0 0 18px; }
.art-faq { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
.art-faq h2 { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; margin: 0 0 18px; }
.faq-item { margin-bottom: 18px; }
.faq-item h3 { font-size: 16px; font-weight: 700; margin: 0 0 5px; }
.faq-item p { font-size: 15px; line-height: 1.6; color: var(--muted); margin: 0; }
.art-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 30px; }
.tag { font-size: 12px; font-weight: 600; color: var(--muted); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; text-decoration: none; transition: border-color 0.15s, color 0.15s; }
.tag:hover { color: var(--azure); border-color: var(--azure); }
.art-cta { margin-top: 36px; padding: 22px 24px; border-radius: 14px; background: var(--bg-surface); border: 1px solid var(--border); text-align: center; }
.art-cta p { font-size: 15px; margin: 0 0 14px; }
@media (max-width: 600px) { .art-title { font-size: 27px; } .art-body { font-size: 16px; } }
</style>
