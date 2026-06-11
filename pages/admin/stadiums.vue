<script setup lang="ts">
import type { Stadium } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();
const { page, search, data, load } = useAdminList<Stadium>('/stadiums');

const modalOpen = ref(false);
const editing = ref<Stadium | null>(null);
const form = reactive({ name: '', city: '', state: '', country: '' });
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { name: '', city: '', state: '', country: '' });
  modalOpen.value = true;
}
function openEdit(s: Stadium) {
  editing.value = s;
  Object.assign(form, { name: s.name, city: s.city, state: s.state ?? '', country: s.country });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do estádio');
  if (!form.city.trim() || !form.country.trim()) return ui.toast('error', 'Informe cidade e país');
  saving.value = true;
  const body = { name: form.name, city: form.city, state: form.state || undefined, country: form.country };
  try {
    if (editing.value) {
      await useApi()(`/admin/stadiums/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Estádio atualizado');
    } else {
      await useApi()('/admin/stadiums', { method: 'POST', body });
      ui.toast('success', 'Estádio cadastrado');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(s: Stadium) {
  const ok = await ui.confirm({ title: 'Excluir estádio', msg: `Excluir "${s.name}"?`, confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/stadiums/${s.id}`, { method: 'DELETE' });
    ui.toast('error', `Estádio "${s.name}" excluído`);
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(load);
</script>

<template>
  <AdminShell>
    <div class="card panel">
      <div class="p-head">
        <h3 class="font-display">Estádios</h3>
        <button class="btn btn-primary" @click="openNew">+ Criar novo</button>
      </div>
      <input v-model="search" class="input search" placeholder="Buscar estádio, cidade, país..." />

      <div class="rows">
        <div class="rhead"><span>Estádio</span><span>Local</span><span class="ar">Ações</span></div>
        <div v-for="s in data?.data ?? []" :key="s.id" class="row">
          <span class="nm">{{ s.name }}</span>
          <span class="dt">{{ s.city }}<template v-if="s.state">, {{ s.state }}</template> · {{ s.country }}</span>
          <span class="acts">
            <button class="ic" title="Editar" @click="openEdit(s)">✎</button>
            <button class="ic del" title="Excluir" @click="remove(s)">🗑</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhum estádio.</p>
      </div>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar estádio' : 'Novo estádio'" @close="modalOpen = false">
      <div class="form">
        <label>Nome</label><input v-model="form.name" class="input" placeholder="Maracanã" />
        <div class="two">
          <div><label>Cidade</label><input v-model="form.city" class="input" /></div>
          <div><label>Estado/Região</label><input v-model="form.state" class="input" /></div>
        </div>
        <label>País</label><input v-model="form.country" class="input" placeholder="Brasil" />
      </div>
      <template #footer>
        <button class="btn" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">{{ editing ? 'Salvar' : 'Criar' }}</button>
      </template>
    </AppModal>
  </AdminShell>
</template>

<style scoped>
.panel { padding: 16px; }
.p-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.p-head h3 { font-weight: 600; font-size: 17px; text-transform: uppercase; }
.search { margin-bottom: 14px; }
.rows { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rhead, .row { display: grid; grid-template-columns: 1fr 1fr 90px; gap: 10px; padding: 11px 14px; align-items: center; }
.rhead { background: var(--bg-base); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.row { border-top: 1px solid var(--border); }
.ar { text-align: right; }
.nm { font-weight: 700; font-size: 13.5px; }
.dt { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
.ic { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; }
.ic.del { color: var(--scarlet); }
.empty { padding: 18px; text-align: center; }
.form { display: flex; flex-direction: column; gap: 4px; }
.form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 640px) { .rhead { display: none; } .row { grid-template-columns: 1fr auto; } }
</style>
