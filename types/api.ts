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
  | 'PROMOTED'
  | 'REJECTED'
  | 'FAILED'
  | 'DUPLICATE';

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

export type NewsFeedType = 'RSS' | 'NEWS_API' | 'PAGE' | 'TOPIC' | 'MATCH_REPORT';

export interface NewsFeed {
  id: string;
  name: string;
  url: string;
  type: NewsFeedType;
  config: Record<string, unknown> | null;
  sport: string;
  focus: string | null;
  isActive: boolean;
  defaultToneId: string | null;
  fetchIntervalMin: number;
  maxAgeHours: number | null;
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
  matchId: string | null;
  sourceUrl: string;
  sourceGuid: string;
  sourceTitle: string;
  sourceSummary: string | null;
  sourceText: string | null;
  publishedAt: string | null;
  status: NewsItemStatus;
  eventKey: string | null;
  duplicateOfId: string | null;
  relevanceScore: number | null;
  relevanceReason: string | null;
  facts: NewsFacts | null;
  seo: NewsItemSeo | null;
  toneId: string | null;
  toneSnapshot: string | null;
  toneVersion: number | null;
  generatedText: string | null;
  model: string | null;
  verifyOk: boolean | null;
  verifyNotes: string | null;
  error: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  feed?: { id: string; name: string; type?: NewsFeedType } | null;
  tone?: { id: string; name: string } | null;
  category?: EntityRef | null;
  tags?: EntityRef[];
  revisions?: NewsRevision[];
  duplicateOf?: { id: string; sourceTitle: string } | null;
  duplicates?: { id: string; sourceTitle: string; feed?: { name: string } | null }[];
}

/** SEO/GEO/taxonomy package generated with the article (powers organic discovery). */
export interface NewsItemSeo {
  dek?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  keywords?: string[];
  category?: string;
  tags?: string[];
  keyTakeaways?: string[];
  faq?: { question: string; answer: string }[];
  imageAlt?: string;
}

/** Entidade leve (nome + slug) de categoria/tag, usada nos links públicos. */
export interface TermRef {
  name: string;
  slug: string;
}

/** Ref de entidade com id (admin: seleção de categoria/tags no item). */
export interface EntityRef extends TermRef {
  id: string;
}

/** Metadados SEO/GEO da página de uma categoria/tag (manuais do admin). */
export interface TermSeo {
  metaTitle?: string;
  metaDescription?: string;
  /** Override do H1 visível (default: o nome). */
  heading?: string;
  /** Parágrafo de introdução (resposta direta — GEO) no topo do hub. */
  intro?: string;
  faq?: { question: string; answer: string }[];
}

/** Cabeçalho de página de categoria/tag (nome + descrição + total publicado). */
export interface TermPage extends TermRef {
  description: string | null;
  total: number;
  seo: TermSeo | null;
  /** Listagem de categorias: slug do pai na árvore (p/ montar o menu hierárquico). */
  parentSlug?: string | null;
  /** Categoria: caminho raiz→nó p/ breadcrumb (Futebol > Copa do Mundo > 2026). */
  path?: TermRef[];
}

/** Tag/Categoria no admin (CRUD), com contagem de itens. */
export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo: TermSeo | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

/** Nó da árvore de categorias (admin): lista achatada em DFS. */
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo: TermSeo | null;
  parentId: string | null;
  depth: number;
  pathLabel: string[];
  items: number;
}

/** Public news card (listing) — only approved, published articles. */
export interface NewsCard {
  slug: string;
  title: string;
  dek: string;
  category: TermRef | null;
  tags: TermRef[];
  imageAlt: string;
  coverUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  source: string | null;
}

/** Public full article (slug page). */
export interface PublicNewsArticle extends NewsCard {
  body: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  keywords: string[];
  keyTakeaways: string[];
  faq: { question: string; answer: string }[];
  updatedAt: string;
  /** Caminho raiz→folha da categoria (Futebol > Copa do Mundo > 2026), p/ breadcrumb. */
  categoryPath: TermRef[];
}

export interface FeedPreview {
  title: string;
  items: { title: string; link: string; isoDate: string | null }[];
}

// ── CMS Posts (entidade editorial; separada da esteira NewsItem) ──
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Pacote SEO/GEO do artigo (sem slug/dek/categoria/tags — esses são campos do post). */
export interface PostSeo {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  imageAlt?: string;
  keywords?: string[];
  keyTakeaways?: string[];
  faq?: { question: string; answer: string }[];
}

/** Linha da listagem do CMS (/admin/posts). */
export interface PostListRow {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  featured: boolean;
  coverUrl: string | null;
  publishedAt: string | null;
  hasPendingChanges: boolean;
  category: { name: string; slug: string } | null;
  tagCount: number;
  fromEngine: boolean;
  createdAt: string;
  updatedAt: string;
}

