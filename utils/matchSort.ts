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

// Clock-aware rank so listings reorder in real time. A SCHEDULED match whose
// kickoff has already passed is effectively live (the card shows a scoreline the
// moment the whistle blows) — float it up with the live games right away,
// without waiting for the robot to flip its server status or for a refetch.
export function effectiveMatchRank(m: Match, nowMs: number): number {
  if (m.status === 'SCHEDULED' && new Date(m.kickoffAt).getTime() <= nowMs) {
    return STATUS_RANK.LIVE;
  }
  return matchStatusRank(m.status);
}

// Comparator factory for match listings: pass a reactive `nowMs` (useNow) so the
// computed re-sorts as time passes. Orders by status priority, then kickoff —
// soonest first for upcoming/live, most-recent first for finished/cancelled (so
// the latest results sit at the top of the trailing "encerradas" block).
export function listingComparator(nowMs: number): (a: Match, b: Match) => number {
  return (a, b) => {
    const ra = effectiveMatchRank(a, nowMs);
    const rb = effectiveMatchRank(b, nowMs);
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.kickoffAt).getTime();
    const tb = new Date(b.kickoffAt).getTime();
    return ra >= STATUS_RANK.FINISHED ? tb - ta : ta - tb;
  };
}
