<script setup lang="ts">
import type { User } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const auth = useAuthStore();
const tz = useTz();

const roleFilter = ref<'' | 'ADMIN' | 'USER'>('');
const { page, search, data, load } = useAdminList<User>('/admin/users', () =>
  roleFilter.value ? `role=${roleFilter.value}` : '',
);
watch(roleFilter, () => { page.value = 1; load(); });

const COLS: AdminColumn[] = [
  { key: 'user', label: 'Usuário' },
  { key: 'role', label: 'Papel' },
  { key: 'access', label: 'Acesso' },
  { key: 'since', label: 'Membro desde', mobileHide: true },
  { key: 'actions', label: 'Ações', align: 'end' },
];

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
function tzLabel(tz: string) {
  return (tz?.split('/').pop() ?? tz)?.replace(/_/g, ' ') || '—';
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

// ── enviar notificação personalizada (agora ou agendada) ──
const notifyFor = ref<User | null>(null);
const notifyForm = reactive({ title: '', body: '', url: '', schedule: false, sendAt: '' });
const sendingNotif = ref(false);

// datetime-local default = agora + 1h, no horário LOCAL do navegador do admin.
function defaultSendAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function openNotify(u: User) {
  Object.assign(notifyForm, { title: '', body: '', url: '', schedule: false, sendAt: defaultSendAt() });
  notifyFor.value = u;
}
function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}
async function sendNotify() {
  if (!notifyFor.value) return;
  if (!notifyForm.title.trim() || !notifyForm.body.trim()) {
    return ui.toast('error', 'Título e mensagem são obrigatórios.');
  }
  let sendAt: string | undefined;
  if (notifyForm.schedule) {
    const when = new Date(notifyForm.sendAt);
    if (!notifyForm.sendAt || Number.isNaN(when.getTime())) return ui.toast('error', 'Escolha uma data e hora válidas.');
    if (when.getTime() <= Date.now()) return ui.toast('error', 'O agendamento precisa ser no futuro.');
    sendAt = when.toISOString();
  }
  sendingNotif.value = true;
  try {
    const res = await useApi()<{ sendAt: string; immediate: boolean }>(
      `/admin/users/${notifyFor.value.id}/notifications`,
      { method: 'POST', body: { title: notifyForm.title.trim(), body: notifyForm.body.trim(), url: notifyForm.url.trim() || undefined, sendAt } },
    );
    ui.toast('success', res.immediate ? 'Notificação enviada.' : `Notificação agendada para ${fmtWhen(res.sendAt)}.`);
    notifyFor.value = null;
  } catch (e) { err(e); }
  finally { sendingNotif.value = false; }
}

// All row actions, unified into one "⋮" menu. Notification entry only when the
// user has push enabled.
function actionsFor(u: User): MenuItem[] {
  const items: MenuItem[] = [];
  items.push({ key: 'notify', label: 'Enviar notificação', icon: 'bell', tone: 'emerald', onSelect: () => openNotify(u) });
  items.push({
    key: 'role',
    label: u.role === 'ADMIN' ? 'Remover admin' : 'Promover a admin',
    icon: 'star',
    tone: 'gold',
    onSelect: () => toggleRole(u),
  });
  items.push({ key: 'pwd', label: 'Gerar nova senha', icon: 'refresh', tone: 'azure', onSelect: () => resetPassword(u) });
  items.push({
    key: 'active',
    label: u.isActive ? 'Desativar acesso' : 'Reativar acesso',
    icon: 'power',
    tone: u.isActive ? 'danger' : 'emerald',
    onSelect: () => toggleActive(u),
  });
  return items;
}

onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader title="Usuários" subtitle="Gerencie papéis, acesso e senhas dos usuários." />

    <div class="card adm-panel">
      <div class="adm-toolbar">
        <div class="grow"><AdminSearchBar v-model="search" placeholder="Buscar nome ou e-mail…" /></div>
        <div class="adm-chips">
          <button class="adm-chip" :class="{ on: roleFilter === '' }" @click="roleFilter = ''">Todos</button>
          <button class="adm-chip" :class="{ on: roleFilter === 'ADMIN' }" @click="roleFilter = 'ADMIN'">Admins</button>
          <button class="adm-chip" :class="{ on: roleFilter === 'USER' }" @click="roleFilter = 'USER'">Comuns</button>
        </div>
      </div>

      <AdminTable :columns="COLS" :rows="data?.data" grid="minmax(0,1fr) 96px 104px 150px auto" empty="Nenhum usuário." empty-icon="users">
        <template #col-user="{ row }">
          <span class="who">
            <span class="av" :style="{ background: color(row.id), opacity: row.isActive ? 1 : 0.5 }"><img v-if="row.avatarUrl" class="av-img" :src="row.avatarUrl" alt="" ><template v-else>{{ initials(row.name) }}</template></span>
            <span class="info"><span class="nm">{{ row.name }}<span v-if="row.id === auth.user?.id" class="metag">você</span></span><span class="em">{{ row.email }}</span></span>
          </span>
        </template>
        <template #col-role="{ row }">
          <StatusPill v-if="row.role === 'ADMIN'" label="Admin" tone="gold" soft />
          <span v-else class="comum">Comum</span>
        </template>
        <template #col-access="{ row }">
          <StatusPill :label="row.isActive ? 'Ativo' : 'Inativo'" :tone="row.isActive ? 'emerald' : 'scarlet'" dot />
        </template>
        <template #col-since="{ row }">
          <span class="since">{{ formatDate(row.createdAt, tz) }}<span class="tz"><AppIcon name="clock" :size="11" :stroke="2" /> {{ tzLabel(row.timezone) }}</span></span>
        </template>
        <template #col-actions="{ row }">
          <div class="acts">
            <KebabMenu :items="actionsFor(row)" :size="30" />
          </div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="notifyFor" :title="`Notificar ${notifyFor.name}`" @close="notifyFor = null">
      <p v-if="!notifyFor.pushEnabled" class="nt-warn">
        <AppIcon name="bell" :size="15" :stroke="2" />
        <span>Este usuário não tem notificações push ativadas — a mensagem chegará <strong>apenas no app</strong> (sininho/inbox).</span>
      </p>
      <div class="adm-form nt-form">
        <label>Título</label>
        <input v-model="notifyForm.title" class="input" maxlength="120" placeholder="Ex.: Não esqueça o seu palpite!" />
        <label>Mensagem</label>
        <textarea v-model="notifyForm.body" class="input nt-area" rows="3" maxlength="500" placeholder="Texto da notificação…" />
        <label>Link (opcional)</label>
        <input v-model="notifyForm.url" class="input" placeholder="/futebol/agenda  ·  abre ao tocar na notificação" />
        <label>Envio</label>
        <div class="adm-chips">
          <button type="button" class="adm-chip" :class="{ on: !notifyForm.schedule }" @click="notifyForm.schedule = false">Agora</button>
          <button type="button" class="adm-chip" :class="{ on: notifyForm.schedule }" @click="notifyForm.schedule = true">Agendar</button>
        </div>
        <template v-if="notifyForm.schedule">
          <label>Data e hora</label>
          <input v-model="notifyForm.sendAt" type="datetime-local" class="input" />
          <p class="nt-hint">No seu horário local. Despachada no minuto agendado.</p>
        </template>
        <p v-else class="nt-hint">Enviada imediatamente.</p>
      </div>
      <template #footer>
        <button class="btn" @click="notifyFor = null">Cancelar</button>
        <button class="btn btn-primary" :disabled="sendingNotif" @click="sendNotify">{{ notifyForm.schedule ? 'Agendar' : 'Enviar agora' }}</button>
      </template>
    </AppModal>

    <AppModal v-if="tempPassword" title="Senha temporária" @close="tempPassword = null">
      <p class="tp-msg">Senha temporária gerada para <strong>{{ tempPassword.name }}</strong>. Anote e repasse — ela não será exibida novamente.</p>
      <div class="tp-box font-numeric">{{ tempPassword.password }}</div>
      <template #footer>
        <button class="btn btn-primary" @click="tempPassword = null">Entendi</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.who { display: flex; align-items: center; gap: 11px; min-width: 0; }
.av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 12px; flex: 0 0 auto; }
.av-img { width: 100%; height: 100%; object-fit: cover; }
.info { min-width: 0; }
.nm { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.metag { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #0a0e14; background: var(--gold); border-radius: 5px; padding: 1px 5px; }
.em { display: block; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.comum { font-size: 12px; color: var(--muted); font-weight: 600; }
.since { display: flex; flex-direction: column; gap: 2px; font-size: 12px; font-weight: 600; color: var(--text); }
.tz { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acts { display: flex; gap: 5px; justify-content: flex-end; }
.nt-form { display: flex; flex-direction: column; gap: 6px; }
.nt-form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 6px; }
.nt-area { resize: vertical; min-height: 70px; font: inherit; }
.nt-hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
.nt-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text);
  background: color-mix(in srgb, var(--gold) 12%, var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--border));
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.nt-warn :deep(svg) { color: var(--gold); flex: none; margin-top: 1px; }
.tp-msg { color: var(--muted); font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
.tp-box { font-size: 28px; letter-spacing: 0.1em; text-align: center; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
</style>
