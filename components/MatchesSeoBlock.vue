<script setup lang="ts">
// Bloco de conteúdo SEO/GEO reutilizável, exibido DEPOIS da lista de jogos:
// "onde assistir" + FAQ (respostas diretas) + JSON-LD (ItemList de SportsEvent +
// FAQPage). Parametrizado por escopo — serve "jogos de hoje" e os jogos de cada
// competição (basta passar matches + scope). Tudo derivado dos dados (SSR), nada
// inventado; degrada sozinho quando não há jogos.
import type { Match } from '~/types/api';

const props = defineProps<{
  matches: Match[];
  scope: 'today' | 'competition';
  label?: string; // nome da competição (scope=competition)
  canonical: string;
}>();

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const isToday = computed(() => props.scope === 'today');
const subject = computed(() => (isToday.value ? 'os jogos de hoje' : `os jogos de ${props.label ?? 'futebol'}`));

const list = computed(() => props.matches ?? []);
const count = computed(() => list.value.length);
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
const tname = (m: Match, side: 'home' | 'away') =>
  (side === 'home' ? m.homeTeam?.name ?? m.homeSourceLabel : m.awayTeam?.name ?? m.awaySourceLabel) ?? 'A definir';

const byTime = computed(() => [...list.value].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)));
const firstTime = computed(() => (byTime.value[0] ? hhmm(byTime.value[0].kickoffAt) : ''));
const lastTime = computed(() => (byTime.value.length ? hhmm(byTime.value[byTime.value.length - 1].kickoffAt) : ''));

const broadcasters = computed(() => {
  const m = new Map<string, string | undefined>();
  for (const mt of list.value) for (const b of mt.season?.broadcasters ?? []) if (b?.name && !m.has(b.name)) m.set(b.name, b.url ?? undefined);
  return [...m].map(([name, url]) => ({ name, url }));
});
const bcNames = computed(() => broadcasters.value.map((b) => b.name).join(', '));

const faq = computed(() => {
  if (!count.value) return [] as { q: string; a: string }[];
  if (isToday.value)
    return [
      { q: 'Quantos jogos tem hoje?', a: `Hoje tem ${count.value} ${count.value === 1 ? 'jogo' : 'jogos'} de futebol${bcNames.value ? `, com transmissão de ${bcNames.value}` : ''}.` },
      { q: 'Que horas começam os jogos de hoje?', a: `O primeiro jogo de hoje começa às ${firstTime.value} (horário de Brasília)${lastTime.value && lastTime.value !== firstTime.value ? ` e o último às ${lastTime.value}` : ''}.` },
      { q: 'Onde assistir os jogos de hoje ao vivo?', a: bcNames.value ? `Você acompanha pelos canais ${bcNames.value} — e o placar ao vivo de todos os jogos aqui no Cravei.` : 'Acompanhe o placar ao vivo de todos os jogos aqui no Cravei.' },
      { q: 'Como palpitar nos jogos de hoje?', a: 'Crie sua conta grátis, crave o placar de cada partida antes do apito inicial e dispute o ranking do bolão com os amigos.' },
    ];
  return [
    { q: `Quantos jogos tem ${props.label}?`, a: `${props.label} tem ${count.value} ${count.value === 1 ? 'jogo' : 'jogos'} no calendário — veja a lista com data e horário de Brasília acima.` },
    { q: `Onde assistir ${props.label} ao vivo?`, a: bcNames.value ? `Transmissão por ${bcNames.value}. O placar ao vivo de todos os jogos fica aqui no Cravei.` : `Acompanhe o placar ao vivo de todos os jogos de ${props.label} aqui no Cravei.` },
    { q: `Como palpitar nos jogos de ${props.label}?`, a: 'Crie sua conta grátis, crave os placares antes de cada partida e dispute o ranking do bolão.' },
  ];
});

useHead(() => {
  if (!count.value) return {};
  const events = byTime.value.slice(0, 12).map((m) => ({
    '@type': 'SportsEvent',
    name: `${tname(m, 'home')} x ${tname(m, 'away')}`,
    startDate: m.kickoffAt,
    ...(m.slug ? { url: `${siteUrl}/futebol/jogo/${m.slug}` } : {}),
  }));
  return {
    script: [
      {
        key: 'ld-matches-seo',
        type: 'application/ld+json',
        innerHTML: JSON.stringify([
          { '@context': 'https://schema.org', '@type': 'ItemList', url: props.canonical, numberOfItems: count.value, itemListElement: events.map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: e })) },
          { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.value.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ]),
      },
    ],
  };
});
</script>

<template>
  <section v-if="count" class="mseo">
    <!-- Onde assistir -->
    <h2 class="mseo-h">Onde assistir {{ subject }}</h2>
    <p class="mseo-p">
      <template v-if="broadcasters.length">
        {{ isToday ? `Os jogos de hoje têm` : `${label} tem` }} transmissão de
        <b>{{ bcNames }}</b>. Aqui no Cravei você acompanha o <b>placar ao vivo</b> de todas as partidas e crava seu palpite em cada uma.
      </template>
      <template v-else>
        Acompanhe o <b>placar ao vivo</b> de {{ subject }} aqui no Cravei e crave seu palpite em cada partida.
      </template>
    </p>
    <ul v-if="broadcasters.length" class="mseo-bc">
      <li v-for="b in broadcasters" :key="b.name">
        <a v-if="b.url" :href="b.url" target="_blank" rel="noopener nofollow">{{ b.name }}</a>
        <span v-else>{{ b.name }}</span>
      </li>
    </ul>

    <!-- FAQ (GEO) -->
    <h2 class="mseo-h">Perguntas frequentes</h2>
    <details v-for="(f, i) in faq" :key="i" class="mseo-faq" :open="i === 0">
      <summary>{{ f.q }}</summary>
      <p>{{ f.a }}</p>
    </details>
  </section>
</template>

<style scoped>
.mseo { margin-top: 28px; }
.mseo-h { font-family: 'Oswald', sans-serif; font-size: var(--fs-xl); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin: 24px 0 12px; }
.mseo-p { font-size: var(--fs-base); line-height: 1.6; color: var(--text); margin: 0 0 12px; max-width: 70ch; }
.mseo-p b { font-weight: 800; }
.mseo-bc { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.mseo-bc li a, .mseo-bc li span { display: inline-block; font-size: var(--fs-sm); font-weight: 700; color: var(--azure); border: 1px solid var(--border); border-radius: 999px; padding: 6px 13px; text-decoration: none; }
.mseo-bc li a:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
.mseo-faq { border: 1px solid var(--border); border-radius: 14px; padding: 4px 16px; margin-bottom: 8px; background: var(--bg-surface); }
.mseo-faq summary { cursor: pointer; padding: 12px 0; font-size: var(--fs-base); font-weight: 700; list-style: none; }
.mseo-faq summary::-webkit-details-marker { display: none; }
.mseo-faq p { margin: 0 0 14px; font-size: var(--fs-sm); line-height: 1.6; color: var(--muted); }
</style>
