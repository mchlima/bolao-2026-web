<script setup lang="ts">
import type { Match, Paginated } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const ui = useUiStore();
const tz = useTz();

const pool = usePoolData(id);

const { data: matches, pending } = await useAsyncData(
  `pool-matches-${id}`,
  async () => {
    if (!pool.value) return [] as Match[];
    try {
      const api = useApi();
      const tid = pool.value.tournament.id;
      // The API caps pageSize at 100 — page through to get every match.
      const all: Match[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await api<Paginated<Match>>(
          `/matches?tournamentId=${tid}&page=${page}&pageSize=100`,
        );
        all.push(...res.data);
        totalPages = res.pagination.totalPages;
        page++;
      } while (page <= totalPages);
      // Chronological — by kickoff (earliest first).
      return all.sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
    } catch (e) {
      ui.toast('error', poolError(e));
      return [] as Match[];
    }
  },
);

function matchPlayed(m: Match): boolean {
  return m.status === 'LIVE' || m.status === 'FINISHED';
}
function kickoffTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz.value,
  }).format(new Date(iso));
}
// Group matches by calendar day (in the account tz) for date headers.
const matchesByDay = computed(() => {
  const out: { day: string; items: Match[] }[] = [];
  for (const m of matches.value ?? []) {
    const day = formatDate(m.kickoffAt, tz.value);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(m);
    else out.push({ day, items: [m] });
  }
  return out;
});
</script>

<template>
  <section class="matches">
    <SkeletonList v-if="pending && !matches?.length" variant="row" :count="6" />
    <p v-else-if="!matches?.length" class="muted empty">
      Nenhuma partida neste torneio ainda.
    </p>
    <template v-else>
      <div v-for="grp in matchesByDay" :key="grp.day" class="daygrp">
        <div class="dayhd">{{ grp.day }}</div>
        <NuxtLink
          v-for="m in grp.items"
          :key="m.id"
          :to="`/pools/${id}/matches/${m.id}`"
          class="game"
        >
          <div class="g-side">
            <TeamBadge :team="m.homeTeam" :placeholder="m.homeSourceLabel" :size="26" />
            <span class="g-tn">{{ m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir' }}</span>
          </div>
          <div class="g-mid">
            <span v-if="matchPlayed(m)" class="g-score font-numeric">
              {{ m.homeScore }}<span class="x">:</span>{{ m.awayScore }}
            </span>
            <span v-else class="g-time">{{ kickoffTime(m.kickoffAt) }}</span>
            <span v-if="m.status === 'LIVE'" class="g-livedot" />
          </div>
          <div class="g-side end">
            <span class="g-tn end">{{ m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir' }}</span>
            <TeamBadge :team="m.awayTeam" :placeholder="m.awaySourceLabel" :size="26" />
          </div>
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.matches {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 13.5px;
}
.daygrp {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.dayhd {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0 2px 2px;
}
.game {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 13px;
  color: var(--text);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.game:hover {
  border-color: color-mix(in srgb, var(--emerald) 45%, var(--border));
}
.game:active {
  transform: scale(0.995);
}
.g-side {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.g-side.end {
  justify-content: flex-end;
}
.g-tn {
  min-width: 0;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.g-mid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
}
.g-score {
  font-size: 18px;
}
.g-score .x {
  color: var(--muted);
  margin: 0 3px;
}
.g-time {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}
.g-livedot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}
@keyframes liveDot {
  50% {
    opacity: 0.3;
  }
}
</style>
