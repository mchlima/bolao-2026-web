// Shapes mirror bolao-2026-docs/api/contracts.md.

export type UserRole = 'USER' | 'ADMIN';
export type TournamentStatus = 'DRAFT' | 'UPCOMING' | 'ONGOING' | 'FINISHED';
export type TeamType = 'NATIONAL_TEAM' | 'CLUB';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';
export type ScoreTier =
  | 'EXACT'
  | 'ONE_TEAM_SCORE'
  | 'CLOSE'
  | 'OUTCOME'
  | 'NONE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  type: TeamType;
  countryCode: string | null;
  continent: string | null;
  country: string | null;
  logoUrl: string | null;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
}

export interface Tournament {
  id: string;
  name: string;
  logoUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TournamentStatus;
  matchCount?: number; // present on list responses (GET /tournaments)
}

export interface Match {
  id: string;
  tournamentId: string;
  tournament?: { id: string; name: string; status: TournamentStatus } | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeSourceLabel: string | null;
  awaySourceLabel: string | null;
  stadium: Stadium | null;
  kickoffAt: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  phaseLabel: string | null;
  groupName: string | null;
  matchNumber: number | null;
  predictionsOpen: boolean | null; // manual override; null = automatic rule
  autoManaged: boolean; // true = ESPN robot drives score/status; false = admin took over
}

export interface ScoreResult {
  tier: ScoreTier;
  points: number;
}

export interface Prediction {
  id: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  match: Match;
  score: ScoreResult | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface RankingEntry {
  rank: number;
  user: { id: string; name: string };
  points: number;
  exactCount: number;
  scoredCount: number;
  prediction?: { home: number; away: number }; // match ranking only
  tier?: ScoreTier; // match ranking only
}

export interface RankingResponse {
  entries: RankingEntry[];
  currentUser: RankingEntry | null;
  totalParticipants: number;
  provisional?: boolean;
  result?: { home: number; away: number } | null;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}
