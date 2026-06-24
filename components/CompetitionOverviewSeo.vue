<script setup lang="ts">
// Bloco de overview SEO/GEO do HUB da competição (/futebol/campeonato/:slug).
// DISTINTO do MatchesSeoBlock (/jogos) pra não canibalizar as 2 URLs da mesma
// competição: aqui o assunto é o CAMPEONATO (formato, nº de times, líder atual,
// status, quando começa/termina), não a lista de jogos. Intro + FAQ derivados dos
// dados (SSR), nada inventado; FAQPage em JSON-LD. Degrada sozinho sem dados.
import type { ActiveSeason, Competition, Match, StageStandings } from '~/types/api';

const props = defineProps<{
  comp: (Competition & { activeSeason: ActiveSeason | null }) | null;
  season: ActiveSeason | null;
  standings: StageStandings[] | null;
  upcoming: Match[];
}>();

const name = computed(() => props.comp?.name ?? props.season?.name ?? 'o campeonato');
const seasonName = computed(() => props.season?.name ?? name.value);
const status = computed(() => props.season?.status ?? null);

// ── Gramática (concordância de gênero/número via Competition.article) ──
// article: 'o' | 'a' | 'os' | 'as' | '' (desconhecido → texto degrada pra forma neutra).
const article = computed(() => (props.comp?.article ?? '').toLowerCase());
const plural = computed(() => article.value === 'os' || article.value === 'as');
const fem = computed(() => article.value === 'a' || article.value === 'as');
const DE: Record<string, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const withArt = (n: string) => (article.value ? `${article.value} ${n}` : n); // "a Copa do Mundo"
const ofName = (n: string) => (article.value ? `${DE[article.value]} ${n}` : `de ${n}`); // "da Copa do Mundo"
// Particípio "disputad_" concorda em gênero/número; vazio quando artigo desconhecido.
const disputada = computed(() =>
  article.value ? (plural.value ? (fem.value ? 'disputadas' : 'disputados') : fem.value ? 'disputada' : 'disputado') : '',
);
const ser = computed(() => (plural.value ? 'são' : 'é'));
const verbStatus = computed(() => {
  switch (status.value) {
    case 'UPCOMING':
      return plural.value ? 'ainda não começaram' : 'ainda não começou';
    case 'FINISHED':
      return plural.value ? 'já terminaram' : 'já terminou'; // gênero-neutro de propósito
    case 'ONGOING':
      return plural.value ? 'estão em andamento' : 'está em andamento';
    default:
      return '';
  }
});

// Formato: se houver fase de GRUPO na classificação é mata-mata/grupos; senão é
// liga (pontos corridos). Cai pro type da competição quando não há tabela.
const hasGroups = computed(() => (props.standings ?? []).some((s) => s.format === 'GROUP' || s.groups.length > 1));
const allRows = computed(() => (props.standings ?? []).flatMap((s) => s.groups.flatMap((g) => g.rows)));
const teamCount = computed(() => new Set(allRows.value.map((r) => r.team.id)).size);
const formatLabel = computed(() => {
  if (hasGroups.value) return 'fase de grupos seguida de mata-mata';
  if (props.comp?.type === 'CUP') return 'mata-mata';
  return 'pontos corridos';
});

// Líder só faz sentido em liga de grupo único (ranking absoluto). Em grupos, não.
const leader = computed(() => {
  if (hasGroups.value) return null;
  const groups = (props.standings ?? []).flatMap((s) => s.groups);
  if (groups.length !== 1) return null;
  const top = [...groups[0].rows].sort((a, b) => a.position - b.position)[0];
  return top ? { name: top.team.name, points: top.points, played: top.played } : null;
});

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
const tname = (m: Match, side: 'home' | 'away') =>
  (side === 'home' ? m.homeTeam?.name ?? m.homeSourceLabel : m.awayTeam?.name ?? m.awaySourceLabel) ?? 'A definir';
const nextMatch = computed(() => props.upcoming?.[0] ?? null);
const nextMatchText = computed(() => {
  const m = nextMatch.value;
  if (!m) return '';
  return `${tname(m, 'home')} x ${tname(m, 'away')}, ${fmtDateTime(m.kickoffAt)} (horário de Brasília)`;
});

const broadcasters = computed(() => {
  const m = new Map<string, string | undefined>();
  for (const mt of props.upcoming ?? [])
    for (const b of mt.season?.broadcasters ?? []) if (b?.name && !m.has(b.name)) m.set(b.name, b.url ?? undefined);
  return [...m].map(([n, url]) => ({ name: n, url }));
});
const bcNames = computed(() => broadcasters.value.map((b) => b.name).join(', '));

