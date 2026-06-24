<script setup lang="ts">
import type { BracketRound, BracketStage, Match, StageStandings } from '~/types/api';

const props = defineProps<{
  standings: StageStandings[]; // LEAGUE/GROUP stages → classification phase(s)
  bracketStages: BracketStage[]; // KNOCKOUT stages → one phase per round
  matches?: Match[]; // group-stage fixtures, for the per-group round cards
  seasonId?: string;
}>();

type Phase =
  | { key: string; kind: 'standings'; name: string; stage: StageStandings }
  | { key: string; kind: 'round'; name: string; round: BracketRound };

// The group stage comes first (named after its stage, e.g. "Fase de Grupos"),
// then each knockout round in order.
const phases = computed<Phase[]>(() => {
  const list: Phase[] = [];
  for (const s of props.standings) {
    list.push({ key: `s-${s.stageId}`, kind: 'standings', name: s.stageName, stage: s });
  }
  for (const bs of props.bracketStages) {
    for (const r of bs.rounds) {
      list.push({ key: r.roundId, kind: 'round', name: r.name ?? 'Fase', round: r });
    }
  }
  return list;
});

const index = ref(0);
const dir = ref<'next' | 'prev'>('next');
const current = computed(() => phases.value[index.value] ?? null);

// Provisional bracket projection (fills empty slots from the current standings).
const projection = ref(true);
const roundHasProjection = computed(() => {
  const c = current.value;
  if (!c || c.kind !== 'round') return false;
  return c.round.ties.some((t) => (!t.home && t.projectedHome) || (!t.away && t.projectedAway));
});

watch(phases, (p) => {
  if (index.value > p.length - 1) index.value = Math.max(0, p.length - 1);
});

function go(delta: number) {
  const next = index.value + delta;
  if (next < 0 || next > phases.value.length - 1) return;
  dir.value = delta > 0 ? 'next' : 'prev';
  index.value = next;
}

function variantFor(name: string | null): 'normal' | 'final' | 'third' {
  if (name === 'Final') return 'final';
  if (name === 'Disputa de 3º lugar') return 'third';
  return 'normal';
}
const bestThirds = (s: StageStandings) =>
  s.format === 'GROUP' && s.groups.length === 12 ? 8 : 0;

// League (pontos corridos) → table + round card, like the match page. Rounds are
// bucketed from the season's matches (the parent fetches all of them).
const leagueRounds = computed(() => {
  const c = current.value;
  if (!c || c.kind !== 'standings' || c.stage.format !== 'LEAGUE') return [];
  return buildGroupRounds(props.matches ?? [], c.stage.groups[0]?.groupName ?? '');
});
</script>

<template>
  <div class="phases">
    <!-- Phase navigator: ‹ PHASE NAME › -->
    <div class="nav">
      <button class="arrow" :disabled="index <= 0" aria-label="Fase anterior" @click="go(-1)">‹</button>
      <div class="title-wrap">
        <Transition :name="dir === 'next' ? 'flip-next' : 'flip-prev'" mode="out-in">
          <h3 :key="current?.key" class="title font-display">{{ current?.name }}</h3>
        </Transition>
      </div>
      <button
        class="arrow"
        :disabled="index >= phases.length - 1"
        aria-label="Próxima fase"
        @click="go(1)"
      >
        ›
      </button>
    </div>

    <!-- Sliding phase content -->
    <div class="viewport">
      <Transition :name="dir === 'next' ? 'slide-next' : 'slide-prev'">
        <div v-if="current" :key="current.key" class="phase">
          <!-- Group/league stage → classification -->
          <template v-if="current.kind === 'standings'">
            <GroupStageView
              v-if="current.stage.format === 'GROUP'"
              :groups="current.stage.groups"
              :matches="matches ?? []"
              :season-id="seasonId ?? ''"
              :qualify-count="2"
              :best-thirds="bestThirds(current.stage)"
            />
            <div v-else class="league">
              <StandingsTable
                :rows="current.stage.groups[0]?.rows ?? []"
                :zones="current.stage.zones ?? []"
                movement
              />
              <GroupRoundCard
                v-if="leagueRounds.length"
                :season-id="seasonId ?? ''"
                :rounds="leagueRounds"
              />
            </div>
          </template>

          <!-- Knockout round → tie cards stacked full-width -->
          <template v-else>
            <p v-if="!current.round.ties.length" class="muted empty">Sem confrontos nesta fase.</p>
            <div v-if="roundHasProjection" class="projbar">
              <p class="projnote">
                <b>Projeção</b> pela classificação atual — pode mudar até a fase terminar.
              </p>
              <button class="projtoggle" :class="{ on: projection }" @click="projection = !projection">
                {{ projection ? 'Ocultar' : 'Mostrar' }} projeção
              </button>
            </div>
            <div class="cards">
              <BracketTieCard
                v-for="tie in current.round.ties"
                :key="tie.id"
                :tie="tie"
                :legs="current.round.legs"
                :variant="variantFor(current.round.name)"
                :show-projection="projection"
              />
            </div>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.phases {
  overflow: hidden;
}
.projbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 9px 12px;
  border: 1px dashed color-mix(in srgb, var(--azure) 45%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--azure) 7%, transparent);
}
.projnote {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
  min-width: 0;
}
.projnote b {
  color: var(--azure);
  font-weight: 800;
}
.projtoggle {
  flex: none;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 9px;
  cursor: pointer;
}
.projtoggle.on {
  border-color: color-mix(in srgb, var(--azure) 50%, var(--border));
  color: var(--azure);
}

/* ── Navigator ── */
.nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.arrow {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: var(--fs-2xl);
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s, opacity 0.15s;
}
.arrow:hover:not(:disabled) {
  color: var(--text);
}
.arrow:disabled {
  opacity: 0.32;
  cursor: default;
}
.title-wrap {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.title {
  font-weight: 700;
  font-size: clamp(1rem, 4vw, 1.375rem);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Phase content ── */
.viewport {
  position: relative;
}
.phase {
  width: 100%;
}
/* League phase: classification + round card side by side (stacks on mobile). */
.league {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
}
@media (min-width: 900px) {
  .league {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  }
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  text-align: center;
  padding: 2rem 0;
}

/* ── Slide transitions (direction-aware) ── */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease;
}
.slide-next-leave-active,
.slide-prev-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.slide-next-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-next-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-prev-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-prev-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* ── Title flip ── */
.flip-next-enter-active,
.flip-next-leave-active,
.flip-prev-enter-active,
.flip-prev-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.flip-next-enter-from {
  transform: translateX(16px);
  opacity: 0;
}
.flip-next-leave-to {
  transform: translateX(-16px);
  opacity: 0;
}
.flip-prev-enter-from {
  transform: translateX(-16px);
  opacity: 0;
}
.flip-prev-leave-to {
  transform: translateX(16px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active,
  .flip-next-enter-active,
  .flip-next-leave-active,
  .flip-prev-enter-active,
  .flip-prev-leave-active {
    transition: opacity 0.2s ease;
  }
  .slide-next-enter-from,
  .slide-next-leave-to,
  .slide-prev-enter-from,
  .slide-prev-leave-to {
    transform: none;
  }
}
</style>