/** View do editor: campos DE TRABALHO (draft ?? colunas) + estado de publicação. */
export interface PostView {
  id: string;
  status: PostStatus;
  featured: boolean;
  coverUrl: string | null;
  title: string;
  slug: string;
  dek: string | null;
  body: string;
  seo: PostSeo | null;
  categoryId: string | null;
  tags: EntityRef[];
  /** Slug atualmente no ar (só relevante quando PUBLISHED). */
  publishedSlug: string | null;
  hasPendingChanges: boolean;
  publishedAt: string | null;
  fromEngine: boolean;
  createdAt: string;
  updatedAt: string;
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
  slug?: string | null; // slug público p/ /futebol/selecoes/:slug
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

// Edição pública vigente de uma competição (deep link da nav/hub p/ a temporada
// atual). Resolvida no backend: ONGOING → próxima UPCOMING → FINISHED mais recente.
export interface ActiveSeason {
  id: string;
  slug: string;
  name: string;
  seasonLabel: string | null;
  status: TournamentStatus;
  logoUrl: string | null;
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
  // Artigo gramatical do nome ('o'|'a'|'os'|'as'|null) p/ concordância no conteúdo SSR.
  article?: string | null;
  externalIds: ExternalIds | null;
  // Slug público de URL (/futebol/campeonato/:urlSlug). Stored ou derivado do nome.
  urlSlug?: string;
  // Presentes na listagem (GET /competitions).
  seasonCount?: number;
  activeSeason?: ActiveSeason | null;
}

// "Tournament" in the UI = a Season (one edition) on the API. The name is kept
// for UI continuity ("torneio"); the API path is /seasons.
export interface Tournament {
  id: string;
  slug?: string | null; // slug público p/ /futebol/torneios/:slug
  name: string;
  seasonLabel?: string | null;
  logoUrl: string | null;
  location?: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TournamentStatus;
  format?: SeasonFormat;
  // Emissoras curadas ("onde assistir") da edição — display-only no público.
  broadcasters?: { name: string; url?: string | null }[] | null;
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
  /** Slug de SEO ("brasil-x-franca-2026-06-22"); pode faltar enquanto os times não resolvem. */
  slug?: string | null;
  seasonId: string;
  season?: {
    id: string;
    slug?: string | null;
    name: string;
    status: TournamentStatus;
    startDate?: string | null;
    endDate?: string | null;
    location?: string | null;
    logoUrl?: string | null;
    // Emissoras curadas ("onde assistir") da edição — display-only.
    broadcasters?: { name: string; url?: string | null }[] | null;
    competition?: {
      name?: string;
      urlSlug?: string | null;
      country: string | null;
      confederation?: string | null;
    } | null;
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
  exactCount: number; // "cravadas"
  scoredCount: number; // "pontuadas" (partidas já contabilizadas)
  predictedCount: number; // "palpitadas" (palpites feitos no escopo)
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

// GET /competitions/:urlSlug/ranking — ranking público do bolão por competição
// (BOLÃO > Ranking > <competição>). Logado recebe o ranking completo da temporada
// vigente; anônimo recebe só os metadados + nº de participantes (privacidade).
export interface CompetitionRankingResponse {
  competition: { id: string; name: string; urlSlug: string };
  season: {
    id: string;
    name: string;
    seasonLabel: string | null;
    slug: string | null;
    status: TournamentStatus;
  } | null;
  totalParticipants: number;
  ranking: RankingResponse | null;
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
  slug?: string | null;
  name: string;
  status: TournamentStatus;
  competition?: { name: string; urlSlug?: string | null } | null;
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
  slug?: string | null;
  name: string;
  logoUrl: string | null;
  status: TournamentStatus;
  // Competição-dona — p/ linkar o hub por /futebol/campeonato/:urlSlug.
  competition?: { name: string; urlSlug?: string | null } | null;
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
  tournament: PoolTournamentSummary | null; // a temporada atual define o torneio; null se o bolão ainda não tem temporada
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
  tournament: PoolTournamentSummary | null; // null se o bolão ainda não tem temporada
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
  goalY?: number | null; // onde a bola cruzou a linha do gol (0–100 lateral)
  fieldX?: number | null; // origem do chute no campo (0–100)
  fieldY?: number | null;
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

// ── Prévia do jogo (GET /matches/:id/preview) — só estado SCHEDULED ──
// Blocos determinísticos do nosso banco: forma recente, retrospecto (H2H),
// o que está em jogo (tabela do grupo) e artilheiros da competição.
export interface PreviewTeamRef {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
}
export interface PreviewFormMatch {
  matchId: string;
  slug: string | null;
  kickoffAt: string;
  competition: string | null;
  home: boolean;
  opponent: PreviewTeamRef | null;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}
export interface PreviewForm {
  matches: PreviewFormMatch[];
  summary: { w: number; d: number; l: number };
}
export interface PreviewH2HMeeting {
  matchId: string;
  slug: string | null;
  kickoffAt: string;
  competition: string | null;
  homeTeam: PreviewTeamRef | null;
  awayTeam: PreviewTeamRef | null;
  homeScore: number;
  awayScore: number;
}
export interface PreviewH2H {
  total: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  meetings: PreviewH2HMeeting[];
}
export interface PreviewStandingRow {
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDiff: number;
  form: ('W' | 'D' | 'L')[];
}
export interface PreviewStandings {
  stageName: string;
  groupName: string;
  home: PreviewStandingRow | null;
  away: PreviewStandingRow | null;
}
export interface PreviewScorer {
  player: { id: string; name: string; photoUrl: string | null };
  goals: number;
}
export interface PreviewScorers {
  competition: string | null;
  home: PreviewScorer[];
  away: PreviewScorer[];
}
export interface PreviewProbability {
  provider: string | null;
  home: number; // % 0–100
  draw: number;
  away: number;
  favorite: 'home' | 'draw' | 'away';
  updatedAt: string | null;
}
export interface MatchPreview {
  available: boolean;
  home: PreviewTeamRef | null;
  away: PreviewTeamRef | null;
  form: { home: PreviewForm; away: PreviewForm } | null;
  h2h: PreviewH2H | null;
  standings: PreviewStandings | null;
  scorers: PreviewScorers | null;
  probability: PreviewProbability | null;
}

// Comentário do admin na narração ao vivo (vira fato pra geração).
export interface MatchNote {
  id: string;
  text: string;
  minute: string | null;
  authorId: string | null;
  createdAt: string;
}
