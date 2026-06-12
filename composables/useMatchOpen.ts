import type { Match } from '~/types/api';

/**
 * Reactive prediction-window state for a match, mirroring the backend rule
 * PredictionsService.acceptsPredictions: predictions ALWAYS close at kickoff;
 * the admin override (predictionsOpen) can only close the window early. Uses a
 * ticking clock so the form locks exactly at kickoff even before a realtime
 * refetch arrives — and never freezes "open" the way a plain Date.now() in a
 * computed would.
 */
export function useMatchOpen(match: () => Match | null | undefined) {
  const now = useNow();
  return computed(() => {
    const m = match();
    if (!m || !m.homeTeam || !m.awayTeam) return false;
    if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
    // Hard gate: once kickoff passes (or the match is no longer SCHEDULED), the
    // window is closed regardless of the override.
    if (new Date(m.kickoffAt).getTime() <= now.value) return false;
    if (m.status !== 'SCHEDULED') return false;
    return m.predictionsOpen ?? true;
  });
}
