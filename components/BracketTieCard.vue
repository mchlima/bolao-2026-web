<script setup lang="ts">
import type { BracketTie, Team } from '~/types/api';

const props = defineProps<{
  tie: BracketTie;
  legs: number; // 1 = single match, 2 = ida/volta
  variant?: 'normal' | 'final' | 'third';
  showProjection?: boolean; // fill empty slots with the provisional (projected) team
}>();

const tz = useTz();
const asTeam = (t: BracketTie['home']) => (t ? (t as unknown as Team) : null);

// Projected (provisional) occupant of an empty slot, when projection is on.
const homeProj = computed(() =>
  props.showProjection && !props.tie.home ? (props.tie.projectedHome ?? null) : null,
);
const awayProj = computed(() =>
  props.showProjection && !props.tie.away ? (props.tie.projectedAway ?? null) : null,
);
const homeShow = computed(() => props.tie.home ?? homeProj.value);
const awayShow = computed(() => props.tie.away ?? awayProj.value);

const status = computed(() => {
  const ls = props.tie.legs;
  if (ls.some((l) => l.status === 'LIVE')) return 'LIVE';
  if (ls.length && ls.every((l) => l.status === 'FINISHED')) return 'FINISHED';
  return 'SCHEDULED';
});
const played = computed(() => status.value === 'FINISHED' || status.value === 'LIVE');

// Score for one side: aggregate when known, else the (only) leg's goals.
function score(side: 'home' | 'away'): number | null {
  const agg = side === 'home' ? props.tie.aggregateHome : props.tie.aggregateAway;
  if (agg != null) return agg;
  const leg = props.tie.legs[0];
  if (leg && (leg.status === 'FINISHED' || leg.status === 'LIVE')) {
    return side === 'home' ? leg.homeScore : leg.awayScore;
  }
  return null;
}
const isWinner = (side: 'home' | 'away') =>
  !!props.tie.winnerTeamId && props.tie.winnerTeamId === props.tie[side]?.id;

const resolutionNote = computed(() => {
  const r = props.tie.resolution;
  if (r === 'PENALTIES') {
    const leg = props.tie.legs.find((l) => l.homePenalties != null);
    if (leg && leg.homePenalties != null && leg.awayPenalties != null) {
      const hIsHome = leg.homeTeam?.id === props.tie.home?.id;
      const ph = hIsHome ? leg.homePenalties : leg.awayPenalties;
      const pa = hIsHome ? leg.awayPenalties : leg.homePenalties;
      return `nos pênaltis (${ph}-${pa})`;
    }
    return 'nos pênaltis';
  }
  if (r === 'EXTRA_TIME') return 'após prorrogação';
  return null;
});

const firstLeg = computed(() => props.tie.legs[0] ?? null);
const sideName = (t: BracketTie['home'], label: string | null) =>
  t ? t.name : (label ?? 'A definir');

// Per-leg lines for two-legged ties (ida/volta).
const legLines = computed(() =>
  props.tie.legs.map((l) => ({
    id: l.id,
    label: l.leg === 2 ? 'Volta' : 'Ida',
    home: l.homeTeam?.shortName ?? '—',
    away: l.awayTeam?.shortName ?? '—',
    score:
      l.status === 'FINISHED' || l.status === 'LIVE'
        ? `${l.homeScore}-${l.awayScore}`
        : 'a jogar',
    when: formatKickoff(l.kickoffAt, tz.value),
  })),
);

const champion = computed(() =>
  props.variant === 'final' && props.tie.winner ? props.tie.winner : null,
);
</script>

<template>
  <article class="tcard" :class="[variant ?? 'normal', { live: status === 'LIVE' }]">
    <span v-if="variant === 'final'" class="ribbon">🏆 Final</span>

    <!-- context strip -->
    <header class="strip">
      <span class="jogo">
        <template v-if="variant === 'third'">Disputa de 3º lugar</template>
        <template v-else-if="firstLeg?.matchNumber">Jogo {{ firstLeg.matchNumber }}</template>
        <template v-else>Confronto</template>
      </span>
      <span class="status" :class="status.toLowerCase()">
        <span v-if="status === 'LIVE'" class="ldot" />
        {{ status === 'LIVE' ? 'Ao vivo' : status === 'FINISHED' ? 'Encerrado' : 'A jogar' }}
      </span>
    </header>

    <!-- the duel -->
    <div class="duel">
      <div class="team" :class="{ win: isWinner('home'), tbd: !homeShow, proj: !!homeProj }">
        <TeamBadge :team="asTeam(homeShow)" :placeholder="tie.homeSourceLabel" :size="variant === 'final' ? 56 : 44" />
        <span class="nm">{{ sideName(homeShow, tie.homeSourceLabel) }}</span>
        <span v-if="homeProj" class="provtag" :title="tie.homeSourceLabel ?? ''">provável</span>
      </div>

      <div class="mid">
        <div v-if="played" class="scoreline">
          <span class="sc" :class="{ win: isWinner('home') }">{{ score('home') ?? '–' }}</span>
          <span class="dash">×</span>
          <span class="sc" :class="{ win: isWinner('away') }">{{ score('away') ?? '–' }}</span>
        </div>
        <div v-else class="vs">
          <span v-if="firstLeg && legs === 1" class="when">{{ formatKickoff(firstLeg.kickoffAt, tz) }}</span>
          <span v-else class="vstxt">vs</span>
        </div>
        <span v-if="resolutionNote" class="resnote">{{ resolutionNote }}</span>
        <span v-else-if="legs > 1" class="resnote">ida e volta</span>
      </div>

      <div class="team" :class="{ win: isWinner('away'), tbd: !awayShow, proj: !!awayProj }">
        <TeamBadge :team="asTeam(awayShow)" :placeholder="tie.awaySourceLabel" :size="variant === 'final' ? 56 : 44" />
        <span class="nm">{{ sideName(awayShow, tie.awaySourceLabel) }}</span>
        <span v-if="awayProj" class="provtag" :title="tie.awaySourceLabel ?? ''">provável</span>
      </div>
    </div>

    <!-- champion banner (final only, when decided) -->
    <div v-if="champion" class="champ">
      🏆 Campeão: <strong>{{ champion.name }}</strong>
    </div>

    <!-- two-legged detail -->
    <div v-if="legs > 1 && tie.legs.length" class="legs">
      <div v-for="l in legLines" :key="l.id" class="legrow">
        <span class="lglabel">{{ l.label }}</span>
        <span class="lgmatch">{{ l.home }} <b>{{ l.score }}</b> {{ l.away }}</span>
        <span class="lgwhen">{{ l.when }}</span>
      </div>
    </div>

    <!-- match info (single match). Date only when played — otherwise the kickoff
         already shows in the centre, so we'd be repeating it. -->
    <footer v-else-if="firstLeg && (played || firstLeg.stadium)" class="info">
      <span v-if="played" class="meta-i">📅 {{ formatKickoff(firstLeg.kickoffAt, tz) }}</span>
      <span v-if="firstLeg.stadium" class="meta-i">{{ firstLeg.stadium.name }}<template v-if="firstLeg.stadium.city">, {{ firstLeg.stadium.city }}</template></span>
    </footer>
  </article>
