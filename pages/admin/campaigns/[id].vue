<script setup lang="ts">
import type { AudienceGroup, NotificationCampaign, Team } from '~/types/api';
import { CAMPAIGN_STATUS, describeNode, isAudienceGroup, newGroup } from '~/utils/audience';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const tz = useTz();

const isNew = computed(() => route.params.id === 'new');
const campaignId = ref<string | null>(isNew.value ? null : (route.params.id as string));
const loaded = ref(isNew.value);
const status = ref<NotificationCampaign['status']>('DRAFT');
const saving = ref(false);

const STEPS = ['Público', 'Conteúdo', 'Agendamento', 'Resumo'];
const step = ref(1);

function defaultSendAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const form = reactive({
  audienceAll: true,
  filter: newGroup('and') as AudienceGroup,
  title: '',
  body: '',
  url: '',
  channels: ['inapp', 'push'] as string[],
  scheduleMode: 'now' as 'now' | 'schedule',
  sendAt: defaultSendAt(),
});

// Resolved team names for chips / summary (shared with the filter components).
const teamNames = reactive<Record<string, string>>({});
provide('campaignTeams', {
  names: teamNames,
  register: (t: Team) => {
    teamNames[t.id] = t.name;
  },
});

const readOnly = computed(() => !isNew.value && status.value !== 'DRAFT' && status.value !== 'SCHEDULED');

// ── load existing ──
onMounted(async () => {
  if (isNew.value) return;
  try {
    const c = await useApi()<NotificationCampaign>(`/admin/campaigns/${campaignId.value}`);
    status.value = c.status;
    form.audienceAll = c.audienceAll;
    form.filter = c.filter && isAudienceGroup(c.filter) ? (c.filter as AudienceGroup) : newGroup('and');
    form.title = c.title;
    form.body = c.body;
    form.url = c.url ?? '';
    form.channels = c.channels.length ? c.channels : ['inapp'];
    if (c.sendAt) {
      form.scheduleMode = 'schedule';
      const d = new Date(c.sendAt);
      const p = (n: number) => String(n).padStart(2, '0');
      form.sendAt = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    await resolveTeamNames();
  } catch {
    ui.toast('error', 'Não foi possível carregar a campanha.');
  } finally {
    loaded.value = true;
  }
});

function collectTeamIds(node: AudienceGroup | { field?: string; value?: unknown }, acc: Set<string>) {
  if (isAudienceGroup(node as AudienceGroup)) {
    for (const ch of (node as AudienceGroup).children) collectTeamIds(ch as never, acc);
  } else {
    const c = node as { field?: string; value?: unknown };
    if (c.field === 'followsTeam' && Array.isArray(c.value)) for (const id of c.value as string[]) acc.add(id);
  }
}
async function resolveTeamNames() {
  const ids = new Set<string>();
  collectTeamIds(form.filter, ids);
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const t = await useApi()<Team>(`/teams/${id}`);
        teamNames[id] = t.name;
      } catch {
        /* ignore */
      }
    }),
  );
}

// ── live audience count ──
const audienceCount = ref<number | null>(null);
const counting = ref(false);
let cTimer: ReturnType<typeof setTimeout> | undefined;
function refreshCount() {
  clearTimeout(cTimer);
  counting.value = true;
  cTimer = setTimeout(async () => {
    try {
      const r = await useApi()<{ count: number }>('/admin/campaigns/audience/preview', {
        method: 'POST',
        body: { all: form.audienceAll, filter: form.audienceAll ? null : form.filter },
      });
      audienceCount.value = r.count;
    } catch {
      audienceCount.value = null;
    } finally {
      counting.value = false;
    }
  }, 400);
}
watch(
  () => [form.audienceAll, JSON.stringify(form.filter)],
  () => refreshCount(),
  { immediate: true },
);

function toggleChannel(ch: string) {
  const i = form.channels.indexOf(ch);
  if (i >= 0) form.channels.splice(i, 1);
  else form.channels.push(ch);
}

const summary = computed(() => (form.audienceAll ? 'Todos os usuários' : describeNode(form.filter, teamNames)));

