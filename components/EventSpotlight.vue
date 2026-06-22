<script setup lang="ts">
import type { Match, Paginated } from '~/types/api';

// Destaque do evento ao vivo (hoje = Copa do Mundo 2026) — ímã de tráfego orgânico.
// Genérico: recebe a season ONGOING e foregrounda jogos do dia/ao vivo + atalhos
// de alto valor (hoje, grupos, tabela, seleções, bolão). A home só mostra quando
// há season ONGOING, então o destaque migra sozinho de evento.
const props = defineProps<{
  season: {
    id: string;
    name: string;
    slug?: string | null;
    status?: string;
    competition?: { name: string; urlSlug?: string | null } | null;
  };
}>();

const cleanName = computed(() => props.season.name.replace(/\bFIFA\b/gi, '').replace(/\s+/g, ' ').trim());
// Hub do campeonato pela COMPETIÇÃO (urlSlug persistido ou derivado do nome).
const hubBase = computed(() => competitionHref(props.season.competition) ?? '/futebol/campeonato');

// Jogos da edição — pega os mais relevantes (ao vivo + próximos) pra mostrar até 10.
const { data } = await useAsyncData(`spotlight-${props.season.id}`, () =>
  useApi()<Paginated<Match>>(`/matches?seasonId=${props.season.id}&page=1&pageSize=100`)
    .then((r) => r.data)
    .catch(() => [] as Match[]),
);
const now = useNow();
const featured = computed<Match[]>(() => {
  const all = data.value ?? [];
  const live = all.filter((m) => m.status === 'LIVE');
  const upcoming = all
    .filter((m) => m.status === 'SCHEDULED' && new Date(m.kickoffAt).getTime() >= now.value - 2 * 3600_000)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  return [...live, ...upcoming].slice(0, 10);
});

// Tile-líder: mesmo formato quadrado, fundo preto + logo da Copa, abre o hub.
const lead = computed(() => ({
  to: hubBase.value,
  image: 'https://cdn.cravei.app/competitions/fifa.world/logo-dark.png',
  alt: cleanName.value,
}));
</script>

<template>
  <section class="spot">
    <MatchSquareRow :matches="featured" :lead="lead" />
  </section>
</template>