</template>

<style scoped>
.tcard {
  position: relative;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px;
  overflow: hidden;
}
.tcard.live {
  border-color: rgba(232, 54, 43, 0.5);
  box-shadow: 0 0 0 1px rgba(232, 54, 43, 0.25);
}
.tcard.third {
  border-style: dashed;
}

/* Final — gold, elevated, larger. */
.tcard.final {
  border: none;
  padding: 26px 18px 18px;
  background:
    linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box,
    linear-gradient(135deg, #f6c945, #b8860b 55%, #f6c945) border-box;
  border: 2px solid transparent;
  box-shadow: 0 8px 30px rgba(184, 134, 11, 0.18);
}
.ribbon {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #f6c945, #b8860b);
  color: #1a1205;
  font-weight: 800;
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 16px;
  border-radius: 0 0 10px 10px;
}

/* context strip */
.strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.jogo {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.status {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.status.live {
  color: var(--scarlet);
}
.status.finished {
  color: var(--pitch, #1f9d55);
}
.ldot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: lp 1.1s infinite;
}
@keyframes lp {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* duel */
.duel {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 10px;
}
.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  min-width: 0;
}
.team .nm {
  font-weight: 700;
  font-size: var(--fs-sm);
  line-height: 1.15;
  max-width: 100%;
}
.tcard.final .team .nm {
  font-size: var(--fs-base);
}
.team.tbd .nm {
  color: var(--muted);
  font-weight: 500;
  font-style: italic;
  font-size: var(--fs-xs);
}
.team.win .nm {
  color: var(--text);
}
/* projected (provisional) occupant */
.team.proj .nm {
  color: var(--text);
  font-weight: 700;
  font-style: normal;
}
.team.proj :deep(.emblem) {
  opacity: 0.92;
}
.provtag {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--azure);
  border: 1px dashed color-mix(in srgb, var(--azure) 55%, var(--border));
  border-radius: 999px;
  padding: 1px 7px;
}
.team.win :deep(.emblem) {
  box-shadow: 0 0 0 2px var(--pitch, #1f9d55);
  border-radius: 50%;
}
.tcard.final .team.win :deep(.emblem) {
  box-shadow: 0 0 0 2px #f6c945;
}

/* middle: score / kickoff */
.mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding-top: 6px;
  min-width: 78px;
}
.scoreline {
  display: flex;
  align-items: center;
  gap: 9px;
}
.sc {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-3xl);
  line-height: 1;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.tcard.final .sc {
  font-size: 2.375rem;
}
.sc.win {
  color: var(--text);
}
.dash {
  color: var(--muted);
  font-weight: 700;
}
.vs {
  display: grid;
  place-items: center;
  min-height: 30px;
}
.when {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
  text-align: center;
  line-height: 1.3;
}
.vstxt {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-lg);
  color: var(--muted);
}
.resnote {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--azure);
  text-align: center;
}

/* champion */
.champ {
  margin-top: 14px;
  text-align: center;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: #8a6300;
  background: rgba(246, 201, 69, 0.18);
  border: 1px solid rgba(184, 134, 11, 0.35);
  border-radius: 10px;
  padding: 8px;
}
.champ strong {
  font-weight: 800;
}

/* two-legged */
.legs {
  margin-top: 12px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.legrow {
  display: grid;
  grid-template-columns: 46px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: var(--fs-xs);
}
.lglabel {
  font-weight: 800;
  text-transform: uppercase;
  font-size: var(--fs-xs);
  color: var(--muted);
}
.lgmatch b {
  font-variant-numeric: tabular-nums;
}
.lgwhen {
  color: var(--muted);
  font-size: var(--fs-xs);
}

/* single-match info */
.info {
  margin-top: 12px;
  border-top: 1px solid var(--border);
  padding-top: 9px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 16px;
}
.meta-i {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
}
</style>
