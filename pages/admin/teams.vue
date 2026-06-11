<script setup lang="ts">
import type { Team } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();

const typeFilter = ref<'' | 'NATIONAL_TEAM' | 'CLUB'>('');
const continentFilter = ref('');
const CONTINENTS = ['Europe', 'South America', 'North America', 'Africa', 'Asia', 'Oceania'];

const { page, search, data, load } = useAdminList<Team>('/teams', () => {
  const parts: string[] = [];
  if (typeFilter.value) parts.push(`type=${typeFilter.value}`);
  if (continentFilter.value) parts.push(`continent=${encodeURIComponent(continentFilter.value)}`);
  return parts.join('&');
});
watch([typeFilter, continentFilter], () => { page.value = 1; load(); });

const TYPE_LABEL: Record<string, string> = { NATIONAL_TEAM: 'Seleção', CLUB: 'Clube' };

const modalOpen = ref(false);
const editing = ref<Team | null>(null);
const form = reactive({
  name: '', shortName: '', type: 'NATIONAL_TEAM' as 'NATIONAL_TEAM' | 'CLUB',
  countryCode: '', continent: '', country: '', logoUrl: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { name: '', shortName: '', type: 'NATIONAL_TEAM', countryCode: '', continent: '', country: '', logoUrl: '' });
  modalOpen.value = true;
}
function openEdit(t: Team) {
  editing.value = t;
  Object.assign(form, {
    name: t.name, shortName: t.shortName, type: t.type,
    countryCode: t.countryCode ?? '', continent: t.continent ?? '', country: t.country ?? '', logoUrl: t.logoUrl ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do time');
  if (!form.shortName.trim()) return ui.toast('error', 'Informe a sigla');
  saving.value = true;
  const isNat = form.type === 'NATIONAL_TEAM';
  const body: Record<string, unknown> = {
    name: form.name, shortName: form.shortName, type: form.type,
    countryCode: isNat ? form.countryCode || undefined : undefined,
    continent: isNat ? form.continent || undefined : undefined,
    country: !isNat ? form.country || undefined : undefined,
    logoUrl: !isNat ? form.logoUrl || undefined : undefined,
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/teams/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Time atualizado');
    } else {
      await useApi()('/admin/teams', { method: 'POST', body });
      ui.toast('success', 'Time cadastrado');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(t: Team) {
  const ok = await ui.confirm({ title: 'Excluir time', msg: `Excluir "${t.name}"?`, confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/teams/${t.id}`, { method: 'DELETE' });
    ui.toast('error', `Time "${t.name}" excluído`);
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
        <h3 class="font-display">Times</h3>
        <button class="btn btn-primary" @click="openNew">+ Criar novo</button>
      </div>
      <div class="filters">
        <input v-model="search" class="input" placeholder="Buscar time ou sigla..." />
        <div class="chips">
          <button class="chip" :class="{ on: typeFilter === '' }" @click="typeFilter = ''">Todos</button>
          <button class="chip" :class="{ on: typeFilter === 'NATIONAL_TEAM' }" @click="typeFilter = 'NATIONAL_TEAM'">Seleções</button>
          <button class="chip" :class="{ on: typeFilter === 'CLUB' }" @click="typeFilter = 'CLUB'">Clubes</button>
        </div>
        <select v-model="continentFilter" class="input cont">
          <option value="">Continente</option>
          <option v-for="c in CONTINENTS" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="rows">
        <div class="rhead"><span>Time</span><span>Sigla</span><span>Tipo</span><span>Local</span><span class="ar">Ações</span></div>
        <div v-for="t in data?.data ?? []" :key="t.id" class="row">
          <span class="tn"><TeamBadge :team="t" :size="26" /><span class="nm">{{ t.name }}</span></span>
          <span class="sg">{{ t.shortName }}</span>
          <span class="ty">{{ TYPE_LABEL[t.type] }}</span>
          <span class="lc">{{ t.continent || t.country || '—' }}</span>
          <span class="acts">
            <button class="ic" title="Editar" @click="openEdit(t)">✎</button>
            <button class="ic del" title="Excluir" @click="remove(t)">🗑</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhum time.</p>
      </div>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar time' : 'Novo time'" @close="modalOpen = false">
      <div class="form">
        <div class="seg">
          <button class="seg-b" :class="{ on: form.type === 'NATIONAL_TEAM' }" @click="form.type = 'NATIONAL_TEAM'">Seleção</button>
          <button class="seg-b" :class="{ on: form.type === 'CLUB' }" @click="form.type = 'CLUB'">Clube</button>
        </div>
        <div class="two">
          <div><label>Nome</label><input v-model="form.name" class="input" /></div>
          <div><label>Sigla</label><input v-model="form.shortName" class="input" maxlength="10" /></div>
        </div>
        <template v-if="form.type === 'NATIONAL_TEAM'">
          <label>Código do país (ISO alpha-2, ex.: BR)</label>
          <input v-model="form.countryCode" class="input" placeholder="BR" maxlength="6" />
          <label>Continente</label>
          <select v-model="form.continent" class="input">
            <option value="">—</option>
            <option v-for="c in CONTINENTS" :key="c" :value="c">{{ c }}</option>
          </select>
        </template>
        <template v-else>
          <label>País</label><input v-model="form.country" class="input" />
          <label>Escudo</label><ImageUploadField v-model="form.logoUrl" prefix="teams" />
        </template>
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
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.filters .input { flex: 1; min-width: 170px; }
.cont { flex: 0 0 auto; width: auto; }
.chips { display: flex; gap: 7px; }
.chip { padding: 8px 13px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.chip.on { background: var(--gold); color: #0a0e14; border-color: transparent; }
.rows { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rhead, .row { display: grid; grid-template-columns: 1fr 90px 100px 1fr 80px; gap: 10px; padding: 10px 14px; align-items: center; }
.rhead { background: var(--bg-base); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.row { border-top: 1px solid var(--border); }
.ar { text-align: right; }
.tn { display: flex; align-items: center; gap: 9px; min-width: 0; }
.nm { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sg { font-weight: 700; font-size: 13px; }
.ty, .lc { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
.ic { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; }
.ic.del { color: var(--scarlet); }
.empty { padding: 18px; text-align: center; }
.form { display: flex; flex-direction: column; gap: 4px; }
.form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.seg { display: flex; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 3px; margin-bottom: 4px; }
.seg-b { flex: 1; padding: 9px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-weight: 700; font-size: 13px; cursor: pointer; }
.seg-b.on { background: var(--bg-surface); color: var(--text); box-shadow: var(--shadow); }
@media (max-width: 720px) { .rhead { display: none; } .row { grid-template-columns: 1fr auto; } .sg, .ty, .lc { display: none; } }
</style>
