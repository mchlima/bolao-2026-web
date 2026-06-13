<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

interface Dashboard {
  users: { total: number; active: number; admins: number };
  tournaments: number;
  teams: number;
  stadiums: number;
  matches: { total: number; byStatus: Record<string, number> };
  predictions: number;
}

const { data } = await useAsyncData('admin-dashboard', () =>
  useApi()<Dashboard>('/admin/dashboard'),
);

const metrics = computed(() => {
  const d = data.value;
  if (!d) return [];
  return [
    { value: d.tournaments, label: 'Torneios', color: 'var(--emerald)' },
    { value: d.matches.total, label: 'Partidas', color: 'var(--azure)', extra: `${d.matches.byStatus.LIVE ?? 0} ao vivo` },
    { value: d.predictions, label: 'Palpites', color: 'var(--gold)' },
    { value: d.users.total, label: 'Usuários', color: 'var(--magenta)', extra: `${d.users.active} ativos` },
    { value: d.teams, label: 'Times', color: 'var(--emerald)' },
    { value: d.stadiums, label: 'Estádios', color: 'var(--azure)' },
  ];
});
</script>

<template>
  <div>
    <AdminPageHeader title="Dashboard" subtitle="Visão geral do torneio e atalhos rápidos." />
    <div class="metrics">
      <div v-for="m in metrics" :key="m.label" class="card metric">
        <div class="blob" :style="{ background: m.color }" />
        <div class="icon" :style="{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }">●</div>
        <div class="font-numeric val">{{ m.value }}</div>
        <div class="lbl">{{ m.label }}<span v-if="m.extra" class="extra"> · {{ m.extra }}</span></div>
      </div>
    </div>

    <div class="card shortcuts">
      <h3 class="font-display">Atalhos</h3>
      <div class="sc-row">
        <NuxtLink to="/admin/matches?new=1" class="btn btn-primary">+ Nova partida</NuxtLink>
        <NuxtLink to="/admin/tournaments?new=1" class="btn">+ Novo torneio</NuxtLink>
        <NuxtLink to="/admin/live" class="btn live"><span class="dot" />Controle ao vivo</NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 14px;
}
.metric {
  padding: 18px;
  position: relative;
  overflow: hidden;
}
.blob {
  position: absolute;
  right: -10px;
  top: -10px;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  opacity: 0.1;
}
.icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 12px;
}
.val {
  font-size: 46px;
  line-height: 0.9;
  margin-top: 14px;
}
.lbl {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}
.extra {
  color: var(--muted);
}
.shortcuts {
  margin-top: 16px;
  padding: 18px;
}
.shortcuts h3 {
  font-weight: 600;
  font-size: 16px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.sc-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.live {
  color: var(--scarlet);
  border-color: rgba(232, 54, 43, 0.5);
  background: color-mix(in srgb, var(--scarlet) 14%, transparent);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}
</style>
