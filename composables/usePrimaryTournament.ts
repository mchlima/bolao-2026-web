import type { Paginated, Tournament } from '~/types/api';

/**
 * The "primary" tournament — the ongoing one, else the first listed. Same rule
 * the home page uses to pick what to feature. Shared (keyed) so the header's
 * Ranking link and any page can resolve a ranking target without refetching.
 * Returns null when logged out or when there are no tournaments.
 */
export function usePrimaryTournament() {
  const auth = useAuthStore();
  const { data } = useAsyncData<Tournament | null>(
    'primary-tournament',
    async () => {
      if (!auth.isAuthenticated) return null;
      const list = await useApi()<Paginated<Tournament>>('/seasons');
      return list.data.find((t) => t.status === 'ONGOING') ?? list.data[0] ?? null;
    },
    { watch: [() => auth.isAuthenticated] },
  );
  return data;
}
