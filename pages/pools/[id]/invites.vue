<script setup lang="ts">
import type { PoolInviteView } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const pools = usePools();
const ui = useUiStore();
const origin = useRequestURL().origin;

const { data: pool, refresh } = await usePoolDetail(id);

const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);
// Members without manage rights don't get this tab — bounce them to the ranking.
if (pool.value && !canManage.value) {
  await navigateTo(`/pools/${id}/ranking`, { replace: true });
}

const newInvite = ref('');
const adding = ref(false);
async function addInvite() {
  if (!newInvite.value.trim()) return;
  adding.value = true;
  try {
    await pools.createInvite(id, newInvite.value.trim());
    newInvite.value = '';
    await refresh();
    ui.toast('success', 'Link criado.');
  } catch (e) {
    ui.toast('error', poolError(e));
  } finally {
    adding.value = false;
  }
}
async function toggleInvite(inv: PoolInviteView) {
  try {
    await pools.updateInvite(id, inv.id, { isActive: !inv.isActive });
    await refresh();
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
function inviteUrl(inv: PoolInviteView): string {
  return `${origin}/pools/join/${inv.code}`;
}
async function copyInvite(inv: PoolInviteView) {
  try {
    await navigator.clipboard.writeText(inviteUrl(inv));
    ui.toast('success', 'Link copiado!');
  } catch {
    ui.toast('error', 'Não foi possível copiar.');
  }
}
async function removeInvite(inv: PoolInviteView) {
  const ok = await ui.confirm({
    title: 'Remover link',
    msg: `Remover o link "${inv.name}"? Quem tiver esse link não poderá mais entrar por ele.`,
    confirmLabel: 'Remover',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.deleteInvite(id, inv.id);
    await refresh();
    ui.toast('success', 'Link removido.');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
</script>

<template>
  <section class="invites">
    <form class="add" @submit.prevent="addInvite">
      <input v-model="newInvite" class="inp" maxlength="40" placeholder="Nome do link (ex.: WhatsApp)" />
      <button class="btn btn-gold" type="submit" :disabled="adding">
        {{ adding ? '…' : '+ Criar link' }}
      </button>
    </form>

    <p v-if="!pool?.invites?.length" class="muted empty">
      Nenhum link ainda. Crie um link nomeado e compartilhe com a galera.
    </p>

    <div v-for="inv in pool?.invites ?? []" :key="inv.id" class="irow" :class="{ off: !inv.isActive }">
      <div class="i-info">
        <span class="i-name">{{ inv.name }}</span>
        <code class="i-url">{{ inviteUrl(inv) }}</code>
      </div>
      <div class="i-actions">
        <button class="mini" :disabled="!inv.isActive" @click="copyInvite(inv)">Copiar</button>
        <button class="mini" @click="toggleInvite(inv)">{{ inv.isActive ? 'Revogar' : 'Reativar' }}</button>
        <button class="mini danger" @click="removeInvite(inv)">Remover</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.invites {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.add {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}
.add .inp {
  flex: 1;
}
.inp {
  width: 100%;
  padding: 11px 13px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
}
.inp:focus {
  outline: none;
  border-color: var(--emerald);
}
.empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 13.5px;
}
.irow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.irow.off {
  opacity: 0.55;
}
.i-info {
  flex: 1;
  min-width: 0;
}
.i-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.i-url {
  display: block;
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.i-actions {
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
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--muted);
}
.mini.danger {
  color: var(--scarlet);
}
.mini:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
