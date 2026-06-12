<script setup lang="ts">
import type { Team, TeamFacets } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();

const CONTINENTS = ['Europe', 'South America', 'North America', 'Africa', 'Asia', 'Oceania'];
const CONTINENT_LABEL: Record<string, string> = {
  Europe: 'Europa', 'South America': 'América do Sul', 'North America': 'América do Norte',
  Africa: 'África', Asia: 'Ásia', Oceania: 'Oceania',
};
const TYPE_LABEL: Record<string, string> = { NATIONAL_TEAM: 'Seleção', CLUB: 'Clube' };
const SORTS = [
  { v: 'name', label: 'Nome (A–Z)' },
  { v: 'country', label: 'País / Local' },
  { v: 'recent', label: 'Atualizados' },
] as const;

// ── Filters ──────────────────────────────────────────────────────
const typeFilter = ref<'' | 'NATIONAL_TEAM' | 'CLUB'>('');
const localFilter = ref(''); // '', 'continent:Europe', 'country:Brasil'
const logoFilter = ref<'' | 'true' | 'false'>('');
const sort = ref<'name' | 'country' | 'recent'>('name');

const facets = ref<TeamFacets | null>(null);
async function loadFacets() {
  facets.value = await useApi()<TeamFacets>('/teams/facets');
}

const typeCount = (t: string) => facets.value?.types.find((x) => x.value === t)?.count ?? 0;

const { page, pageSize, search, data, load } = useAdminList<Team>('/teams', () => {
  const p: string[] = [];
  if (typeFilter.value) p.push(`type=${typeFilter.value}`);
  if (localFilter.value.startsWith('country:'))
    p.push(`country=${encodeURIComponent(localFilter.value.slice(8))}`);
  if (localFilter.value.startsWith('continent:'))
    p.push(`continent=${encodeURIComponent(localFilter.value.slice(10))}`);
  if (logoFilter.value) p.push(`hasLogo=${logoFilter.value}`);
  if (sort.value !== 'name') p.push(`sort=${sort.value}`);
  return p.join('&');
}, 20);

watch([typeFilter, localFilter, logoFilter, sort], () => { page.value = 1; load(); });

const hasFilters = computed(
  () => !!(search.value || typeFilter.value || localFilter.value || logoFilter.value || sort.value !== 'name'),
);
function clearFilters() {
  search.value = '';
  typeFilter.value = '';
  localFilter.value = '';
  logoFilter.value = '';
  sort.value = 'name';
  page.value = 1;
  load();
}
const localLabel = computed(() => {
  const v = localFilter.value;
  if (v.startsWith('country:')) return v.slice(8);
  if (v.startsWith('continent:')) return CONTINENT_LABEL[v.slice(10)] ?? v.slice(10);
  return '';
});

