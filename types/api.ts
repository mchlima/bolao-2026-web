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

// ── Notification campaigns (admin broadcast) ──
export type AudienceField =
  | 'followsTeam'
  | 'role'
  | 'isActive'
  | 'pushEnabled'
  | 'inPool'
  | 'hasPredicted'
  | 'timezone'
  | 'createdAt';

export interface AudienceCondition {
  field: AudienceField;
  operator: string;
  value?: unknown;
}
export interface AudienceGroup {
  op: 'and' | 'or';
  children: AudienceNode[];
}
export type AudienceNode = AudienceGroup | AudienceCondition;

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'CANCELLED'
  | 'FAILED';

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  url: string | null;
  channels: string[];
  audienceAll: boolean;
  filter: AudienceNode | null;
  status: CampaignStatus;
  sendAt: string | null;
  startedAt: string | null;
  sentAt: string | null;
  totalRecipients: number | null;
  deliveredCount: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────── Content pipeline (RSS → rewrite)
export type NewsItemStatus =
  | 'DISCOVERED'
  | 'FILTERED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export interface NewsTone {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  promptText: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export type NewsFeedType = 'RSS' | 'NEWS_API' | 'PAGE';

export interface NewsFeed {
  id: string;
  name: string;
  url: string;
  type: NewsFeedType;
  config: Record<string, unknown> | null;
  sport: string;
  isActive: boolean;
  defaultToneId: string | null;
  fetchIntervalMin: number;
  lastFetchedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
  defaultTone?: { id: string; name: string } | null;
}

export interface NewsQuote {
  speaker: string;
  text: string;
}

export interface NewsFacts {
  headlineFact?: string;
  competition?: string;
  teams?: string[];
  people?: string[];
  score?: string;
  whenText?: string;
  keyFacts?: string[];
  quotes?: NewsQuote[];
  [k: string]: unknown;
}

export interface NewsRevision {
  id: string;
  itemId: string;
  attempt: number;
  guidance: string | null;
  generatedText: string;
  toneSnapshot: string | null;
  model: string | null;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  feedId: string | null;
  sourceUrl: string;
  sourceGuid: string;
  sourceTitle: string;
  sourceSummary: string | null;
  sourceText: string | null;
  publishedAt: string | null;
  status: NewsItemStatus;
  relevanceScore: number | null;
  relevanceReason: string | null;
  facts: NewsFacts | null;
  toneId: string | null;
  toneSnapshot: string | null;
  toneVersion: number | null;
  generatedText: string | null;
  model: string | null;
  error: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  feed?: { id: string; name: string } | null;
  tone?: { id: string; name: string } | null;
  revisions?: NewsRevision[];
}

