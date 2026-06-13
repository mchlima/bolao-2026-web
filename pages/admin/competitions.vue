<script setup lang="ts">
import type { Competition, CompetitionType } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();
const { page, search, data, load } = useAdminList<Competition & { seasonCount?: number }>(
  '/competitions',
);

const TYPES: { v: CompetitionType; l: string }[] = [
  { v: 'LEAGUE', l: 'Liga (pontos corridos)' },
  { v: 'CUP', l: 'Copa (mata-mata)' },
  { v: 'LEAGUE_CUP', l: 'Grupos + mata-mata' },
];

const modalOpen = ref(false);
const editing = ref<Competition | null>(null);
const form = reactive({
  name: '',
  slug: '',
  type: 'LEAGUE_CUP' as CompetitionType,
  country: '',
  confederation: '',
  espnLeagueSlug: '',
  logoUrl: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, {
    name: '', slug: '', type: 'LEAGUE_CUP', country: '', confederation: '',
    espnLeagueSlug: '', logoUrl: '',
  });
  modalOpen.value = true;
}
function openEdit(c: Competition) {
  editing.value = c;
  Object.assign(form, {
    name: c.name, slug: c.slug, type: c.type, country: c.country ?? '',
    confederation: c.confederation ?? '', espnLeagueSlug: c.espnLeagueSlug ?? '',
    logoUrl: c.logoUrl ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim() || !form.slug.trim())
    return ui.toast('error', 'Nome e slug são obrigatórios');
  saving.value = true;
  const body: Record<string, unknown> = {
    name: form.name,
    slug: form.slug,
    type: form.type,
    country: form.country || undefined,
    confederation: form.confederation || undefined,
    espnLeagueSlug: form.espnLeagueSlug || undefined,
    logoUrl: form.logoUrl || undefined,
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/competitions/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Competição atualizada');
    } else {
      await useApi()('/admin/competitions', { method: 'POST', body });
      ui.toast('success', 'Competição criada');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(c: Competition) {
  const ok = await ui.confirm({
    title: 'Excluir competição',
    msg: `Excluir "${c.name}"? Só é possível se não houver edições (seasons) vinculadas.`,
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/competitions/${c.id}`, { method: 'DELETE' });
    ui.toast('error', `Competição "${c.name}" excluída`);
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
        <h3 class="font-display">Competições</h3>
        <button class="btn btn-primary" @click="openNew">+ Criar nova</button>
      </div>
      <p class="hint">
        A competição é o torneio atemporal (ex.: "Copa do Mundo FIFA", "Brasileirão Série A").
        Guarda o <code>slug</code> e o <code>espnLeagueSlug</code> que o robô usa pra puxar placares.
      </p>
      <input v-model="search" class="input search" placeholder="Buscar competição..." />

      <SkeletonList v-if="!data" variant="row" :count="6" />
      <div v-else class="rows">
        <div class="rhead">
          <span>Competição</span><span>Tipo</span><span>ESPN slug</span><span>Edições</span><span class="ar">Ações</span>
        </div>
        <div v-for="c in data?.data ?? []" :key="c.id" class="row">
          <span class="nm">{{ c.name }} <code class="slug">{{ c.slug }}</code></span>
          <span class="muted">{{ TYPES.find((t) => t.v === c.type)?.l ?? c.type }}</span>
          <span class="muted mono">{{ c.espnLeagueSlug || '—' }}</span>
          <span class="muted">{{ c.seasonCount ?? 0 }}</span>
          <span class="acts">
            <button class="ic" title="Editar" @click="openEdit(c)">✎</button>
            <button class="ic del" title="Excluir" @click="remove(c)">🗑</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhuma competição.</p>
      </div>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar competição' : 'Nova competição'" @close="modalOpen = false">
      <div class="form">
        <label>Nome</label>
        <input v-model="form.name" class="input" placeholder="Brasileirão Série A" />
        <label>Slug (chave interna)</label>
        <input v-model="form.slug" class="input mono" placeholder="bra.1" />
        <label>Tipo</label>
        <select v-model="form.type" class="input">
          <option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.l }}</option>
        </select>
        <div class="two">
          <div><label>País</label><input v-model="form.country" class="input" placeholder="Brasil" /></div>
          <div><label>Confederação</label><input v-model="form.confederation" class="input" placeholder="CBF" /></div>
        </div>
        <label>ESPN league slug (robô)</label>
        <input v-model="form.espnLeagueSlug" class="input mono" placeholder="bra.1 / fifa.world / conmebol.libertadores" />
        <label>Logo</label>
        <ImageUploadField v-model="form.logoUrl" prefix="competitions" />
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
.p-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.p-head h3 { font-weight: 600; font-size: 17px; text-transform: uppercase; }
.hint { font-size: 12.5px; color: var(--muted); margin: 0 0 12px; }
.hint code { background: var(--bg-base); border-radius: 4px; padding: 0 4px; }
.search { margin-bottom: 14px; }
.rows { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rhead, .row { display: grid; grid-template-columns: minmax(0,1fr) 160px 150px 80px 84px; gap: 10px; padding: 11px 14px; align-items: center; }
.rhead { background: var(--bg-base); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.row { border-top: 1px solid var(--border); }
.ar { text-align: right; }
.nm { font-weight: 700; font-size: 13.5px; min-width: 0; }
.slug { font-size: 11px; color: var(--muted); background: var(--bg-base); border-radius: 4px; padding: 1px 5px; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.muted { color: var(--muted); font-size: 12.5px; font-weight: 600; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
.ic { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; }
.ic.del { color: var(--scarlet); }
.empty { padding: 18px; text-align: center; }
.form { display: flex; flex-direction: column; gap: 4px; }
.form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 640px) { .rhead { display: none; } .row { grid-template-columns: 1fr auto; } .row > span:nth-child(2), .row > span:nth-child(3), .row > span:nth-child(4) { display: none; } }
</style>
