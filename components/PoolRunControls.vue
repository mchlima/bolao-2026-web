<script setup lang="ts">
import type { PoolRunView, Paginated, Tournament } from '~/types/api';

// Current temporada status + owner controls (start / end / new season). Emits
// `changed` after any mutation so the parent refreshes the pool + ranking.
const props = defineProps<{
  poolId: string;
  run: PoolRunView | null;
  canManage: boolean;
  /** Só os botões de gestão (sem o card de status) — usado quando o status já é
   *  mostrado em outro card (ex.: card da temporada atual em /temporadas). */
  actionsOnly?: boolean;
  /** Quais ações renderizar:
   *  - 'all' (padrão): comportamento original (1 botão pelo status).
   *  - 'lifecycle': só Iniciar (DRAFT) / Encerrar (ACTIVE); nada se encerrada.
   *  - 'new': só "Nova temporada", sempre visível, habilitada só se ENCERRADA. */
  scope?: 'all' | 'lifecycle' | 'new';
}>();
const emit = defineEmits<{ changed: [] }>();

const pools = usePools();
const ui = useUiStore();
const busy = ref(false);

const status = computed(() => props.run?.status ?? null);

function fmt(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function err(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}

async function start() {
  if (!props.run) return;
  const ok = await ui.confirm({
    title: 'Iniciar temporada',
    msg: 'Todos começam do zero. A pontuação conta a partir do próximo jogo que ainda não começou.',
    confirmLabel: 'Iniciar',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await pools.startRun(props.poolId, props.run.id);
    ui.toast('success', 'Temporada iniciada!');
    emit('changed');
  } catch (e) {
    ui.toast('error', err(e));
  } finally {
    busy.value = false;
  }
}

async function end() {
  if (!props.run) return;
  const ok = await ui.confirm({
    title: 'Encerrar temporada',
    msg: 'O ranking desta temporada será congelado e o campeão definido. Você poderá abrir uma nova depois.',
    confirmLabel: 'Encerrar',
    danger: true,
  });
  if (!ok) return;
  busy.value = true;
  try {
    await pools.endRun(props.poolId, props.run.id);
    ui.toast('success', 'Temporada encerrada.');
    emit('changed');
  } catch (e) {
    ui.toast('error', err(e));
  } finally {
    busy.value = false;
  }
}

// ── New temporada modal ──
const newOpen = ref(false);
const tournaments = ref<Tournament[]>([]);
const form = reactive({ seasonId: '', label: '', start: true });

async function openNew() {
  newOpen.value = true;
  form.label = '';
  if (!tournaments.value.length) {
    try {
      const list = await useApi()<Paginated<Tournament>>('/seasons?pageSize=100');
      tournaments.value = list.data;
      form.seasonId =
        list.data.find((t) => t.status === 'ONGOING')?.id ?? list.data[0]?.id ?? '';
    } catch (e) {
      ui.toast('error', err(e));
    }
  }
}

async function submitNew() {
  if (!form.seasonId) return;
  busy.value = true;
  try {
    await pools.createRun(props.poolId, {
      seasonId: form.seasonId,
      label: form.label.trim() || undefined,
      start: form.start,
    });
    ui.toast('success', 'Nova temporada criada!');
    newOpen.value = false;
    emit('changed');
  } catch (e) {
    ui.toast('error', err(e));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="run" :class="[status?.toLowerCase(), { bare: actionsOnly }]">
    <div class="run-row">
      <div v-if="!actionsOnly" class="run-info">
        <div class="run-head">
          <span class="run-name">{{ run?.label ?? 'Temporada' }}</span>
          <span class="run-badge" :class="status?.toLowerCase()">
            {{ status === 'ACTIVE' ? 'Em andamento' : status === 'ENDED' ? 'Encerrada' : 'Não iniciada' }}
          </span>
        </div>
        <p class="run-sub">
          <template v-if="status === 'DRAFT'">
            Quando iniciar, todos começam do zero — a pontuação conta a partir do próximo jogo.
          </template>
          <template v-else-if="status === 'ACTIVE'">
            Pontos contam desde {{ fmt(run!.startAt) }}.
          </template>
          <template v-else-if="status === 'ENDED'">
            {{ fmt(run!.startAt) }} – {{ fmt(run!.endAt) }} · ranking congelado.
          </template>
        </p>
      </div>

      <div v-if="canManage" class="run-actions">
        <!-- ciclo de vida: iniciar (rascunho) / encerrar (em andamento) -->
        <template v-if="(scope ?? 'all') !== 'new'">
          <button v-if="status === 'DRAFT'" class="btn btn-gold" :disabled="busy" @click="start">
            Iniciar temporada
          </button>
          <button v-else-if="status === 'ACTIVE'" class="btn danger" :disabled="busy" @click="end">
            Encerrar
          </button>
        </template>
        <!-- nova/1ª temporada: escopo 'new' sempre visível; habilitada quando não há
             temporada (run null) ou a atual está encerrada -->
        <button
          v-if="scope === 'new' || ((scope ?? 'all') === 'all' && (status === 'ENDED' || !run))"
          class="btn btn-gold"
          :disabled="busy || !(run === null || status === 'ENDED')"
          @click="openNew"
        >
          {{ run ? 'Nova temporada' : 'Criar temporada' }}
        </button>
      </div>
    </div>

    <AppModal v-if="newOpen" title="Nova temporada" @close="newOpen = false">
      <form id="new-run" class="nr-form" @submit.prevent="submitNew">
        <label class="fld">
          <span class="lbl">Torneio</span>
          <select v-model="form.seasonId" class="inp" required>
            <option value="" disabled>Selecione…</option>
            <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label class="fld">
          <span class="lbl">Nome da temporada (opcional)</span>
          <input v-model="form.label" class="inp" maxlength="60" placeholder="Ex.: Returno, Copa 2026…" />
        </label>
        <label class="chk">
          <input v-model="form.start" type="checkbox" />
          <span>Iniciar agora (todos do zero a partir do próximo jogo)</span>
        </label>
      </form>
      <template #footer>
        <button class="btn" @click="newOpen = false">Cancelar</button>
        <button class="btn btn-gold" form="new-run" type="submit" :disabled="busy">
          {{ busy ? 'Criando…' : 'Criar' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.run {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 13px 15px;
  background: var(--bg-surface);
}
.run.draft {
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
  background: color-mix(in srgb, var(--gold) 8%, var(--bg-surface));
}
/* Só botões (status já mostrado em outro card). */
.run.bare {
  border: none;
  background: none;
  padding: 0;
}
.run.bare .run-actions {
  flex: 1;
}
.run-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.run-info {
  flex: 1;
  min-width: 0;
}
.run-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.run-name {
  font-weight: 700;
  font-size: 14.5px;
}
.run-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--muted);
  border: 1px solid var(--border);
}
.run-badge.active {
  color: var(--emerald);
  border-color: var(--emerald);
}
.run-badge.draft {
  color: var(--gold);
  border-color: var(--gold);
}
.run-sub {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.4;
}
.run-actions {
  flex: none;
}
.btn.danger {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border));
}
.nr-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lbl {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 6px;
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
.chk {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: var(--text);
}
</style>
