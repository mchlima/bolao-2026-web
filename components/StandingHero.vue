<script setup lang="ts">
import type { RankingEntry } from '~/types/api';
// Member standing card (position + points/cravadas/pontuadas). Shared by the pool
// home, the início's standings slider and the pool home — pass the ranking's
// `currentUser` (or null) + total, plus where the "fazer palpites" CTA should go
// when the user hasn't predicted yet. `title` is the scope name (pool name, or
// "GERAL" for the season-wide ranking) and replaces the old "Sua posição" eyebrow;
// `subtitle` is the Season name, rendered as a chip. Both default to the legacy
// "Sua posição" caption / no chip so existing call sites keep working.
// Classes are `sh-*` prefixed: a generic `.hero` collides with the parent page's
// scoped `.hero` (Vue leaks the parent scope id onto a child's root element).
withDefaults(
  defineProps<{
    me: RankingEntry | null;
    total: number;
    ctaTo: string;
    title?: string;
    subtitle?: string | null;
  }>(),
  { title: 'Sua posição', subtitle: null },
);
</script>

<template>
  <div class="sh-card">
    <div class="sh-head">
      <span class="sh-cap">{{ title }}</span>
      <span v-if="subtitle" class="sh-chip">{{ subtitle }}</span>
    </div>
    <div class="sh-rank font-display">
      <template v-if="me">
        <span class="num">{{ me.rank }}</span><span class="ord">º</span>
        <span class="sh-of">de {{ total }} {{ total === 1 ? 'participante' : 'participantes' }}</span>
      </template>
      <span v-else class="num dim">—</span>
    </div>

    <div class="sh-stats">
      <div class="sh-stat">
        <span class="sh-statn font-display">{{ me?.points ?? 0 }}</span>
        <span class="sh-statl">pontos</span>
      </div>
      <div class="sh-stat">
        <span class="sh-statn font-display">{{ me?.exactCount ?? 0 }}</span>
        <span class="sh-statl">cravadas</span>
      </div>
      <div class="sh-stat">
        <span class="sh-statn font-display">{{ me?.scoredCount ?? 0 }}</span>
        <span class="sh-statl">pontuadas</span>
      </div>
    </div>

    <NuxtLink v-if="!me" :to="ctaTo" class="sh-cta">
      Você ainda não palpitou — fazer palpites
      <AppIcon name="chevronRight" :size="14" :stroke="2.6" />
    </NuxtLink>
  </div>
</template>

<style scoped>
.sh-card {
  background: var(--grad-pitch);
  border-radius: 18px;
  padding: 20px;
  color: #fff;
}
.sh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sh-cap {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.sh-chip {
  flex: none;
  max-width: 50%;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 4px 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-rank {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-top: 6px;
}
.sh-rank .num {
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
}
.sh-rank .num.dim {
  opacity: 0.7;
}
.sh-rank .ord {
  font-size: 26px;
  font-weight: 700;
}
.sh-of {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  margin-left: 10px;
  align-self: center;
}
.sh-stats {
  display: flex;
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
.sh-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sh-stat + .sh-stat {
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  padding-left: 16px;
}
.sh-statn {
  font-size: 23px;
  font-weight: 700;
  line-height: 1;
}
.sh-statl {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.74);
}
.sh-cta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 16px;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