// Sujeito da frase de abertura: "A Copa do Mundo 2026" / "O Brasileirão 2026".
const statusText = computed(() => {
  const subj = cap(withArt(seasonName.value));
  return verbStatus.value ? `${subj} ${verbStatus.value}` : subj;
});

// Parágrafo de intro montado a partir dos dados disponíveis.
const intro = computed(() => {
  const parts: string[] = [];
  let first = statusText.value;
  if (teamCount.value)
    first += disputada.value
      ? `, ${disputada.value} por ${teamCount.value} times no formato de ${formatLabel.value}`
      : `, com ${teamCount.value} times no formato de ${formatLabel.value}`;
  else first += `, no formato de ${formatLabel.value}`;
  parts.push(first + '.');
  if (leader.value && status.value === 'ONGOING')
    parts.push(`O líder atual é o ${leader.value.name}, com ${leader.value.points} pontos em ${leader.value.played} jogos.`);
  if (nextMatch.value && status.value !== 'FINISHED') parts.push(`O próximo jogo é ${nextMatchText.value}.`);
  parts.push(`Aqui no Cravei você acompanha a tabela, o placar ao vivo e palpita em cada partida pra disputar o bolão.`);
  return parts.join(' ');
});

const faq = computed(() => {
  const out: { q: string; a: string }[] = [];
  if (teamCount.value)
    out.push({
      q: `Quantos times disputam ${withArt(name.value)}?`,
      a: disputada.value
        ? `${cap(withArt(name.value))} ${ser.value} ${disputada.value} por ${teamCount.value} times no formato de ${formatLabel.value}.`
        : `${cap(name.value)} tem ${teamCount.value} times no formato de ${formatLabel.value}.`,
    });
  if (leader.value && status.value === 'ONGOING')
    out.push({ q: `Quem está liderando ${withArt(name.value)}?`, a: `O líder atual é o ${leader.value.name}, com ${leader.value.points} pontos em ${leader.value.played} jogos. Veja a tabela completa atualizada ao vivo no Cravei.` });
  if (nextMatch.value && status.value !== 'FINISHED')
    out.push({ q: `Qual o próximo jogo ${ofName(name.value)}?`, a: `O próximo jogo é ${nextMatchText.value}. Confira todos os jogos com data e horário no Cravei.` });
  out.push({ q: `Onde assistir ${withArt(name.value)} ao vivo?`, a: bcNames.value ? `A transmissão é por ${bcNames.value}, e o placar ao vivo de todas as partidas fica aqui no Cravei.` : `Acompanhe o placar ao vivo de todas as partidas ${ofName(name.value)} aqui no Cravei.` });
  out.push({ q: `Como funciona o bolão ${ofName(name.value)}?`, a: `Crie sua conta grátis, crave o placar de cada jogo antes do apito inicial e pontue pela precisão — quanto mais perto do resultado, mais pontos. Dispute o ranking com os amigos.` });
  return out;
});

useHead(() => {
  if (!faq.value.length) return {};
  return {
    script: [
      {
        key: 'ld-competition-faq',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.value.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }),
      },
    ],
  };
});
</script>

<template>
  <section class="cseo">
    <h2 class="cseo-h">Sobre {{ withArt(name) }}</h2>
    <p class="cseo-p">{{ intro }}</p>

    <h2 class="cseo-h">Perguntas frequentes</h2>
    <details v-for="(f, i) in faq" :key="i" class="cseo-faq" :open="i === 0">
      <summary>{{ f.q }}</summary>
      <p>{{ f.a }}</p>
    </details>
  </section>
</template>

<style scoped>
.cseo { margin-top: 28px; }
.cseo-h { font-family: 'Oswald', sans-serif; font-size: var(--fs-xl); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin: 24px 0 12px; }
.cseo-p { font-size: var(--fs-base); line-height: 1.6; color: var(--text); margin: 0 0 12px; max-width: 70ch; }
.cseo-faq { border: 1px solid var(--border); border-radius: 14px; padding: 4px 16px; margin-bottom: 8px; background: var(--bg-surface); }
.cseo-faq summary { cursor: pointer; padding: 12px 0; font-size: var(--fs-base); font-weight: 700; list-style: none; }
.cseo-faq summary::-webkit-details-marker { display: none; }
.cseo-faq p { margin: 0 0 14px; font-size: var(--fs-sm); line-height: 1.6; color: var(--muted); }
</style>
