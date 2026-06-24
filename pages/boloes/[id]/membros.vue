<script setup lang="ts">
import type { PoolMemberView } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const pools = usePools();
const ui = useUiStore();
const auth = useAuthStore();

const pool = usePoolData(id);
const refresh = () => refreshPoolData(id);

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro',
};
const myId = computed(() => auth.user?.id);
const myRole = computed(() => pool.value?.myRole);
const isOwner = computed(() => myRole.value === 'OWNER');

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}

async function setRole(m: PoolMemberView, role: 'ADMIN' | 'MEMBER') {
  try {
    await pools.setMemberRole(id, m.user.id, role);
    await refresh();
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
async function kick(m: PoolMemberView) {
  const ok = await ui.confirm({
    title: 'Remover membro',
    msg: `Remover ${m.user.name} do bolão?`,
    confirmLabel: 'Remover',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.removeMember(id, m.user.id);
    await refresh();
    ui.toast('success', 'Membro removido.');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
async function makeOwner(m: PoolMemberView) {
  const ok = await ui.confirm({
    title: 'Transferir posse',
    msg: `${m.user.name} passará a ser o dono. Você vira admin.`,
    confirmLabel: 'Transferir',
  });
  if (!ok) return;
  try {
    await pools.transfer(id, m.user.id);
    await refresh();
    ui.toast('success', 'Posse transferida.');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
</script>

<template>
  <section class="list">
    <div v-for="m in pool?.members ?? []" :key="m.user.id" class="mrow">
      <span class="av" :style="{ background: color(m.user.id) }">
        <img v-if="m.user.avatarUrl" class="av-img" :src="m.user.avatarUrl" alt="" >
        <template v-else>{{ initials(m.user.name) }}</template>
      </span>
      <div class="m-info">
        <span class="m-name">
          {{ m.user.name }}
          <span v-if="m.user.id === myId" class="me-tag">você</span>
        </span>
        <span class="m-role">{{ ROLE_LABEL[m.role] }}</span>
      </div>
      <div v-if="m.user.id !== myId" class="m-actions">
        <template v-if="isOwner && m.role !== 'OWNER'">
          <button v-if="m.role === 'MEMBER'" class="mini" @click="setRole(m, 'ADMIN')">Tornar admin</button>
          <button v-else class="mini" @click="setRole(m, 'MEMBER')">Rebaixar</button>
          <button class="mini" @click="makeOwner(m)">Tornar dono</button>
          <button class="mini danger" @click="kick(m)">Remover</button>
        </template>
        <template v-else-if="myRole === 'ADMIN' && m.role === 'MEMBER'">
          <button class="mini danger" @click="kick(m)">Remover</button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.av {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-sm);
  flex: 0 0 auto;
}
.av-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.m-info {
  flex: 1;
  min-width: 0;
}
.m-name {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.me-tag {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 5px;
  padding: 1px 5px;
  margin-left: 5px;
}
.m-role {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
}
.m-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
.mini {
  padding: 6px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--muted);
}
.mini.danger {
  color: var(--scarlet);
}
</style>
