<script setup lang="ts">
import type { Paginated, Tournament } from '~/types/api';

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'var(--muted)' },
  UPCOMING: { label: 'Em breve', color: 'var(--azure)' },
  ONGOING: { label: 'Em andamento', color: 'var(--emerald)' },
  FINISHED: { label: 'Encerrado', color: 'var(--muted)' },
};
const GRADS = ['var(--grad-pitch)', 'var(--grad-trophy)', 'var(--grad-live)'];

function tBadge(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^fifa$/i.test(w) && !/^\d+$/.test(w));
  return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
}

const { data, pending } = await useAsyncData('tournaments', async () => {
  const list = await useApi()<Paginated<Tournament>>('/seasons');
  return list.data;
});
</script>

<template>
  <div class="page">
    <PageHeader
      title="Torneios"
      subtitle="Escolha um torneio para palpitar e acompanhar o ranking."
    />
    <SkeletonList v-if="pending && !data" variant="card" :count="3" />
    <EmptyState
      v-else-if="!data?.length"
      icon="calendar"
      title="Nenhum torneio disponível"
      description="Ainda não há torneios para palpitar. Volte em breve!"
    />
    <div v-else class="grid">
      <NuxtLink
        v-for="(t, i) in data ?? []"
        :key="t.id"
        :to="`/futebol/torneios/${t.id}`"
        class="t-card"
      >
        <div class="t-top">
          <span class="t-badge font-display" :style="{ background: GRADS[i % GRADS.length] }">
            {{ tBadge(t.name) }}
          </span>
          <div class="t-info">
            <div class="t-name font-display">{{ t.name }}</div>
            <div v-if="t.startDate" class="t-dates">
              {{ formatDate(t.startDate, 'UTC') }} — {{ formatDate(t.endDate, 'UTC') }}
            </div>
          </div>
        </div>
        <div class="t-foot">
          <span
            class="pill"
            :style="{ color: (STATUS[t.status] ?? STATUS.DRAFT).color, borderColor: (STATUS[t.status] ?? STATUS.DRAFT).color }"
          >
            {{ (STATUS[t.status] ?? STATUS.DRAFT).label }}
          </span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 22px 0 40px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
}
.t-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
  transition: transform 0.15s, border-color 0.15s;
}
.t-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--emerald) 50%, var(--border));
}
.t-top {
  display: flex;
  align-items: center;
  gap: 13px;
}
.t-badge {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-weight: 700;
  color: #fff;
  font-size: 15px;
}
.t-info {
  min-width: 0;
  flex: 1;
}
.t-name {
  font-weight: 600;
  font-size: 16.5px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-dates {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 3px;
}
.t-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.pill {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 11px;
}
</style>
