<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';
import type { PredRow } from './MatchPredictionList.vue';

// Public-facing match list: the SAME table/card as the admin "Palpites" screen
// (MatchPredictionList), wired to the public prediction flow — locks at kickoff,
// saves to /predictions, prompts login when logged out, links to the match.
const props = withDefaults(
  defineProps<{
    matches: Match[];
    /** matchId → the user's prediction (the page's predMap) */
    predictions?: Record<string, Prediction>;
    /** inside a pool, the match link is pool-scoped (predictions stay global) */
    poolId?: string;
    /** show the tournament name (useful on mixed-tournament lists: home, agenda) */
    showSeason?: boolean;
  }>(),
  { predictions: () => ({}), showSeason: false },
);
const emit = defineEmits<{ saved: [Prediction] }>();

const auth = useAuthStore();
const authLink = useAuthLink();
const now = useNow();

const rows = computed<PredRow[]>(() =>
  props.matches.map((m) => {
    const p = props.predictions[m.id] ?? null;
    return {
      match: m,
      prediction: p ? { homeScore: p.homeScore, awayScore: p.awayScore } : null,
      score: p?.score ?? null,
    };
  }),
);

// Mirrors useMatchOpen (kickoff hard-gate + admin override) against the ticking clock.
function matchOpen(m: Match): boolean {
  if (!m.homeTeam || !m.awayTeam) return false;
  if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
  if (m.status === 'POSTPONED') return m.predictionsOpen ?? true;
  if (new Date(m.kickoffAt).getTime() <= now.value) return false;
  if (m.status !== 'SCHEDULED') return false;
  return m.predictionsOpen ?? true;
}
const editable = (r: PredRow) => matchOpen(r.match) && auth.isAuthenticated;
const loginPrompt = (r: PredRow) => matchOpen(r.match) && !auth.isAuthenticated;
const loginTo = computed(() => authLink('/entrar'));

function rowTo(r: PredRow): string | null {
  const m = r.match;
  if (!m.homeTeam || !m.awayTeam) return null;
  if (props.poolId) return `/boloes/${props.poolId}/jogos/${m.id}`;
  if (m.seasonId) return `/futebol/torneios/${m.seasonId}/jogos/${m.id}`;
  return `/futebol/agenda/${m.id}`;
}

async function saveFn(r: PredRow, home: number, away: number) {
  const saved = await useApi()<Prediction>('/predictions', {
    method: 'POST',
    body: { matchId: r.match.id, homeScore: home, awayScore: away },
  });
  emit('saved', saved);
  return { homeScore: saved.homeScore, awayScore: saved.awayScore, score: saved.score ?? null };
}
</script>

<template>
  <MatchPredictionList
    :rows="rows"
    :show-season="showSeason"
    :editable="editable"
    :login-prompt="loginPrompt"
    :login-to="loginTo"
    :row-to="rowTo"
    :save-fn="saveFn"
  />
</template>
