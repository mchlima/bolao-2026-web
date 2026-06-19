<script setup lang="ts">
import type { NotificationCampaign } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';
import { CAMPAIGN_STATUS } from '~/utils/audience';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const tz = useTz();

const { page, data, load } = useAdminList<NotificationCampaign>('/admin/campaigns');

const COLS: AdminColumn[] = [
  { key: 'campaign', label: 'Campanha' },
  { key: 'audience', label: 'Público', mobileHide: true },
  { key: 'channels', label: 'Canais', mobileHide: true },
  { key: 'status', label: 'Status' },
  { key: 'schedule', label: 'Disparo', mobileHide: true },
  { key: 'delivery', label: 'Entregas', align: 'end', mobileHide: true },
  { key: 'actions', label: '', align: 'end' },
];

const CH_LABEL: Record<string, string> = { inapp: 'In-app', push: 'Push', email: 'E-mail' };

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}
function scheduleText(c: NotificationCampaign): string {
  if (c.sentAt) return `Enviada ${fmtWhen(c.sentAt)}`;
  if (c.sendAt) return `Agendada ${fmtWhen(c.sendAt)}`;
  return '—';
}

async function dispatchNow(c: NotificationCampaign) {
  const ok = await ui.confirm({
    title: 'Disparar agora',
    msg: `Enviar "${c.title}" agora para o público definido?`,
    confirmLabel: 'Disparar',
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/campaigns/${c.id}/dispatch`, { method: 'POST', body: {} });
    ui.toast('success', 'Disparo iniciado.');
    await load();
  } catch (e) { err(e); }
}
async function cancel(c: NotificationCampaign) {
  const ok = await ui.confirm({ title: 'Cancelar campanha', msg: `Cancelar "${c.title}"?`, confirmLabel: 'Cancelar campanha', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/campaigns/${c.id}/cancel`, { method: 'POST' });
    ui.toast('info', 'Campanha cancelada.');
    await load();
  } catch (e) { err(e); }
}
async function remove(c: NotificationCampaign) {
  const ok = await ui.confirm({ title: 'Excluir campanha', msg: `Excluir "${c.title}" definitivamente?`, confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/campaigns/${c.id}`, { method: 'DELETE' });
    ui.toast('info', 'Campanha excluída.');
    await load();
  } catch (e) { err(e); }
}

function actionsFor(c: NotificationCampaign): MenuItem[] {
  const items: MenuItem[] = [];
  const editable = c.status === 'DRAFT' || c.status === 'SCHEDULED';
  if (editable) {
    items.push({ key: 'edit', label: 'Editar', icon: 'edit', tone: 'azure', onSelect: () => navigateTo(`/admin/campaigns/${c.id}`) });
    items.push({ key: 'dispatch', label: 'Disparar agora', icon: 'bell', tone: 'emerald', onSelect: () => dispatchNow(c) });
    items.push({ key: 'cancel', label: 'Cancelar', icon: 'close', tone: 'default', onSelect: () => cancel(c) });
  } else {
    items.push({ key: 'view', label: 'Ver detalhes', icon: 'eye', tone: 'azure', onSelect: () => navigateTo(`/admin/campaigns/${c.id}`) });
  }
  if (c.status !== 'SENDING') {
    items.push({ key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: () => remove(c) });
  }
  return items;
}

onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader title="Campanhas" subtitle="Notificações para grupos de usuários (in-app e push).">
      <template #actions>
        <NuxtLink to="/admin/campaigns/new" class="btn btn-primary">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> Nova campanha
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <!-- estado vazio: bloco próprio, centralizado e com CTA -->
    <div v-if="data && !data.data.length" class="card adm-panel empty-state">
      <span class="es-badge"><AppIcon name="bell" :size="30" :stroke="1.7" /></span>
      <h2 class="es-title font-display">Fale com a galera toda de uma vez</h2>
      <p class="es-text">
        Nenhuma campanha por aqui ainda. Escolha o público, escreva a mensagem e
        dispare na hora — ou deixe agendado pro momento certo.
      </p>
      <NuxtLink to="/admin/campaigns/new" class="btn btn-gold big">
        <AppIcon name="plus" :size="16" :stroke="2.4" /> Criar primeira campanha
      </NuxtLink>
    </div>

    <div v-else class="card adm-panel">
      <AdminTable :columns="COLS" :rows="data?.data" grid="minmax(0,1.4fr) 90px 120px 110px 150px 90px auto" empty="Nenhuma campanha." empty-icon="bell">
        <template #col-campaign="{ row }">
          <div class="cinfo">
            <span class="ctitle">{{ row.title }}</span>
            <span class="cbody">{{ row.body }}</span>
          </div>
        </template>
        <template #col-audience="{ row }">
          <span class="aud">{{ row.audienceAll ? 'Todos' : 'Filtro' }}</span>
        </template>
        <template #col-channels="{ row }">
          <span class="chs">{{ row.channels.map((c: string) => CH_LABEL[c] ?? c).join(' · ') }}</span>
        </template>
        <template #col-status="{ row }">
          <StatusPill :label="(CAMPAIGN_STATUS[row.status] ?? { label: row.status }).label" :tone="(CAMPAIGN_STATUS[row.status] ?? { tone: 'neutral' }).tone" dot />
        </template>
        <template #col-schedule="{ row }">
          <span class="sch">{{ scheduleText(row) }}</span>
        </template>
        <template #col-delivery="{ row }">
          <span class="dlv">{{ row.status === 'SENT' || row.status === 'SENDING' ? `${row.deliveredCount}${row.totalRecipients != null ? '/' + row.totalRecipients : ''}` : '—' }}</span>
        </template>
        <template #col-actions="{ row }">
          <div class="acts"><KebabMenu :items="actionsFor(row)" :size="30" /></div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>
  </div>
</template>

<style scoped>
.cinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ctitle { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cbody { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aud, .chs, .sch, .dlv { font-size: 12.5px; font-weight: 600; color: var(--text); }
.sch, .chs { color: var(--muted); }
.acts { display: flex; justify-content: flex-end; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 48px 24px;
}
.es-badge {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
}
.es-title { font-weight: 700; font-size: clamp(18px, 3vw, 22px); text-transform: uppercase; }
.es-text { max-width: 420px; color: var(--muted); font-size: 14px; line-height: 1.55; margin: 0; }
.empty-state .btn.big { margin-top: 6px; font-size: 14.5px; padding: 12px 20px; }
</style>
