<script setup lang="ts">
import type { Match, Paginated, Prediction } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const ui = useUiStore();
const tz = useTz();
const auth = useAuthStore();

const pool = usePoolData(id);

const { data, pending, refresh } = await useAsyncData(
  `pool-matches-${id}`,
  async () => {
    const empty = { matches: [] as Match[], predictions: [] as Prediction[] };
    if (!pool.value) return empty;
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
      all.sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
      // Predictions are global/single — load the user's for this tournament so
      // the cards can show + edit them right here (same flow as the tournament page).
      let predictions: Prediction[] = [];
      if (auth.token) {
        predictions = await api<Prediction[]>(`/predictions/me?tournamentId=${tid}`);
      }
      return { matches: all, predictions };
    } catch (e) {
      ui.toast('error', poolError(e));
      return empty;
    }
  },
);

const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

const tid = computed(() => pool.value?.tournament.id);
useRealtime(
  () => (tid.value ? [`tournament:${tid.value}`] : []),
  () => refresh(),
);

// Group matches by calendar day (in the account tz) for date headers.
const matchesByDay = computed(() => {
  const out: { day: string; items: Match[] }[] = [];
  for (const m of data.value?.matches ?? []) {
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
    <SkeletonList v-if="pending && !data?.matches?.length" variant="match" :count="6" />
    <p v-else-if="!data?.matches?.length" class="muted empty">
      Nenhuma partida neste torneio ainda.
    </p>
    <template v-else>
      <div v-for="grp in matchesByDay" :key="grp.day" class="daygrp">
        <div class="dayhd">{{ grp.day }}</div>
        <MatchCard
          v-for="m in grp.items"
          :key="m.id"
          :match="m"
          :prediction="predMap[m.id] ?? null"
          :pool-id="id"
          @saved="onSaved"
        />
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
  gap: 10px;
}
.dayhd {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0 2px 2px;
}
</style>
