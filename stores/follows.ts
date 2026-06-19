import type { Team, Match } from '~/types/api';

type MatchLike = Pick<Match, 'id' | 'homeTeam' | 'awayTeam'>;

// Tracks what the current user follows for match notifications: their teams AND
// the individual matches they opted into. A match is "notifying" when the user
// follows it explicitly OR follows either team — that union drives every bell.
// Loaded once (lazily) per session; reset on logout.
export const useFollowsStore = defineStore('follows', () => {
  const teamIds = ref(new Set<string>());
  const teamNames = ref(new Map<string, string>());
  const matchIds = ref(new Set<string>());
  const loaded = ref(false);
  let inflight: Promise<void> | null = null;

  async function load(): Promise<void> {
    const api = useApi();
    const [teams, mids] = await Promise.all([
      api<Team[]>('/me/teams'),
      api<string[]>('/me/matches'),
    ]);
    teamIds.value = new Set(teams.map((t) => t.id));
    teamNames.value = new Map(teams.map((t) => [t.id, t.name]));
    matchIds.value = new Set(mids);
    loaded.value = true;
  }

  /** Load once; concurrent callers share the same request. */
  function ensureLoaded(): Promise<void> {
    if (loaded.value) return Promise.resolve();
    if (!inflight) {
      inflight = load().catch((e) => {
        inflight = null;
        throw e;
      });
    }
    return inflight;
  }

  /** Match is notifying because the user follows one of its teams. */
  function activeByTeam(m: MatchLike): boolean {
    return !!(
      (m.homeTeam && teamIds.value.has(m.homeTeam.id)) ||
      (m.awayTeam && teamIds.value.has(m.awayTeam.id))
    );
  }

  /** Effective notify state: explicit match follow OR a followed team. */
  function isActive(m: MatchLike): boolean {
    return matchIds.value.has(m.id) || activeByTeam(m);
  }

  /** Name of the followed team that makes a match active-by-team (for copy). */
  function teamNameFor(m: MatchLike): string {
    const id =
      m.homeTeam && teamIds.value.has(m.homeTeam.id)
        ? m.homeTeam.id
        : m.awayTeam && teamIds.value.has(m.awayTeam.id)
          ? m.awayTeam.id
          : null;
    return (id && teamNames.value.get(id)) || 'esse time';
  }

  async function follow(matchId: string): Promise<void> {
    matchIds.value.add(matchId);
    try {
      await useApi()(`/me/matches/${matchId}`, { method: 'PUT' });
    } catch (e) {
      matchIds.value.delete(matchId);
      throw e;
    }
  }

  async function unfollow(matchId: string): Promise<void> {
    matchIds.value.delete(matchId);
    try {
      await useApi()(`/me/matches/${matchId}`, { method: 'DELETE' });
    } catch (e) {
      matchIds.value.add(matchId);
      throw e;
    }
  }

  function toggle(matchId: string): Promise<void> {
    return matchIds.value.has(matchId) ? unfollow(matchId) : follow(matchId);
  }

  function reset(): void {
    teamIds.value = new Set();
    teamNames.value = new Map();
    matchIds.value = new Set();
    loaded.value = false;
    inflight = null;
  }

  return {
    teamIds,
    teamNames,
    matchIds,
    loaded,
    ensureLoaded,
    isActive,
    activeByTeam,
    teamNameFor,
    follow,
    unfollow,
    toggle,
    reset,
  };
});