function hex(c?: string | null): string | null {
  if (!c) return null;
  const h = c.replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h}` : null;
}

// ── Create / edit ────────────────────────────────────────────────
const modalOpen = ref(false);
const editing = ref<Team | null>(null);
const blank = () => ({
  name: '', shortName: '', type: 'NATIONAL_TEAM' as 'NATIONAL_TEAM' | 'CLUB',
  countryCode: '', continent: '', country: '',
  logoUrl: '', logoDarkUrl: '', color: '', colorAlt: '',
});
const form = reactive(blank());
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, blank());
  modalOpen.value = true;
}
function openEdit(t: Team) {
  editing.value = t;
  Object.assign(form, {
    name: t.name, shortName: t.shortName, type: t.type,
    countryCode: t.countryCode ?? '', continent: t.continent ?? '', country: t.country ?? '',
    logoUrl: t.logoUrl ?? '', logoDarkUrl: t.logoDarkUrl ?? '',
    color: t.color ?? '', colorAlt: t.colorAlt ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do time');
  if (!form.shortName.trim()) return ui.toast('error', 'Informe a sigla');
  saving.value = true;
  const isNat = form.type === 'NATIONAL_TEAM';
  const clean = (c: string) => c.replace('#', '').trim() || undefined;
  const body: Record<string, unknown> = {
    name: form.name, shortName: form.shortName, type: form.type,
    countryCode: isNat ? form.countryCode || undefined : undefined,
    continent: isNat ? form.continent || undefined : undefined,
    country: !isNat ? form.country || undefined : undefined,
    logoUrl: form.logoUrl || undefined,
    logoDarkUrl: form.logoDarkUrl || undefined,
    color: clean(form.color),
    colorAlt: clean(form.colorAlt),
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
    await Promise.all([load(), loadFacets()]);
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
    await Promise.all([load(), loadFacets()]);
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(() => { load(); loadFacets(); });
</script>

<template>
  <AdminShell>
    <div class="card panel">
      <div class="p-head">
        <div class="title">
          <h3 class="font-display">Times</h3>
          <span v-if="facets" class="total">{{ facets.total }} no total · {{ facets.withLogo }} com escudo</span>
        </div>
        <button class="btn btn-primary" @click="openNew">+ Criar novo</button>
      </div>

      <!-- Search -->
      <div class="searchbar">
        <svg class="si" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model="search" class="sinput" placeholder="Buscar por nome, sigla ou país…" />
        <button v-if="search" class="sx" title="Limpar busca" @click="search = ''">✕</button>
      </div>

      <!-- Type chips -->
      <div class="chips">
        <button class="chip" :class="{ on: typeFilter === '' }" @click="typeFilter = ''">
          Todos <span class="ct">{{ facets?.total ?? '' }}</span>
        </button>
        <button class="chip" :class="{ on: typeFilter === 'NATIONAL_TEAM' }" @click="typeFilter = 'NATIONAL_TEAM'">
          Seleções <span class="ct">{{ typeCount('NATIONAL_TEAM') }}</span>
        </button>
        <button class="chip" :class="{ on: typeFilter === 'CLUB' }" @click="typeFilter = 'CLUB'">
          Clubes <span class="ct">{{ typeCount('CLUB') }}</span>
        </button>
      </div>

      <!-- Selects: local, logo, sort, page size -->
      <div class="selects">
        <label class="sel">
          <span class="sl">Local</span>
          <select v-model="localFilter" class="input">
            <option value="">Todos os locais</option>
            <optgroup v-if="facets?.continents.length" label="Continentes (seleções)">
              <option v-for="c in facets.continents" :key="c.value" :value="`continent:${c.value}`">
                {{ CONTINENT_LABEL[c.value] ?? c.value }} ({{ c.count }})
              </option>
            </optgroup>
            <optgroup v-if="facets?.countries.length" label="Países (clubes)">
              <option v-for="c in facets.countries" :key="c.value" :value="`country:${c.value}`">
                {{ c.value }} ({{ c.count }})
              </option>
            </optgroup>
          </select>
        </label>
        <label class="sel">
          <span class="sl">Escudo</span>
          <select v-model="logoFilter" class="input">
            <option value="">Com e sem</option>
            <option value="true">Com escudo</option>
            <option value="false">Sem escudo</option>
          </select>
        </label>
        <label class="sel">
          <span class="sl">Ordenar</span>
          <select v-model="sort" class="input">
            <option v-for="s in SORTS" :key="s.v" :value="s.v">{{ s.label }}</option>
          </select>
        </label>
        <label class="sel">
          <span class="sl">Por página</span>
          <select v-model.number="pageSize" class="input">
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
      </div>

      <!-- Active filters + result count -->
      <div class="bar">
        <div class="active">
          <span v-if="typeFilter" class="afl">{{ TYPE_LABEL[typeFilter] }}<button @click="typeFilter = ''">✕</button></span>
          <span v-if="localLabel" class="afl">{{ localLabel }}<button @click="localFilter = ''">✕</button></span>
          <span v-if="logoFilter" class="afl">{{ logoFilter === 'true' ? 'Com escudo' : 'Sem escudo' }}<button @click="logoFilter = ''">✕</button></span>
          <button v-if="hasFilters" class="clearall" @click="clearFilters">Limpar tudo</button>
        </div>
        <span v-if="data" class="count">{{ data.pagination.total }} resultado(s)</span>
      </div>

      <SkeletonList v-if="!data" variant="row" :count="10" />
      <div v-else class="rows">
        <div class="rhead"><span>Time</span><span>Sigla</span><span>Tipo</span><span>Local</span><span>Cores</span><span class="ar">Ações</span></div>
        <div v-for="t in data?.data ?? []" :key="t.id" class="row">
          <span class="tn">
            <TeamBadge :team="t" :size="30" />
            <span class="nm">{{ t.name }}</span>
          </span>
          <span class="sg">{{ t.shortName }}</span>
          <span class="ty"><span class="tb" :class="t.type === 'CLUB' ? 'club' : 'nat'">{{ TYPE_LABEL[t.type] }}</span></span>
          <span class="lc">{{ t.country || (t.continent ? CONTINENT_LABEL[t.continent] ?? t.continent : '—') }}</span>
          <span class="cl">
            <span v-if="hex(t.color)" class="sw" :style="{ background: hex(t.color)! }" :title="t.color!" />
            <span v-if="hex(t.colorAlt)" class="sw" :style="{ background: hex(t.colorAlt)! }" :title="t.colorAlt!" />
            <span v-if="!hex(t.color) && !hex(t.colorAlt)" class="muted-mini">—</span>
          </span>
          <span class="acts">
            <button class="ic" title="Editar" @click="openEdit(t)">✎</button>
            <button class="ic del" title="Excluir" @click="remove(t)">🗑</button>
          </span>
        </div>
        <p v-if="data && !data.data.length" class="muted empty">Nenhum time encontrado com esses filtros.</p>
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
          <div class="two">
            <div><label>Código do país (ISO, ex.: BR)</label><input v-model="form.countryCode" class="input" placeholder="BR" maxlength="6" /></div>
            <div>
              <label>Continente</label>
              <select v-model="form.continent" class="input">
                <option value="">—</option>
                <option v-for="c in CONTINENTS" :key="c" :value="c">{{ CONTINENT_LABEL[c] }}</option>
              </select>
            </div>
          </div>
        </template>
        <template v-else>
          <label>País</label><input v-model="form.country" class="input" />
        </template>

        <div class="two">
          <div>
            <label>Cor primária</label>
            <div class="clr"><span class="csw" :style="{ background: hex(form.color) || 'transparent' }" /><input v-model="form.color" class="input" placeholder="D80518" maxlength="7" /></div>
          </div>
          <div>
            <label>Cor secundária</label>
            <div class="clr"><span class="csw" :style="{ background: hex(form.colorAlt) || 'transparent' }" /><input v-model="form.colorAlt" class="input" placeholder="FFFFFF" maxlength="7" /></div>
          </div>
        </div>

        <div class="two">
          <div><label>Escudo (claro)</label><ImageUploadField v-model="form.logoUrl" prefix="teams" /></div>
          <div><label>Escudo (escuro)</label><ImageUploadField v-model="form.logoDarkUrl" prefix="teams" /></div>
        </div>
        <p v-if="editing?.espnId" class="espnote">Vinculado à ESPN — atualizado automaticamente pelo seed.</p>
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
.title { display: flex; flex-direction: column; gap: 2px; }
.title h3 { font-weight: 600; font-size: 17px; text-transform: uppercase; }
.total { font-size: 11.5px; color: var(--muted); font-weight: 600; }

/* search */
.searchbar { position: relative; display: flex; align-items: center; margin-bottom: 10px; }
.si { position: absolute; left: 12px; color: var(--muted); pointer-events: none; }
.sinput { width: 100%; padding: 11px 36px; border-radius: 11px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font: inherit; font-size: 14px; }
.sinput:focus { outline: none; border-color: var(--gold); }
.sx { position: absolute; right: 8px; width: 26px; height: 26px; border: none; background: var(--bg-surface); border-radius: 7px; color: var(--muted); cursor: pointer; }

/* chips */
.chips { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 10px; }
.chip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.chip.on { background: var(--gold); color: #0a0e14; border-color: transparent; }
.ct { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, transparent); }

/* selects */
.selects { display: grid; grid-template-columns: 2fr 1fr 1.2fr 1fr; gap: 10px; margin-bottom: 12px; }
.sel { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.sel .input { width: 100%; padding: 9px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; }

/* active filter bar */
.bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; min-height: 24px; }
.active { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.afl { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--text); background: var(--bg-base); border: 1px solid var(--border); border-radius: 999px; padding: 3px 6px 3px 10px; }
.afl button { width: 16px; height: 16px; border: none; border-radius: 50%; background: var(--bg-surface); color: var(--muted); font-size: 10px; cursor: pointer; line-height: 1; }
.clearall { border: none; background: none; color: var(--scarlet); font-weight: 700; font-size: 11.5px; cursor: pointer; }
.count { font-size: 11.5px; color: var(--muted); font-weight: 600; white-space: nowrap; }

/* table */
.rows { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rhead, .row { display: grid; grid-template-columns: 1fr 80px 90px 1fr 64px 78px; gap: 10px; padding: 9px 14px; align-items: center; }
.rhead { background: var(--bg-base); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.row { border-top: 1px solid var(--border); }
.row:hover { background: var(--bg-base); }
.ar { text-align: right; }
.tn { display: flex; align-items: center; gap: 10px; min-width: 0; }
.nm { min-width: 0; font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sg { font-weight: 700; font-size: 13px; }
.ty .tb { font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
.tb.nat { color: var(--azure); background: color-mix(in srgb, var(--azure) 14%, transparent); }
.tb.club { color: var(--emerald); background: color-mix(in srgb, var(--emerald) 14%, transparent); }
.lc { font-size: 12.5px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl { display: flex; gap: 4px; align-items: center; }
.sw { width: 16px; height: 16px; border-radius: 5px; border: 1px solid var(--border); flex: 0 0 auto; }
.muted-mini { color: var(--muted); font-size: 12px; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
.ic { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; }
.ic:hover { color: var(--text); }
.ic.del:hover { color: var(--scarlet); border-color: var(--scarlet); }
.empty { padding: 22px; text-align: center; }

/* form */
.form { display: flex; flex-direction: column; gap: 4px; }
.form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; display: block; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.seg { display: flex; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 3px; margin-bottom: 4px; }
.seg-b { flex: 1; padding: 9px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-weight: 700; font-size: 13px; cursor: pointer; }
.seg-b.on { background: var(--bg-surface); color: var(--text); box-shadow: var(--shadow); }
.clr { display: flex; align-items: center; gap: 8px; }
.csw { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); flex: 0 0 auto; }
.espnote { font-size: 11px; color: var(--muted); margin-top: 10px; }

@media (max-width: 820px) { .selects { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) {
  .rhead { display: none; }
  .row { grid-template-columns: 1fr auto auto; }
  .sg, .lc, .cl { display: none; }
}
</style>
