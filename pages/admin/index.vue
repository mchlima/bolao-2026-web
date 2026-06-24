<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

// Período selecionado (reflete no gráfico). Padrão: mês atual desde o dia 1 → hoje.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _now = new Date();
const range = ref({
  from: ymd(new Date(_now.getFullYear(), _now.getMonth(), 1)),
  to: ymd(_now),
});

// Live presence (quem está conectado no SSE agora). Polled — presence isn't
// an emitted event. The endpoint identifies whoever it can; the rest only
// counts toward the total.
interface Online {
  total: number;
  devices: number;
  others: number;
  users: { id: string; name: string; avatarUrl: string | null; devices: number; since: string }[];
}
const online = ref<Online | null>(null);
let onlineTimer: ReturnType<typeof setInterval> | undefined;
async function loadOnline(): Promise<void> {
  try {
    online.value = await useApi()<Online>('/admin/dashboard/online');
  } catch {
    /* transient: keep the last snapshot */
  }
}
const onlineOthers = computed(() => online.value?.others ?? 0);
onMounted(() => {
  loadOnline();
  onlineTimer = setInterval(loadOnline, 10000);
});
onBeforeUnmount(() => {
  if (onlineTimer) clearInterval(onlineTimer);
});
</script>

<template>
  <div>
    <AdminPageHeader title="Dashboard" subtitle="Visão geral do torneio e atalhos rápidos.">
      <template #actions>
        <AdminDateRange v-model="range" />
      </template>
    </AdminPageHeader>

    <AdminPredictionsChart :from="range.from" :to="range.to" />

    <AdminSpendChart :from="range.from" :to="range.to" />

    <div class="card online">
      <div class="on-head">
        <span class="on-dot" />
        <span class="font-numeric on-num">{{ online?.total ?? 0 }}</span>
        <span class="on-lbl">
          {{ (online?.total ?? 0) === 1 ? 'pessoa online' : 'pessoas online' }}
          <span class="on-sub">· {{ online?.devices ?? 0 }} {{ (online?.devices ?? 0) === 1 ? 'dispositivo' : 'dispositivos' }}</span>
        </span>
      </div>
      <div v-if="online?.users.length" class="on-people">
        <span
          v-for="u in online.users"
          :key="u.id"
          class="on-person"
          :title="u.devices > 1 ? `${u.name} · ${u.devices} dispositivos` : u.name"
        >
          <UserAvatar :name="u.name" :src="u.avatarUrl" :size="26" />
          <span class="on-name">{{ u.name }}</span>
          <span v-if="u.devices > 1" class="on-tabs">{{ u.devices }}</span>
        </span>
        <span v-if="onlineOthers" class="on-others">+{{ onlineOthers }} não identificados</span>
      </div>
      <div v-else class="on-empty">
        <template v-if="online && online.total">
          {{ online.total }} {{ online.total === 1 ? 'dispositivo anônimo' : 'dispositivos anônimos' }} (deslogados)
        </template>
        <template v-else>Ninguém online no momento.</template>
      </div>
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
.online {
  padding: 16px 18px;
  margin-bottom: 16px;
}
.on-head {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.on-dot {
  align-self: center;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--emerald) 70%, transparent);
  animation: on-pulse 2s infinite;
}
@keyframes on-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--emerald) 55%, transparent); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.on-num {
  font-size: var(--fs-3xl);
  line-height: 1;
  font-weight: 800;
}
.on-lbl {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.on-sub {
  opacity: 0.7;
  font-weight: 500;
}
.on-people {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.on-person {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px 4px 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-base);
  font-size: var(--fs-sm);
  font-weight: 600;
  max-width: 100%;
}
.on-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.on-tabs {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 6px;
}
.on-others {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}
.on-empty {
  margin-top: 10px;
  font-size: var(--fs-sm);
  color: var(--muted);
}
.shortcuts {
  margin-top: 16px;
  padding: 18px;
}
.shortcuts h3 {
  font-weight: 600;
  font-size: var(--fs-base);
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
  font-size: var(--fs-sm);
  font-weight: 700;
}
.sc-tx small {
  font-size: var(--fs-xs);
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