export interface FeedPreview {
  title: string;
  items: { title: string; link: string; isoDate: string | null }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  timezone: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** admin list only: user has ≥1 web-push subscription (notifications enabled) */
  pushEnabled?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Which third-party identities the user has linked (profile "Contas conectadas"). */
export interface AccountConnections {
  google: boolean;
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
  photoUrl?: string | null;
  photoCredit?: string | null;
  photoSourceUrl?: string | null;
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
  logoUrlDark: string | null;
  externalIds: ExternalIds | null;
}

// "Tournament" in the UI = a Season (one edition) on the API. The name is kept
// for UI continuity ("torneio"); the API path is /seasons.
export interface Tournament {
  id: string;
  name: string;
  seasonLabel?: string | null;
  logoUrl: string | null;
  location?: string | null;
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
  season?: {
    id: string;
    name: string;
    status: TournamentStatus;
    startDate?: string | null;
    endDate?: string | null;
    location?: string | null;
    logoUrl?: string | null;
    competition?: { country: string | null; confederation?: string | null } | null;
    // Participating teams of the season (present on GET /matches/:id) — feeds the
    // tournament's `performer` in structured data.
    teams?: { name: string; logoUrl: string | null }[];
  } | null;
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
  liveClock: string | null; // ESPN live clock while LIVE, e.g. "67'"
  roundId: string | null;
  round?: { number: number | null; name: string | null } | null; // matchday (number) or knockout round (name)
  matchNumber: number | null;
  attendance?: number | null; // crowd, from ESPN gameInfo
  referee?: string | null; // main referee, from ESPN gameInfo
  predictionsOpen: boolean | null; // manual override; null = automatic rule
  autoManaged: boolean; // true = ESPN robot drives score/status; false = admin took over
  // Availability counts (present on GET /matches/:id) — drive which match tabs show.
  _count?: { lineupEntries: number; events: number; stats: number };
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

// In-app notification (GET /notifications). v1 type: MATCH_REMINDER.
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  matchId: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface RankingEntry {
  rank: number;
  user: { id: string; name: string; avatarUrl: string | null };
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

// GET /me/standings — the current user's position in every scope they play, for
// the início's "Sua posição" slider. Grouped by tournament: each tournament has a
// GERAL (season-wide) standing followed by the user's pools in that tournament.
export interface MyStanding {
  me: RankingEntry | null;
  total: number;
}
export interface MyPoolStanding extends MyStanding {
  poolId: string;
  name: string; // pool name
}
export interface MyStandingsTournament {
  id: string;
  name: string;
  status: TournamentStatus;
  general: MyStanding;
  pools: MyPoolStanding[];
}
export interface MyStandingsResponse {
  tournaments: MyStandingsTournament[];
}

// GET /me/matches/following — the home "Seus jogos", grouped by followed team:
// each team's next 2 upcoming games (any date) + followed-by-match games.
export interface FollowingTeamGroup {
  team: Team;
  matches: Match[];
}
export interface FollowingView {
  teams: FollowingTeamGroup[];
  others: Match[];
  followedTeamCount: number;
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

export type PoolRunStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';

// A pool's "temporada": the season it disputes within a time window.
export interface PoolRunView {
  id: string;
  label: string | null;
  status: PoolRunStatus;
  startAt: string | null;
  endAt: string | null;
  order: number;
}

export interface PoolRunWithChampion extends PoolRunView {
  tournament: PoolTournamentSummary;
  champion: {
    user: { id: string; name: string; avatarUrl: string | null };
    points: number;
  } | null;
  totalParticipants: number;
}

export interface PoolMemberView {
  user: { id: string; name: string; avatarUrl: string | null };
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
  tournament: PoolTournamentSummary; // the current temporada's season
  currentRun: PoolRunView | null; // the open (or latest) temporada
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
  user: { id: string; name: string; avatarUrl: string | null };
  prediction: { home: number; away: number };
  points?: number;
  tier?: ScoreTier;
}

export interface PoolMatchPredictionsView {
  revealed: boolean; // false until kickoff — others' predictions are hidden
  entries: PoolMatchPredictionEntry[];
}

// Live lineups from the ESPN summary feed (GET /matches/:id/lineup).
export interface LineupPlayer {
  name: string;
  jersey: string | null;
  position: string | null;
  line: 'GK' | 'DEF' | 'MID' | 'FWD';
  formationPlace: number | null;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  yellow: number;
  red: number;
  photo: string | null;
  subFor: string | null;
  subMinute: string | null;
}
export interface LineupTeam {
  formation: string | null;
  players: LineupPlayer[];
}
export interface MatchLineup {
  available: boolean;
  reason?: 'pending';
  home?: LineupTeam;
  away?: LineupTeam;
}

// Event timeline (GET /matches/:id/events), grouped by period.
export interface TimelineEvent {
  // GOAL / OWN_GOAL / PENALTY_GOAL / PENALTY_MISSED / YELLOW / RED / SECOND_YELLOW
  // / SUBSTITUTION / VAR / DELAY / PERIOD_END
  type: string;
  minute: string | null;
  side: 'home' | 'away' | null;
  player: string | null;
  related: string | null;
  detail: string | null; // goal method, VAR decision, delay reason, penalty miss/save
}
export interface TimelinePeriod {
  period: number;
  label: string;
  events: TimelineEvent[];
}
export interface MatchTimeline {
  available: boolean;
  periods: TimelinePeriod[];
}

// Team statistics (GET /matches/:id/stats).
export interface StatRow {
  key: string;
  label: string;
  home: string | null;
  away: string | null;
}
export interface MatchStats {
  available: boolean;
  rows: StatRow[];
}
