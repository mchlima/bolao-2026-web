<script setup lang="ts">
import type { Match, Paginated } from '~/types/api';

// Destaque do evento ao vivo (hoje = Copa do Mundo 2026) — ímã de tráfego orgânico.
// Genérico: recebe a season ONGOING e foregrounda jogos do dia/ao vivo + atalhos
// de alto valor (hoje, grupos, tabela, seleções, bolão). A home só mostra quando
// há season ONGOING, então o destaque migra sozinho de evento.
const props = defineProps<{
  season: { id: string; name: string; slug?: string | null; status?: string };
}>();

const cleanName = computed(() => props.season.name.replace(/\bFIFA\b/gi, '').replace(/\s+/g, ' ').trim());
const slug = computed(() => props.season.slug ?? props.season.id);

// Jogos da edição — pega os mais relevantes (ao vivo + próximos) pra mostrar 4.
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
  return [...live, ...upcoming].slice(0, 4);
});

const links = computed(() => [
  { label: 'Jogos de hoje', to: '/futebol/jogos-de-hoje' },
  { label: 'Grupos', to: `/futebol/torneios/${slug.value}/grupos` },
  { label: 'Tabela', to: `/futebol/torneios/${slug.value}/classificacao` },
  { label: 'Seleções', to: '/futebol/selecoes' },
  { label: 'Bolão da Copa', to: '/bolao-da-copa-do-mundo-2026' },
]);
</script>

<template>
  <section class="spot">
    <div class="spot-head">
      <span class="spot-eyebrow"><span class="d" />Acontecendo agora</span>
      <NuxtLink to="/copa-do-mundo-2026" class="spot-title font-display">{{ cleanName }}</NuxtLink>
      <p class="spot-lead">Jogos de hoje, grupos, tabela e onde assistir — e crave seus palpites no bolão.</p>
      <nav class="spot-links">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="spot-chip">{{ l.label }}</NuxtLink>
      </nav>
    </div>

    <div v-if="featured.length" class="spot-games">
      <MatchCard :matches="featured" />
    </div>
  </section>
</template>

<style scoped>
.spot {
  border: 1px solid color-mix(in srgb, var(--emerald) 26%, var(--border));
  border-radius: 20px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 9%, var(--bg-surface)), color-mix(in srgb, var(--azure) 7%, var(--bg-surface)) 75%);
  padding: clamp(18px, 3.5vw, 26px);
}
.spot-head { margin-bottom: 14px; }
.spot-eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--scarlet);
}
.spot-eyebrow .d { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }
.spot-title {
  display: block; margin: 8px 0 4px;
  font-weight: 700; font-size: clamp(24px, 5vw, 38px); line-height: 1.02;
  text-transform: uppercase; color: var(--text); text-decoration: none;
}
.spot-title:hover { color: var(--emerald); }
.spot-lead { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0 0 14px; max-width: 60ch; }
.spot-links { display: flex; flex-wrap: wrap; gap: 8px; }
.spot-chip {
  font-size: 13px; font-weight: 700; color: var(--text);
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 999px;
  padding: 7px 14px; text-decoration: none;
  transition: border-color 0.14s, color 0.14s;
}
.spot-chip:hover { border-color: var(--emerald); color: var(--emerald); }
.spot-games { margin-top: 4px; }
</style>
