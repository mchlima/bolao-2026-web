<script setup lang="ts">
import type { User } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();
const auth = useAuthStore();

const roleFilter = ref<'' | 'ADMIN' | 'USER'>('');
const { page, search, data, load } = useAdminList<User>('/admin/users', () =>
  roleFilter.value ? `role=${roleFilter.value}` : '',
);
watch(roleFilter, () => { page.value = 1; load(); });

const tempPassword = ref<{ name: string; password: string } | null>(null);

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

async function toggleRole(u: User) {
  const promoting = u.role !== 'ADMIN';
  const ok = await ui.confirm({
    title: promoting ? 'Promover a admin' : 'Remover admin',
    msg: `${promoting ? 'Conceder' : 'Remover'} acesso de administrador para ${u.name}?`,
    confirmLabel: promoting ? 'Promover' : 'Rebaixar',
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/users/${u.id}/role`, { method: 'PATCH', body: { role: promoting ? 'ADMIN' : 'USER' } });
    ui.toast('success', `${u.name} ${promoting ? 'agora é admin' : 'não é mais admin'}`);
    await load();
  } catch (e) { err(e); }
}

async function toggleActive(u: User) {
  const disabling = u.isActive;
  if (disabling) {
    const ok = await ui.confirm({ title: 'Desativar acesso', msg: `Desativar o acesso de ${u.name}?`, confirmLabel: 'Desativar', danger: true });
    if (!ok) return;
  }
  try {
    await useApi()(`/admin/users/${u.id}/active`, { method: 'PATCH', body: { isActive: !disabling } });
    ui.toast(disabling ? 'info' : 'success', `${u.name} ${disabling ? 'teve o acesso desativado' : 'teve o acesso reativado'}`);
    await load();
  } catch (e) { err(e); }
}

async function resetPassword(u: User) {
  const ok = await ui.confirm({ title: 'Gerar nova senha', msg: `Gerar uma senha temporária para ${u.name}?`, confirmLabel: 'Gerar senha' });
  if (!ok) return;
  try {
    const res = await useApi()<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`, { method: 'POST' });
    tempPassword.value = { name: u.name, password: res.temporaryPassword };
  } catch (e) { err(e); }
}

onMounted(load);
</script>

<template>
  <AdminShell>
    <div class="card panel">
      <div class="p-head"><h3 class="font-display">Usuários</h3></div>
      <div class="filters">
        <input v-model="search" class="input" placeholder="Buscar nome ou e-mail" />
        <div class="chips">
          <button class="chip" :class="{ on: roleFilter === '' }" @click="roleFilter = ''">Todos</button>
          <button class="chip" :class="{ on: roleFilter === 'ADMIN' }" @click="roleFilter = 'ADMIN'">Admins</button>
          <button class="chip" :class="{ on: roleFilter === 'USER' }" @click="roleFilter = 'USER'">Comuns</button>
        </div>
      </div>

      <div class="rows">
        <div class="rhead"><span>Usuário</span><span>Papel</span><span>Acesso</span><span class="ar">Ações</span></div>
        <div v-for="u in data?.data ?? []" :key="u.id" class="row">
          <span class="who">
            <span class="av" :style="{ background: color(u.id), opacity: u.isActive ? 1 : 0.5 }">{{ initials(u.name) }}</span>
            <span class="info"><span class="nm">{{ u.name }}<span v-if="u.id === auth.user?.id" class="metag">você</span></span><span class="em">{{ u.email }}</span></span>
          </span>
          <span><span v-if="u.role === 'ADMIN'" class="adm">Admin</span><span v-else class="comum">Comum</span></span>
          <span class="acc" :style="{ color: u.isActive ? 'var(--emerald)' : 'var(--scarlet)' }"><span class="d" :style="{ background: u.isActive ? 'var(--emerald)' : 'var(--scarlet)' }" />{{ u.isActive ? 'Ativo' : 'Inativo' }}</span>
          <span class="acts">
            <button class="ic" :style="{ color: u.role === 'ADMIN' ? 'var(--gold)' : 'var(--muted)' }" :title="u.role === 'ADMIN' ? 'Remover admin' : 'Promover a admin'" @click="toggleRole(u)">★</button>
            <button class="ic" style="color: var(--azure)" title="Gerar nova senha" @click="resetPassword(u)">⟳</button>
            <button class="ic" :style="{ color: u.isActive ? 'var(--scarlet)' : 'var(--emerald)' }" :title="u.isActive ? 'Desativar' : 'Reativar'" @click="toggleActive(u)">⏻</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhum usuário.</p>
      </div>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="tempPassword" title="Senha temporária" @close="tempPassword = null">
      <p class="tp-msg">Senha temporária gerada para <strong>{{ tempPassword.name }}</strong>. Anote e repasse — ela não será exibida novamente.</p>
      <div class="tp-box font-numeric">{{ tempPassword.password }}</div>
      <template #footer>
        <button class="btn btn-primary" @click="tempPassword = null">Entendi</button>
      </template>
    </AppModal>
  </AdminShell>
</template>

<style scoped>
.panel { padding: 16px; }
.p-head { margin-bottom: 14px; }
.p-head h3 { font-weight: 600; font-size: 17px; text-transform: uppercase; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.filters .input { flex: 1; min-width: 170px; }
.chips { display: flex; gap: 7px; }
.chip { padding: 8px 13px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.chip.on { background: var(--gold); color: #0a0e14; border-color: transparent; }
.rows { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rhead, .row { display: grid; grid-template-columns: 1fr 110px 120px 130px; gap: 10px; padding: 10px 14px; align-items: center; }
.rhead { background: var(--bg-base); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.row { border-top: 1px solid var(--border); }
.ar { text-align: right; }
.who { display: flex; align-items: center; gap: 11px; min-width: 0; }
.av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 12px; flex: 0 0 auto; }
.info { min-width: 0; }
.nm { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.metag { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #0a0e14; background: var(--gold); border-radius: 5px; padding: 1px 5px; }
.em { display: block; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.adm { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #0a0e14; background: var(--gold); border-radius: 5px; padding: 3px 8px; }
.comum { font-size: 12px; color: var(--muted); font-weight: 600; }
.acc { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; }
.d { width: 7px; height: 7px; border-radius: 50%; }
.acts { display: flex; gap: 5px; justify-content: flex-end; }
.ic { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; font-size: 14px; }
.empty { padding: 18px; text-align: center; }
.tp-msg { color: var(--muted); font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
.tp-box { font-size: 28px; letter-spacing: 0.1em; text-align: center; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
@media (max-width: 720px) { .rhead { display: none; } .row { grid-template-columns: 1fr auto; } .row > span:nth-child(2), .row > span:nth-child(3) { display: none; } }
</style>
