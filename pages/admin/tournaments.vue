<script setup lang="ts">
import type { Tournament } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();
const route = useRoute();
const { page, search, data, load } = useAdminList<Tournament>('/tournaments');

const STATUS = ['DRAFT', 'UPCOMING', 'ONGOING', 'FINISHED'] as const;
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  UPCOMING: 'Em breve',
  ONGOING: 'Em andamento',
  FINISHED: 'Encerrado',
};

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}

const modalOpen = ref(false);
const editing = ref<Tournament | null>(null);
const form = reactive({
  name: '',
  status: 'DRAFT' as string,
  startDate: '',
  endDate: '',
  logoUrl: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { name: '', status: 'DRAFT', startDate: '', endDate: '', logoUrl: '' });
  modalOpen.value = true;
}
function openEdit(t: Tournament) {
  editing.value = t;
  Object.assign(form, {
    name: t.name,
    status: t.status,
    startDate: t.startDate?.slice(0, 10) ?? '',
    endDate: t.endDate?.slice(0, 10) ?? '',
    logoUrl: t.logoUrl ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do torneio');
  saving.value = true;
  const body: Record<string, unknown> = {
    name: form.name,
    status: form.status,
    logoUrl: form.logoUrl || undefined,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/tournaments/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Torneio atualizado');
    } else {
      await useApi()('/admin/tournaments', { method: 'POST', body });
      ui.toast('success', 'Torneio criado com sucesso');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(t: Tournament) {
  const ok = await ui.confirm({
    title: 'Excluir torneio',
    msg: `Excluir "${t.name}"? Partidas e palpites associados serão removidos.`,
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/tournaments/${t.id}`, { method: 'DELETE' });
    ui.toast('error', `Torneio "${t.name}" excluído`);
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(() => {
  load();
  if (route.query.new) openNew();
});
</script>

<template>
  <AdminShell>
    <div class="card panel">
      <div class="p-head">
        <h3 class="font-display">Torneios</h3>
        <button class="btn btn-primary" @click="openNew">+ Criar novo</button>
      </div>
      <input v-model="search" class="input search" placeholder="Buscar torneio..." />

      <SkeletonList v-if="!data" variant="row" :count="8" />
      <div v-else class="rows">
        <div class="rhead">
          <span>Torneio</span><span>Período</span><span>Partidas</span><span>Status</span><span class="ar">Ações</span>
        </div>
        <div v-for="t in data?.data ?? []" :key="t.id" class="row">
          <span class="tn">
            <span class="logo">
              <img v-if="t.logoUrl" :src="t.logoUrl" :alt="t.name" />
              <span v-else class="logo-fb font-display">{{ badge(t.name) }}</span>
            </span>
            <span class="nm">{{ t.name }}</span>
          </span>
          <span class="dt">{{ t.startDate ? formatDate(t.startDate) : '—' }}<template v-if="t.endDate"> → {{ formatDate(t.endDate) }}</template></span>
          <span class="mc"><b class="font-numeric">{{ t.matchCount ?? 0 }}</b> partida(s)</span>
          <span><span class="st">{{ STATUS_LABEL[t.status] ?? t.status }}</span></span>
          <span class="acts">
            <button class="ic" title="Editar" @click="openEdit(t)">✎</button>
            <button class="ic del" title="Excluir" @click="remove(t)">🗑</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhum torneio.</p>
      </div>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar torneio' : 'Novo torneio'" @close="modalOpen = false">
      <div class="form">
        <label>Nome</label>
        <input v-model="form.name" class="input" placeholder="Copa do Mundo FIFA 2026" />
        <label>Status</label>
        <select v-model="form.status" class="input">
          <option v-for="s in STATUS" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
        <div class="two">
          <div><label>Início</label><input v-model="form.startDate" type="date" class="input" /></div>
          <div><label>Fim</label><input v-model="form.endDate" type="date" class="input" /></div>
        </div>
        <label>Logo</label>
        <ImageUploadField v-model="form.logoUrl" prefix="tournaments" />
      </div>
      <template #footer>
        <button class="btn" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">{{ editing ? 'Salvar' : 'Criar' }}</button>
      </template>
    </AppModal>
  </AdminShell>
</template>

<style scoped>
.panel {
  padding: 16px;
}
.p-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.p-head h3 {
  font-weight: 600;
  font-size: 17px;
  text-transform: uppercase;
}
.search {
  margin-bottom: 14px;
}
.rows {
  border: 1px solid var(--border);
  border-radius: 13px;
  overflow: hidden;
}
.rhead,
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px 130px 120px 84px;
  gap: 10px;
  padding: 11px 14px;
  align-items: center;
}
.rhead {
  background: var(--bg-base);
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.row {
  border-top: 1px solid var(--border);
}
.ar {
  text-align: right;
}
.tn {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  flex: 0 0 auto;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--bg-base);
  border: 1px solid var(--border);
}
.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.logo-fb {
  font-weight: 700;
  font-size: 12px;
  color: var(--muted);
}
.nm {
  font-weight: 700;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dt {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.mc {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.mc b {
  color: var(--text);
  font-size: 14px;
  margin-right: 3px;
}
.st {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 9px;
}
.acts {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.ic {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
}
.ic.del {
  color: var(--scarlet);
}
.empty {
  padding: 18px;
  text-align: center;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form label {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  margin-top: 8px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 640px) {
  .rhead {
    display: none;
  }
  .row {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'tn acts' 'dt st';
  }
  .tn {
    grid-area: tn;
  }
  .dt {
    grid-area: dt;
  }
  .mc {
    display: none;
  }
  .row > span:nth-child(4) {
    grid-area: st;
    justify-self: start;
  }
  .acts {
    grid-area: acts;
  }
}
</style>
