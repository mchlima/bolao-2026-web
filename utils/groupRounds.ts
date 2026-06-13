import type { Match, RoundBlock } from '~/types/api';

/** Bucket a group's matches into rounds (matchdays): group by roundId, order the
 *  rounds by their lowest matchNumber, and label them 1..N. Shared by the group
 *  stage view and the per-match phase context. */
export function buildGroupRounds(matches: Match[], groupName: string): RoundBlock[] {
  const ms = matches.filter((m) => m.groupName === groupName);
  const byRound = new Map<string, Match[]>();
  for (const m of ms) {
    const key = m.roundId ?? `n${m.matchNumber ?? 0}`;
    (byRound.get(key) ?? byRound.set(key, []).get(key)!).push(m);
  }
  return [...byRound.values()]
    .map((group) => {
      const sorted = [...group].sort(
        (a, b) =>
          (a.matchNumber ?? 0) - (b.matchNumber ?? 0) ||
          a.kickoffAt.localeCompare(b.kickoffAt),
      );
      const minNum = Math.min(...sorted.map((m) => m.matchNumber ?? Number.MAX_SAFE_INTEGER));
      return { roundId: sorted[0].roundId ?? sorted[0].id, matches: sorted, minNum };
    })
    .sort((a, b) => a.minNum - b.minNum)
    .map((b, i): RoundBlock => ({ roundId: b.roundId, number: i + 1, label: `Rodada ${i + 1}`, matches: b.matches }));
}
