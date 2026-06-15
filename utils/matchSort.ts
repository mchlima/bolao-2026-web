import type { Match } from '~/types/api';

// Display priority for match listings: live games first, then upcoming
// (scheduled), then postponed ("a definir"), with finished/cancelled sinking to
// the bottom — finished matches always show last, even on past days.
const STATUS_RANK: Record<string, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  POSTPONED: 2,
  FINISHED: 3,
  CANCELLED: 4,
};

export function matchStatusRank(status: string): number {
  return STATUS_RANK[status] ?? 9;
}

// Comparator for match listings: by status priority, then kickoff — soonest
// first for upcoming/live, most-recent first for finished/cancelled (so the
// latest results sit at the top of the trailing "encerradas" block).
export function compareMatchesForListing(a: Match, b: Match): number {
  const ra = matchStatusRank(a.status);
  const rb = matchStatusRank(b.status);
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.kickoffAt).getTime();
  const tb = new Date(b.kickoffAt).getTime();
  return ra >= STATUS_RANK.FINISHED ? tb - ta : ta - tb;
}
