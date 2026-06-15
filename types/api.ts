// Shapes mirror bolao-2026-docs/api/contracts.md.

export type UserRole = 'USER' | 'ADMIN';
export type TournamentStatus = 'DRAFT' | 'UPCOMING' | 'ONGOING' | 'FINISHED';
export type TeamType = 'NATIONAL_TEAM' | 'CLUB';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
export type ScoreTier =
  | 'EXACT'
  | 'WINNER_GOALS'
  | 'GOAL_DIFF'
  | 'LOSER_GOALS'
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

// Unified external-provider references (ESPN, GE, …), stored as one JSON blob
// per entity. Mirrors the API's externalIds column. Keys are sparse.
export interface ExternalIds {
  espn?: { id?: string; code?: string; slug?: string };
  ge?: { id?: string; code?: string; championshipId?: string; phase?: string };
}

export interface Team {
  id: string;
  sportId: string;
  name: string;
  shortName: string;
  type: TeamType;
  countryCode: string | null;
  continent: string | null;
  country: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  externalIds: ExternalIds | null;
  color: string | null;
  colorAlt: string | null;
}

export interface TeamFacets {
  total: number;
  types: { value: TeamType; count: number }[];
  continents: { value: string; count: number }[];
  countries: { value: string; count: number }[];
  withLogo: number;
  withoutLogo: number;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
}

export type SeasonFormat = 'LEAGUE' | 'GROUPS' | 'KNOCKOUT' | 'GROUPS_KNOCKOUT';
export type CompetitionType = 'LEAGUE' | 'CUP' | 'LEAGUE_CUP';

export interface Sport {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
}

export interface Competition {
  id: string;
  sportId: string;
  sport?: Pick<Sport, 'id' | 'slug' | 'name'>;
  name: string;
  slug: string;
  type: CompetitionType;
  country: string | null;
  confederation: string | null;
  logoUrl: string | null;
  externalIds: ExternalIds | null;
}

// "Tournament" in the UI = a Season (one edition) on the API. The name is kept
// for UI continuity ("torneio"); the API path is /seasons.
export interface Tournament {
  id: string;
  name: string;
  seasonLabel?: string | null;
  logoUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TournamentStatus;
  format?: SeasonFormat;
  competition?: Competition | null;
  matchCount?: number; // present on list responses (GET /seasons)
}

// ── Competition structure (groups, rounds, knockout bracket) ──
export type StageFormat = 'LEAGUE' | 'GROUP' | 'KNOCKOUT';
export type TieResolution = 'AGGREGATE' | 'AWAY_GOALS' | 'EXTRA_TIME' | 'PENALTIES';

export interface StandingsTeam {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  countryCode: string | null;
}

export interface StandingsRow {
  position: number;
  previousPosition: number | null; // rank after the previous round; null on the first round
  team: StandingsTeam;
  played: number; // J
  wins: number; // V
  draws: number; // E
  losses: number; // D
  goalsFor: number; // GP
  goalsAgainst: number; // GC
  goalDiff: number; // SG
  points: number; // P
  pct: number; // % (aproveitamento)
  yellowCards: number; // disciplina
  redCards: number;
  fairPlay: number; // pontos de fair play FIFA (≤ 0) — critério de desempate
  form: ('W' | 'D' | 'L')[]; // last 5, oldest → newest
  live: boolean; // team has a match in progress — row is provisional
}

export interface GroupStandings {
  groupId: string;
  groupName: string;
  rows: StandingsRow[];
}

// Classification colour band for a LEAGUE table (e.g. Brasileirão zones).
// Positions are 1-based and inclusive.
export interface StandingsZone {
  from: number;
  to: number;
  label: string;
  tone: 'green' | 'blue' | 'teal' | 'red';
}

export interface StageStandings {
  stageId: string;
  stageName: string;
  format: 'LEAGUE' | 'GROUP';
  groups: GroupStandings[];
  zones?: StandingsZone[] | null;
}

export interface BracketLeg {
  id: string;
  matchNumber: number | null;
  leg: number | null;
  kickoffAt: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  homePenalties: number | null;
  awayPenalties: number | null;
  homeTeam: StandingsTeam | null;
  awayTeam: StandingsTeam | null;
  stadium: { name: string; city: string } | null;
}

export interface BracketTie {
  id: string;
  order: number;
  home: StandingsTeam | null;
  away: StandingsTeam | null;
  homeSourceLabel: string | null;
  awaySourceLabel: string | null;
  aggregateHome: number | null;
  aggregateAway: number | null;
  winnerTeamId: string | null;
  winner: StandingsTeam | null;
  resolution: TieResolution | null;
  legs: BracketLeg[];
  // Provisional projection (only set where not officially resolved): the team
  // that WOULD fill the slot given the current standings / live results.
  projectedHome?: StandingsTeam | null;
  projectedAway?: StandingsTeam | null;
  projectedWinner?: StandingsTeam | null;
}

export interface BracketRound {
  roundId: string;
  name: string | null;
  legs: number;
  ties: BracketTie[];
}

export interface BracketStage {
  stageId: string;
  stageName: string;
  hasThirdPlace: boolean;
  rounds: BracketRound[];
}

export interface Match {
  id: string;
  seasonId: string;
  season?: { id: string; name: string; status: TournamentStatus } | null;
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
  roundId: string | null;
  matchNumber: number | null;
  predictionsOpen: boolean | null; // manual override; null = automatic rule
  autoManaged: boolean; // true = ESPN robot drives score/status; false = admin took over
}

export interface ScoreResult {
  tier: ScoreTier;
  points: number;
}

/** One matchday (round) of a group, with its fixtures — consumed by GroupRoundCard. */
export interface RoundBlock {
  roundId: string;
  number: number;
  label: string;
  matches: Match[];
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
  revealed?: boolean; // match ranking: false until kickoff (others hidden)
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

// ── Pools ("bolões") ──
export type PoolVisibility = 'PRIVATE' | 'PUBLIC';
export type PoolMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface PoolTournamentSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  status: TournamentStatus;
}

export interface PoolMemberView {
  user: { id: string; name: string };
  role: PoolMemberRole;
  joinedAt: string;
}

export interface PoolInviteView {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface PoolSummary {
  id: string;
  name: string;
  description: string | null; // internal (members)
  inviteDescription: string | null; // shown on the invite page
  visibility: PoolVisibility;
  tournament: PoolTournamentSummary;
  myRole: PoolMemberRole;
  memberCount: number;
  createdAt: string;
}

export interface PoolDetail extends PoolSummary {
  members: PoolMemberView[];
  invites?: PoolInviteView[]; // present only for owner/admin
}

export interface PoolJoinPreview {
  id: string;
  name: string;
  description: string | null;
  visibility: PoolVisibility;
  tournament: PoolTournamentSummary;
  memberCount: number;
  alreadyMember: boolean;
}

export interface PoolMatchPredictionEntry {
  user: { id: string; name: string };
  prediction: { home: number; away: number };
  points?: number;
  tier?: ScoreTier;
}

export interface PoolMatchPredictionsView {
  revealed: boolean; // false until kickoff — others' predictions are hidden
  entries: PoolMatchPredictionEntry[];
}
