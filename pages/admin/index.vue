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

interface Metric {
  value: number;
  label: string;
  icon: string;
  color: string;
  extra?: string;
  to: string;
}
const metrics = computed<Metric[]>(() => {
  const d = data.value;
  if (!d) return [];
  return [
    { value: d.tournaments, label: 'Torneios', icon: 'calendar', color: 'var(--emerald)', to: '/admin/tournaments' },
    { value: d.matches.total, label: 'Partidas', icon: 'ball', color: 'var(--azure)', extra: `${d.matches.byStatus.LIVE ?? 0} ao vivo`, to: '/admin/matches' },
    { value: d.predictions, label: 'Palpites', icon: 'star', color: 'var(--gold)', to: '/admin/matches' },
    { value: d.users.total, label: 'Usuários', icon: 'users', color: 'var(--magenta)', extra: `${d.users.active} ativos`, to: '/admin/users' },
    { value: d.teams, label: 'Times', icon: 'shield', color: 'var(--emerald)', to: '/admin/teams' },
    { value: d.stadiums, label: 'Estádios', icon: 'stadium', color: 'var(--azure)', to: '/admin/stadiums' },
  ];
});
</script>

<template>
  <div>
    <AdminPageHeader title="Dashboard" subtitle="Visão geral do torneio e atalhos rápidos." />

    <div v-if="!data" class="metrics">
      <div v-for="i in 6" :key="i" class="card metric sk"><div class="skeleton" style="height: 42px; width: 42px; border-radius: 12px" /><div class="skeleton" style="height: 40px; width: 70px; margin-top: 16px" /><div class="skeleton" style="height: 12px; width: 90px; margin-top: 8px" /></div>
    </div>
    <div v-else class="metrics">
      <NuxtLink v-for="m in metrics" :key="m.label" :to="m.to" class="card metric">
        <div class="blob" :style="{ background: m.color }" />
        <div class="icon" :style="{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }">
          <AppIcon :name="m.icon" :size="22" />
        </div>
        <div class="font-numeric val">{{ m.value }}</div>
        <div class="lbl">{{ m.label }}<span v-if="m.extra" class="extra"> · {{ m.extra }}</span></div>
      </NuxtLink>
    </div>

    <div class="card shortcuts">
      <h3 class="font-display">Atalhos</h3>
      <div class="sc-row">
        <NuxtLink to="/admin/matches?new=1" class="sc">
          <span class="sc-ic emerald"><AppIcon name="ball" :size="18" /></span>
          <span class="sc-tx"><b>Nova partida</b><small>Cadastrar um jogo</small></span>
        </NuxtLink>
        <NuxtLink to="/admin/tournaments?new=1" class="sc">
          <span class="sc-ic azure"><AppIcon name="calendar" :size="18" /></span>
          <span class="sc-tx"><b>Novo torneio</b><small>Abrir uma edição</small></span>
        </NuxtLink>
        <NuxtLink to="/admin/live" class="sc live">
          <span class="sc-ic scarlet"><AppIcon name="live" :size="18" /><span class="dot" /></span>
          <span class="sc-tx"><b>Controle ao vivo</b><small>Acompanhar jogos</small></span>
        </NuxtLink>
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
  display: block;
  padding: 18px;
  position: relative;
  overflow: hidden;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}
a.metric:hover {
  transform: translateY(-2px);
  border-color: var(--muted);
}
.metric.sk {
  pointer-events: none;
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
  width: 44px;
  height: 44px;
  border-radius: 13px;
  display: grid;
  place-items: center;
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
  margin-top: 4px;
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
  margin-bottom: 14px;
}
.sc-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 10px;
}
.sc {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--bg-base);
  transition: border-color 0.13s, transform 0.05s;
}
.sc:hover {
  border-color: var(--muted);
}
.sc:active {
  transform: translateY(1px);
}
.sc.live:hover {
  border-color: color-mix(in srgb, var(--scarlet) 55%, var(--border));
}
.sc-ic {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  flex: none;
}
.sc-ic.emerald { color: var(--emerald); background: color-mix(in srgb, var(--emerald) 14%, transparent); }
.sc-ic.azure { color: var(--azure); background: color-mix(in srgb, var(--azure) 14%, transparent); }
.sc-ic.scarlet { color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); }
.sc-tx {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sc-tx b {
  font-size: 14px;
  font-weight: 700;
}
.sc-tx small {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
.dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}
</style>
