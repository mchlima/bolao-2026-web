<script setup lang="ts">
import type { GroupStandings, StandingsRow } from '~/types/api';

const props = withDefaults(
  defineProps<{
    groups: GroupStandings[];
    // Positions that advance directly from each group (top N).
    qualifyCount?: number;
    // Show the cross-group "best 3rd-placed" ranking (World Cup 2026 format).
    bestThirds?: number;
  }>(),
  { qualifyCount: 2, bestThirds: 0 },
);

// Third-placed team of every group, ranked across groups (points → SG → GP).
// Display approximation of the FIFA combination table; the actual slot assignment
// is resolved server-side / by admin.
const thirds = computed<StandingsRow[]>(() => {
  if (!props.bestThirds) return [];
  return props.groups
    .map((g) => g.rows[2])
    .filter((r): r is StandingsRow => !!r)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.team.name.localeCompare(b.team.name, 'pt-BR'),
    )
    // Re-rank 1..12 across groups (each row otherwise carries position 3 from its
    // own group). This drives both the "#" column and the top-8 highlight.
    .map((r, i) => ({ ...r, position: i + 1 }));
});
</script>

<template>
  <div class="gs">
    <section class="block">
      <h3 class="font-display">Grupos</h3>
      <p class="hint">
        Os {{ qualifyCount }} primeiros de cada grupo avançam<template v-if="bestThirds > 0">; o 3º pode avançar como melhor terceiro</template>.
      </p>
      <div class="grid">
        <StandingsTable
          v-for="g in groups"
          :key="g.groupId"
          :title="`Grupo ${g.groupName}`"
          :rows="g.rows"
          :qualify-count="qualifyCount"
          :yellow-from="bestThirds > 0 ? 3 : 0"
          :yellow-to="bestThirds > 0 ? 3 : 0"
          yellow-label="Pode avançar (melhor 3º)"
          :show-legend="false"
          compact
        />
      </div>
      <!-- one shared legend at the end of the group listing -->
      <div v-if="qualifyCount > 0 || bestThirds > 0" class="legend">
        <span v-if="qualifyCount > 0" class="lg"><span class="dot green" /> Classificação direta</span>
        <span v-if="bestThirds > 0" class="lg"><span class="dot yellow" /> Pode avançar como melhor 3º</span>
      </div>
    </section>

    <section v-if="thirds.length" class="block">
      <h3 class="font-display">Melhores 3º colocados</h3>
      <p class="hint">Os {{ bestThirds }} melhores avançam ao mata-mata.</p>
      <StandingsTable
        :rows="thirds"
        :yellow-from="1"
        :yellow-to="bestThirds"
        yellow-label="Avança ao mata-mata"
        :show-legend="false"
        compact
      />
      <div class="legend">
        <span class="lg"><span class="dot yellow" /> Avança ao mata-mata</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.block + .block {
  margin-top: 22px;
}
.block h3 {
  font-weight: 700;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.hint {
  color: var(--muted);
  font-size: 12.5px;
  margin: 2px 0 10px;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  font-size: 11.5px;
  color: var(--muted);
  margin-top: 12px;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 11px;
  height: 11px;
  border-radius: 3px;
}
.dot.green {
  background: rgba(31, 157, 85, 0.6);
}
.dot.yellow {
  background: rgba(232, 176, 7, 0.78);
}
</style>