function canNext(): boolean {
  if (step.value === 2) {
    if (!form.title.trim() || !form.body.trim()) { ui.toast('error', 'Título e mensagem são obrigatórios.'); return false; }
    if (!form.channels.length) { ui.toast('error', 'Escolha ao menos um canal.'); return false; }
  }
  if (step.value === 3 && form.scheduleMode === 'schedule') {
    const d = new Date(form.sendAt);
    if (!form.sendAt || Number.isNaN(d.getTime())) { ui.toast('error', 'Escolha uma data e hora.'); return false; }
    if (d.getTime() <= Date.now()) { ui.toast('error', 'O agendamento precisa ser no futuro.'); return false; }
  }
  return true;
}
function next() { if (canNext()) step.value = Math.min(4, step.value + 1); }
function prev() { step.value = Math.max(1, step.value - 1); }

function payload() {
  return {
    title: form.title.trim(),
    body: form.body.trim(),
    url: form.url.trim() || undefined,
    channels: form.channels,
    audienceAll: form.audienceAll,
    filter: form.audienceAll ? null : form.filter,
  };
}

// Persist as draft (create or patch), returns the id.
async function ensureSaved(): Promise<string> {
  if (campaignId.value) {
    await useApi()(`/admin/campaigns/${campaignId.value}`, { method: 'PATCH', body: payload() });
    return campaignId.value;
  }
  const c = await useApi()<NotificationCampaign>('/admin/campaigns', { method: 'POST', body: payload() });
  campaignId.value = c.id;
  return c.id;
}

async function saveDraft() {
  saving.value = true;
  try {
    await ensureSaved();
    ui.toast('success', 'Rascunho salvo.');
    navigateTo('/admin/campaigns');
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar.');
  } finally {
    saving.value = false;
  }
}

async function sendOrSchedule() {
  if (!canNext()) return;
  const scheduling = form.scheduleMode === 'schedule';
  const ok = await ui.confirm({
    title: scheduling ? 'Agendar campanha' : 'Enviar campanha',
    msg: scheduling
      ? `Agendar o envio para ${new Date(form.sendAt).toLocaleString('pt-BR')}? (${audienceCount.value ?? '—'} usuário(s))`
      : `Enviar agora para ${audienceCount.value ?? '—'} usuário(s)?`,
    confirmLabel: scheduling ? 'Agendar' : 'Enviar',
  });
  if (!ok) return;
  saving.value = true;
  try {
    const id = await ensureSaved();
    const sendAt = scheduling ? new Date(form.sendAt).toISOString() : undefined;
    await useApi()(`/admin/campaigns/${id}/dispatch`, { method: 'POST', body: { sendAt } });
    ui.toast('success', scheduling ? 'Campanha agendada.' : 'Disparo iniciado.');
    navigateTo('/admin/campaigns');
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao disparar.');
  } finally {
    saving.value = false;
  }
}

const CH_LABEL: Record<string, string> = { inapp: 'In-app', push: 'Push' };
</script>

