<script setup lang="ts">
// HUB de CAMPEONATOS: vitrine da seção. Destaque do campeonato em andamento (com
// CTAs pra jogos/tabela/bolão) + grade agrupada por status + faixa de bolão. Itera
// competições (estáveis) e linka pelo slug público → /futebol/campeonato/:urlSlug.
import type { Competition, Paginated } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const seoTitle = 'Campeonatos para acompanhar e palpitar — Cravei';
const seoDesc =
  'Os campeonatos no Cravei, da Copa do Mundo 2026 ao Brasileirão: jogos, tabela de classificação e o bolão de cada um. Acompanhe ao vivo e palpite.';
useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: `${siteUrl}/futebol/campeonato`,
  twitterTitle: seoTitle,
  twitterDescription: seoDesc,
});

const { data, pending } = await useAsyncData('campeonatos', async () => {
  const list = await useApi()<Paginated<Competition>>('/competitions?pageSize=100');
  const rank = (c: Competition) =>
    c.activeSeason?.status === 'ONGOING' ? 0 : c.activeSeason?.status === 'UPCOMING' ? 1 : 2;
  return (list.data ?? [])
    .filter((c) => c.activeSeason?.slug && c.urlSlug)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR'));
});

const hub = (c: Competition) => competitionHref(c) ?? '/futebol/campeonato';

// DESTAQUE na Copa do Mundo (o evento ao vivo do momento) — mesmo componente da home
// (EventSpotlight). Monta a season a partir da competição vigente da Copa.
const copa = computed(() => (data.value ?? []).find((c) => /copa do mundo/i.test(c.name)) ?? null);
const spotlightSeason = computed(() => {
  const c = copa.value;
  const s = c?.activeSeason;
  if (!c || !s) return null;
  return { id: s.id, name: s.name, slug: s.slug, status: s.status, competition: { name: c.name, urlSlug: c.urlSlug } };
});
</script>

<template>
  <div class="page">
    <PageHero
      pillar="Futebol"
      title="Campeonatos"
      icon="trophy"
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Futebol', to: '/futebol' }, { name: 'Campeonatos' }]"
    />

    <SkeletonList v-if="pending && !data" variant="card" :count="3" />
    <EmptyState
      v-else-if="!data?.length"
      icon="calendar"
      title="Nenhum campeonato disponível"
      description="Ainda não há campeonatos por aqui. Volte em breve!"
    />

    <template v-else>
      <!-- DESTAQUE na Copa do Mundo — mesmo componente da home -->
      <section v-if="spotlightSeason" class="spot-sec">
        <EventSpotlight :season="spotlightSeason" />
      </section>

      <!-- CTA bolão (acima da lista) -->
      <BolaoCtaBand class="cta" />

      <!-- LISTA de campeonatos -->
      <div class="grid">
        <article v-for="c in (data ?? [])" :key="c.id" class="cc">
          <NuxtLink :to="hub(c)" class="cc-head">
            <span class="cc-logo">
              <TournamentBadge :name="c.name" :logo-url="c.logoUrl" :logo-url-dark="c.logoUrlDark" :size="40" />
            </span>
            <span class="cc-name font-display">{{ c.name }}</span>
            <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="cc-go" />
          </NuxtLink>
          <div class="cc-links">
            <NuxtLink :to="`${hub(c)}/jogos`">Jogos</NuxtLink>
            <NuxtLink :to="`${hub(c)}/tabela`">Tabela</NuxtLink>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 10px;
}

/* Destaque (Copa) — fileira de cards quadrados (EventSpotlight) */
.spot-sec {
  margin-bottom: 28px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 13px;
}
.cc {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.cc:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--emerald) 45%, var(--border));
  box-shadow: var(--shadow);
}
.cc-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 15px 13px;
  text-decoration: none;
  color: inherit;
}
.cc-logo {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 11px;
  background: var(--bg-base);
  border: 1px solid var(--border);
}
.cc-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 16px;
  line-height: 1.15;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-go {
  flex: none;
  color: var(--muted);
}
.cc-links {
  display: flex;
  border-top: 1px solid var(--border);
}
.cc-links a {
  flex: 1;
  text-align: center;
  padding: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--azure);
  text-decoration: none;
  transition: background 0.13s;
}
.cc-links a:hover {
  background: color-mix(in srgb, var(--azure) 8%, transparent);
}
.cc-links a + a {
  border-left: 1px solid var(--border);
}

.cta {
  margin: 4px 0 24px;
}
</style>
