<script setup lang="ts">
import type { Match, StageStandings, Tournament } from '~/types/api';

// Hub de SEO "grupos do torneio": fase de grupos com a tabela de cada grupo + os
// jogos daquele grupo. Difere da aba Tabela (classificação completa, com chave) —
// foco na fase de grupos e nos confrontos, mirando "grupos da copa do mundo 2026",
// "grupo do brasil", "tabela grupo A". Renderiza dentro do shell do torneio.
const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/futebol/torneios/${slug}/grupos`;

// seasonId real (p/ a API) sai da lista que o shell já carregou; links usam slug.
const { data: seoTournaments } = useNuxtData<Tournament[]>('tournaments-list');
const season = computed(() => seoTournaments.value?.find((t) => t.slug === slug) ?? null);
const id = season.value?.id ?? '';
const seoName = computed(() => season.value?.name ?? null);
// Nome sem "FIFA" no público (marca-segura), igual à página de jogo.
const cleanName = computed(() => (seoName.value ?? '').replace(/\bFIFA\b/gi, '').replace(/\s{2,}/g, ' ').trim());

const { data, pending, error, refresh } = await useAsyncData(`grupos-${id}`, async () => {
  const api = useApi();
  const [standings, matches] = await Promise.all([
    api<StageStandings[]>(`/seasons/${id}/standings`),
    fetchAllMatches(api, id),
  ]);
  return { standings, matches };
});
useRealtime(() => [`tournament:${id}`], () => refresh());

// Só os estágios em formato de grupos; cada grupo recebe os seus jogos (por
// groupName) em ordem cronológica.
const groups = computed(() => {
  const d = data.value;
  if (!d) return [] as { id: string; name: string; rows: StageStandings['groups'][number]['rows']; matches: Match[] }[];
  const byGroup = (gn: string) =>
    d.matches
      .filter((m) => m.groupName === gn)
      .sort((a, b) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt));
  return d.standings
    .filter((s) => s.format === 'GROUP')
    .flatMap((s) => s.groups)
    .filter((g) => g.rows.length)
    .map((g) => ({ id: g.groupId, name: g.groupName, rows: g.rows, matches: byGroup(g.groupName) }));
});
// Rótulo legível do grupo: "A" → "Grupo A"; nomes já descritivos passam direto.
function groupLabel(name: string): string {
  return /^[A-Za-z0-9]{1,3}$/.test(name) ? `Grupo ${name.toUpperCase()}` : name;
}

const seoTitle = computed(() =>
  cleanName.value ? `Grupos da ${cleanName.value}: tabelas e jogos — Cravei` : 'Grupos do torneio — Cravei',
);
const seoDesc = computed(() =>
  cleanName.value
    ? `Os grupos da ${cleanName.value}: a tabela de classificação de cada grupo e todos os jogos, com horários, placar ao vivo e palpite no Cravei.`
    : 'Grupos do torneio: tabelas e jogos de cada grupo.',
);
useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDesc.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDesc.value,
  ogUrl: url,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDesc.value,
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  // Sobrescreve o breadcrumb do shell (key 'ld-graph') acrescentando "Grupos".
  script: [
    {
      key: 'ld-graph',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Torneios', item: `${siteUrl}/futebol/torneios` },
            ...(cleanName.value
              ? [{ '@type': 'ListItem', position: 3, name: cleanName.value, item: `${siteUrl}/futebol/torneios/${slug}` }]
              : []),
            { '@type': 'ListItem', position: cleanName.value ? 4 : 3, name: 'Grupos', item: url },
          ],
        }),
    },
  ],
});
</script>

<template>
  <div class="grp">
    <SkeletonList v-if="pending && !data" variant="row" :count="6" />
    <p v-else-if="error || !groups.length" class="muted load">
      Este torneio não tem fase de grupos.
      <NuxtLink :to="`/futebol/torneios/${slug}/classificacao`">Ver a classificação</NuxtLink>.
    </p>
    <template v-else>
      <header class="grp-head">
        <h1 class="font-display">Grupos da {{ cleanName || 'competição' }}</h1>
        <p>
          A tabela de cada grupo e todos os confrontos da fase de grupos. Acompanhe a
          classificação ao vivo e <strong>palpite nos jogos</strong> pelo seu
          <NuxtLink to="/bolao-da-copa-do-mundo-2026">bolão da Copa do Mundo 2026</NuxtLink>.
        </p>
      </header>

      <section v-for="g in groups" :key="g.id" class="grp-block">
        <h2 class="font-display grp-title">{{ groupLabel(g.name) }}</h2>
        <StandingsTable :rows="g.rows" compact />
        <div v-if="g.matches.length" class="grp-games">
          <h3 class="grp-sub">Jogos do {{ groupLabel(g.name).toLowerCase() }}</h3>
          <MatchCard :matches="g.matches" />
        </div>
      </section>

      <nav class="grp-links">
        <NuxtLink :to="`/futebol/torneios/${slug}/classificacao`">Classificação completa</NuxtLink>
        <NuxtLink :to="`/futebol/torneios/${slug}`">Jogos do torneio</NuxtLink>
        <NuxtLink to="/futebol/jogos-de-hoje">Jogos de hoje</NuxtLink>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.grp { padding: 4px 0 8px; }
.load { padding: 2rem 0; }
.load a { color: var(--azure); font-weight: 600; }
.grp-head { margin-bottom: 22px; }
.grp-head h1 { font-weight: 700; font-size: clamp(22px, 4.5vw, 32px); text-transform: uppercase; letter-spacing: -0.01em; margin: 0 0 8px; }
.grp-head p { font-size: 15px; line-height: 1.6; color: var(--muted); max-width: 70ch; }
.grp-head a { color: var(--azure); text-decoration: none; font-weight: 600; }
.grp-head a:hover { text-decoration: underline; }
.grp-block { margin-bottom: 30px; }
.grp-title { font-weight: 700; font-size: 19px; text-transform: uppercase; margin: 0 0 12px; }
.grp-games { margin-top: 14px; }
.grp-sub { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 10px; }
.grp-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.grp-links a { font-size: 13px; font-weight: 700; color: var(--azure); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; text-decoration: none; transition: border-color 0.14s; }
.grp-links a:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
</style>