<template>
  <div>
    <AdminPageHeader :title="isNew ? 'Nova campanha' : 'Campanha'" subtitle="Notificação para um grupo de usuários.">
      <NuxtLink to="/admin/campaigns" class="btn">Voltar</NuxtLink>
    </AdminPageHeader>

    <div v-if="!loaded" class="card adm-panel">Carregando…</div>

    <template v-else>
      <div v-if="readOnly" class="ro-banner card">
        Esta campanha está <strong>{{ (CAMPAIGN_STATUS[status] ?? { label: status }).label }}</strong> e não pode mais ser editada. Visualização apenas.
      </div>

      <!-- stepper -->
      <div class="steps">
        <button
          v-for="(s, i) in STEPS"
          :key="s"
          type="button"
          class="stepbtn"
          :class="{ on: step === i + 1, done: step > i + 1 }"
          @click="step = i + 1"
        >
          <span class="stepn">{{ i + 1 }}</span>{{ s }}
        </button>
      </div>

      <fieldset class="card adm-panel" :disabled="readOnly" style="border: 0">
        <!-- STEP 1: público -->
        <section v-show="step === 1" class="wstep">
          <h3 class="wtitle">Quem vai receber</h3>
          <p class="wsub">Mande para todo mundo ou monte um público combinando condições com <strong>E</strong> / <strong>OU</strong>.</p>

          <div class="aud-tiles">
            <button type="button" class="aud-tile" :class="{ on: form.audienceAll }" @click="form.audienceAll = true">
              <span class="at-ic"><AppIcon name="users" :size="20" :stroke="1.9" /></span>
              <span class="at-txt"><b>Todos os usuários</b><small>Manda para a base inteira</small></span>
            </button>
            <button type="button" class="aud-tile" :class="{ on: !form.audienceAll }" @click="form.audienceAll = false">
              <span class="at-ic"><AppIcon name="filter" :size="20" :stroke="1.9" /></span>
              <span class="at-txt"><b>Público com filtro</b><small>Times, conta, engajamento…</small></span>
            </button>
          </div>

          <div v-if="!form.audienceAll" class="builder">
            <CampaignFilterGroup :node="form.filter" />
          </div>

          <div class="count" :class="{ zero: audienceCount === 0 }">
            <AppIcon name="users" :size="16" :stroke="2" />
            <span v-if="counting">Calculando público…</span>
            <span v-else><strong>{{ audienceCount ?? '—' }}</strong> usuário(s) se enquadram</span>
          </div>
        </section>

        <!-- STEP 2: conteúdo -->
        <section v-show="step === 2" class="wstep">
          <h3 class="wtitle">Conteúdo</h3>
          <div class="adm-form nt-form">
            <label>Título</label>
            <input v-model="form.title" class="input" maxlength="120" placeholder="Ex.: Rodada decisiva!" />
            <label>Mensagem</label>
            <textarea v-model="form.body" class="input nt-area" rows="3" maxlength="500" placeholder="Texto da notificação…" />
            <label>Link (opcional)</label>
            <input v-model="form.url" class="input" placeholder="/futebol/jogos  ·  abre ao tocar" />
            <label>Canais</label>
            <div class="chans">
              <button type="button" class="chan" :class="{ on: form.channels.includes('inapp') }" @click="toggleChannel('inapp')">
                <AppIcon name="inbox" :size="15" :stroke="2" /> In-app
              </button>
              <button type="button" class="chan" :class="{ on: form.channels.includes('push') }" @click="toggleChannel('push')">
                <AppIcon name="bell" :size="15" :stroke="2" /> Push
              </button>
              <span class="chan disabled" title="Em breve"><AppIcon name="share" :size="15" :stroke="2" /> E-mail <em>em breve</em></span>
            </div>
          </div>
        </section>

        <!-- STEP 3: agendamento -->
        <section v-show="step === 3" class="wstep">
          <h3 class="wtitle">Quando enviar</h3>
          <div class="aud-modes">
            <label class="radio"><input type="radio" value="now" v-model="form.scheduleMode" /> Imediato</label>
            <label class="radio"><input type="radio" value="schedule" v-model="form.scheduleMode" /> Agendar</label>
          </div>
          <div v-if="form.scheduleMode === 'schedule'" class="adm-form" style="max-width: 280px">
            <label>Data e hora (seu horário)</label>
            <input v-model="form.sendAt" type="datetime-local" class="input" />
          </div>
          <p v-else class="nt-hint">A campanha é disparada na hora ao confirmar.</p>
        </section>

        <!-- STEP 4: resumo -->
        <section v-show="step === 4" class="wstep">
          <h3 class="wtitle">Resumo</h3>
          <dl class="rev">
            <dt>Público</dt><dd>{{ summary }} <span class="rev-count">· {{ audienceCount ?? '—' }} usuário(s)</span></dd>
            <dt>Título</dt><dd>{{ form.title || '—' }}</dd>
            <dt>Mensagem</dt><dd>{{ form.body || '—' }}</dd>
            <dt v-if="form.url">Link</dt><dd v-if="form.url">{{ form.url }}</dd>
            <dt>Canais</dt><dd>{{ form.channels.map((c) => CH_LABEL[c] ?? c).join(' · ') || '—' }}</dd>
            <dt>Disparo</dt><dd>{{ form.scheduleMode === 'schedule' ? `Agendado: ${new Date(form.sendAt).toLocaleString('pt-BR')}` : 'Imediato' }}</dd>
          </dl>
        </section>
      </fieldset>

      <!-- footer nav -->
      <div v-if="!readOnly" class="wfoot">
        <button v-if="step > 1" class="btn" @click="prev">Voltar</button>
        <div class="wfoot-r">
          <button v-if="step < 4" class="btn btn-primary" @click="next">Próximo</button>
          <template v-else>
            <button class="btn" :disabled="saving" @click="saveDraft">Salvar rascunho</button>
            <button class="btn btn-gold" :disabled="saving" @click="sendOrSchedule">
              {{ form.scheduleMode === 'schedule' ? 'Agendar envio' : 'Enviar agora' }}
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ro-banner { padding: 12px 16px; margin-bottom: 14px; font-size: 13px; color: var(--muted); }
.steps { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.stepbtn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 13px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-surface); color: var(--muted); font-weight: 700; font-size: 13px; cursor: pointer;
}
.stepbtn.on { color: var(--text); border-color: color-mix(in srgb, var(--gold) 50%, var(--border)); background: color-mix(in srgb, var(--gold) 10%, var(--bg-surface)); }
.stepbtn.done { color: var(--text); }
.stepn {
  display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: var(--bg-base); color: var(--muted); font-size: 11px; font-weight: 800;
}
.stepbtn.on .stepn { background: var(--gold); color: #0a0e14; }
.wstep { display: flex; flex-direction: column; gap: 16px; }
.wtitle { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 18px; }
.wsub { font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: -8px 0 0; }
.wsub strong { color: var(--text); }
.aud-tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (max-width: 560px) { .aud-tiles { grid-template-columns: 1fr; } }
.aud-tile {
  display: flex; align-items: center; gap: 12px; text-align: left;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: 13px;
  background: var(--bg-base); cursor: pointer; transition: border-color 0.13s, background 0.13s;
}
.aud-tile:hover { border-color: color-mix(in srgb, var(--gold) 35%, var(--border)); }
.aud-tile.on { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 9%, var(--bg-base)); }
.at-ic {
  flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 11px;
  color: var(--muted); background: var(--bg-surface); border: 1px solid var(--border);
}
.aud-tile.on .at-ic { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 40%, var(--border)); }
.at-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.at-txt b { font-size: 14px; }
.at-txt small { font-size: 12px; color: var(--muted); }
.aud-modes { display: flex; gap: 18px; flex-wrap: wrap; }
.radio { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 14px; cursor: pointer; }
.builder { }
.count {
  display: inline-flex; align-items: center; gap: 8px; align-self: flex-start;
  padding: 9px 14px; border-radius: 10px; font-size: 14px;
  background: color-mix(in srgb, var(--emerald) 12%, var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--emerald) 30%, var(--border)); color: var(--text);
}
.count.zero { background: color-mix(in srgb, var(--scarlet) 10%, var(--bg-base)); border-color: color-mix(in srgb, var(--scarlet) 30%, var(--border)); }
.count strong { font-size: 16px; }
.nt-form { display: flex; flex-direction: column; gap: 6px; }
.nt-form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 6px; }
.nt-area { resize: vertical; min-height: 70px; font: inherit; }
.nt-hint { font-size: 13px; color: var(--muted); }
.chans { display: flex; gap: 8px; flex-wrap: wrap; }
.chan {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 13px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-base); color: var(--muted); font-weight: 700; font-size: 13px; cursor: pointer;
}
.chan.on { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 50%, var(--border)); background: color-mix(in srgb, var(--gold) 10%, var(--bg-base)); }
.chan.disabled { opacity: 0.55; cursor: default; }
.chan.disabled em { font-style: normal; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.rev { display: grid; grid-template-columns: 110px 1fr; gap: 8px 16px; }
.rev dt { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
.rev dd { margin: 0; font-size: 14px; }
.rev-count { color: var(--muted); font-weight: 600; }
.wfoot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; }
.wfoot-r { display: flex; gap: 10px; margin-left: auto; }
</style>
