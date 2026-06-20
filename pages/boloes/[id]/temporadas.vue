<script setup lang="ts">
import type { PoolRunWithChampion } from '~/types/api';

// Temporadas of the pool — the "hall de campeões". Each run shows its winner and
// links to its final (or live) ranking via ?run=. Computed on-read, so history
// is always available.
const route = useRoute();
const id = route.params.id as string;
const pools = usePools();

const { data: runs } = await useAsyncData(`pool-runs-${id}`, () =>
  pools.listRuns(id).catch(() => [] as PoolRunWithChampion[]),
);

function fmt(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Em andamento', cls: 'active' },
  ENDED: { label: 'Encerrada', cls: 'ended' },
  DRAFT: { label: 'Não iniciada', cls: 'draft' },
};
</script>

<template>
  <section class="temps">
    <p v-if="!runs?.length" class="muted load">Nenhuma temporada ainda.</p>

    <ul v-else class="list">
      <li v-for="r in runs" :key="r.id" class="t">
        <div class="t-head">
          <span class="t-name font-display">{{ r.label ?? 'Temporada' }}</span>
          <span class="t-badge" :class="STATUS[r.status]?.cls">{{ STATUS[r.status]?.label }}</span>
        </div>
        <div class="t-meta">
          <span>{{ r.tournament.name }}</span>
          <span v-if="r.startAt" class="dot">·</span>
          <span v-if="r.startAt">{{ fmt(r.startAt) }}<template v-if="r.endAt"> – {{ fmt(r.endAt) }}</template></span>
        </div>

        <div v-if="r.champion" class="champ">
          <span class="cr"><AppIcon name="trophy" :size="15" :stroke="2" /></span>
          <UserAvatar :name="r.champion.user.name" :src="r.champion.user.avatarUrl" :size="30" />
          <span class="champ-name">{{ r.champion.user.name }}</span>
          <span class="champ-pts">{{ r.champion.points }} pts</span>
        </div>
        <p v-else-if="r.status === 'DRAFT'" class="champ-none muted">Aguardando início.</p>
        <p v-else class="champ-none muted">Sem pontuação ainda.</p>

        <NuxtLink
          v-if="r.status !== 'DRAFT'"
          :to="`/boloes/${id}/ranking?run=${r.id}`"
          class="t-link"
        >
          Ver classificação <AppIcon name="chevronRight" :size="14" :stroke="2.5" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.t {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 15px;
  background: var(--bg-surface);
}
.t-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.t-name {
  font-weight: 700;
  font-size: 15px;
}
.t-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--muted);
  border: 1px solid var(--border);
}
.t-badge.active {
  color: var(--emerald);
  border-color: var(--emerald);
}
.t-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.dot {
  opacity: 0.5;
}
.champ {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
}
.cr {
  color: var(--gold);
  flex: none;
}
.champ-name {
  font-weight: 700;
  font-size: 14px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.champ-pts {
  font-weight: 800;
  font-size: 13px;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.champ-none {
  margin-top: 10px;
  font-size: 13px;
}
.t-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--azure);
}
</style>
