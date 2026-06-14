import type { Match, Paginated } from '~/types/api';

/**
 * Fetch every match of a season. The /matches endpoint caps pageSize at 100, so
 * a league's full fixture list (e.g. the Brasileirão's 380) needs several pages —
 * required for the round card to cover all 38 rounds, not just the first 10.
 */
export async function fetchAllMatches(
  api: ReturnType<typeof useApi>,
  seasonId: string,
): Promise<Match[]> {
  const out: Match[] = [];
  for (let page = 1; page <= 12; page++) {
    const res = await api<Paginated<Match>>(
      `/matches?seasonId=${seasonId}&pageSize=100&page=${page}`,
    );
    out.push(...res.data);
    if (res.data.length < 100) break;
  }
  return out;
}
