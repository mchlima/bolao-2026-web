<script setup lang="ts">
import type { Match } from '~/types/api';

// Card de jogo READ-ONLY da vitrine (home/agenda/listas). Sem palpite/stepper —
// só leitura (times, placar/horário, status) + link pra partida. Cravar acontece
// na aba Bolão da partida e na Área do Bolão (Palpites pendentes). Renderiza a
// lista inteira (drop-in do MatchList nas superfícies informativas).
const props = withDefaults(
  defineProps<{
    matches: Match[];
    /** mostra a linha do torneio (útil em listas multi-torneio: home, agenda) */
    showSeason?: boolean;
  }>(),
  { showSeason: false },
);

const tz = useTz();
// Resolve o componente real — `:is="'NuxtLink'"` (string) NÃO resolve aqui e
// renderiza um <NuxtLink> inerte (não vira <a href>, card não clica).
const NuxtLink = resolveComponent('NuxtLink');

function rowTo(m: Match): string | null {
  if (!m.homeTeam || !m.awayTeam) return null;
  // Rota canônica da partida (uma só), independente do torneio. Slug de SEO quando há.
  return `/futebol/jogo/${m.slug || m.id}`;
}
function teamName(t: { name?: string } | null, fallback: string | null): string {
  return t?.name ?? fallback ?? 'A definir';
}
function isScored(m: Match): boolean {
  return m.status === 'LIVE' || m.status === 'FINISHED';
}
function scoreText(m: Match): string {
  return `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`;
}
function timeText(m: Match): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz.value }).format(new Date(m.kickoffAt));
}
function dateText(m: Match): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz.value }).format(new Date(m.kickoffAt));
}
function roundText(m: Match): string {
  if (m.round?.number != null) return `Rodada ${m.round.number}`;
  return m.round?.name ?? '';
}
function groupText(m: Match): string {
  // Só grupos de verdade (letra única, ex. Copa A–L). Divisões tipo "Série A" já
  // estão no nome da competição — não duplica.
  if (m.groupName && /^[a-z]$/i.test(m.groupName)) return `Grupo ${m.groupName.toUpperCase()}`;
  return '';
}
function metaText(m: Match): string {
  const parts: string[] = [];
  if (props.showSeason) {
    // Nome da COMPETIÇÃO (sem ano), com fallback ao nome da season.
    const comp = m.season?.competition?.name || m.season?.name;
    if (comp) parts.push(comp.replace(/\bFIFA\b/gi, '').replace(/\s+/g, ' ').trim());
  }
  const r = roundText(m);
  if (r) parts.push(r);
  const g = groupText(m);
  if (g) parts.push(g);
  return parts.join(' · ');
}
type Tone = 'live' | 'scheduled' | 'done';
function statusTone(m: Match): Tone {
  if (m.status === 'LIVE') return 'live';
  if (m.status === 'FINISHED') return 'done';
  return 'scheduled';
}
function statusText(m: Match): string {
  if (m.status === 'LIVE') return m.liveClock || 'Ao vivo';
  if (m.status === 'FINISHED') return 'Encerrado';
  if (m.status === 'POSTPONED') return 'Adiado';
  if (m.status === 'CANCELLED') return 'Cancelado';
  return dateText(m);
}
</script>

<template>
  <div class="mc-list">
    <component
      :is="rowTo(m) ? NuxtLink : 'div'"
      v-for="m in matches"
      :key="m.id"
      :to="rowTo(m) || undefined"
      class="mc"
    >
      <div class="mc-meta">
        <span class="mc-comp">{{ metaText(m) || '—' }}</span>
        <span class="mc-status" :class="statusTone(m)">
          <span v-if="m.status === 'LIVE'" class="d" />{{ statusText(m) }}
        </span>
      </div>

      <div class="mc-row">
        <div class="mc-team home">
          <TeamBadge :team="m.homeTeam" :size="30" />
          <span class="mc-name">{{ teamName(m.homeTeam, m.homeSourceLabel) }}</span>
        </div>

        <div class="mc-mid">
          <template v-if="isScored(m)">
            <span class="mc-score font-numeric">{{ scoreText(m) }}</span>
          </template>
          <template v-else-if="m.status === 'SCHEDULED'">
            <span class="mc-time font-numeric">{{ timeText(m) }}</span>
          </template>
          <template v-else>
            <span class="mc-vs">×</span>
          </template>
        </div>

        <div class="mc-team away">
          <span class="mc-name">{{ teamName(m.awayTeam, m.awaySourceLabel) }}</span>
          <TeamBadge :team="m.awayTeam" :size="30" />
        </div>
      </div>
    </component>
  </div>
</template>

<style scoped>
.mc-list { display: grid; gap: 10px; }
.mc {
  display: block;
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-surface);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.14s, transform 0.14s, box-shadow 0.14s;
}
.mc:hover { border-color: color-mix(in srgb, var(--azure) 38%, var(--border)); transform: translateY(-1px); box-shadow: var(--shadow); }

.mc-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.mc-comp { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.mc-status { flex: none; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; letter-spacing: 0.02em; color: var(--muted); }
.mc-status.scheduled { color: var(--azure); }
.mc-status.done { color: var(--muted); }
.mc-status.live { color: var(--scarlet); text-transform: uppercase; }
.mc-status .d { width: 6px; height: 6px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }

.mc-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
.mc-team { display: flex; align-items: center; gap: 9px; min-width: 0; }
.mc-team.away { justify-content: flex-end; }
.mc-name { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 17.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-mid { flex: none; display: grid; place-items: center; min-width: 64px; }
.mc-score { font-size: 24px; font-weight: 800; letter-spacing: 0.02em; }
.mc-time { font-size: 22px; font-weight: 700; color: var(--azure); }
.mc-vs { font-size: 14px; color: var(--muted); }

@media (max-width: 420px) {
  .mc { padding: 12px; }
  .mc-name { font-size: 13.5px; }
}
</style>
