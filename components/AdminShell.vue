<script setup lang="ts">
const route = useRoute();
const tabs = [
  { to: '/admin', label: 'Dashboard', exact: true },
  { to: '/admin/competitions', label: 'Competições' },
  { to: '/admin/tournaments', label: 'Torneios' },
  { to: '/admin/structure', label: 'Estrutura' },
  { to: '/admin/matches', label: 'Partidas' },
  { to: '/admin/teams', label: 'Times' },
  { to: '/admin/stadiums', label: 'Estádios' },
  { to: '/admin/users', label: 'Usuários' },
  { to: '/admin/live', label: 'Controle ao vivo', live: true },
];
function active(t: { to: string; exact?: boolean }) {
  return t.exact ? route.path === t.to : route.path.startsWith(t.to);
}
</script>

<template>
  <div class="admin">
    <div class="head">
      <span class="badge">Admin</span>
      <h1 class="font-display">Painel de controle</h1>
    </div>
    <div class="tabs">
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="tab"
        :class="{ on: active(t), live: t.live }"
      >
        <span v-if="t.live" class="dot" />{{ t.label }}
      </NuxtLink>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.admin {
  padding: 18px 0 40px;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.badge {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 6px;
  padding: 4px 8px;
}
.head h1 {
  font-weight: 700;
  font-size: clamp(20px, 4vw, 26px);
  text-transform: uppercase;
}
.tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  margin-bottom: 22px;
}
.tab {
  white-space: nowrap;
  padding: 9px 15px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
.tab.live.on {
  background: var(--scarlet);
}
.tab.live {
  color: var(--scarlet);
  border-color: rgba(232, 54, 43, 0.5);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: liveDot 1.2s infinite;
}
.tab.on .dot {
  background: #fff;
}
</style>
