<script setup lang="ts">
import type { Paginated, Team } from '~/types/api';

// "Meus times" — follow teams to get a match reminder ~1h before kickoff.
// Search hits GET /teams; the followed set is read/written via /me/teams.
const api = useApi();
const ui = useUiStore();

const followed = ref<Team[]>([]);
const loading = ref(true);

const search = ref('');
const results = ref<Team[]>([]);
const searching = ref(false);
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const busy = reactive<Record<string, boolean>>({});

const followedIds = computed(() => new Set(followed.value.map((t) => t.id)));

onMounted(async () => {
  try {
    followed.value = await api<Team[]>('/me/teams');
  } catch {
    ui.toast('error', 'Não foi possível carregar seus times.');
  } finally {
    loading.value = false;
  }
});

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(search, (q) => {
  clearTimeout(debounce);
  if (!q.trim()) {
    results.value = [];
    open.value = false;
    return;
  }
  debounce = setTimeout(() => runSearch(q.trim()), 220);
});

async function runSearch(q: string) {
  searching.value = true;
  open.value = true;
  try {
    const res = await api<Paginated<Team>>('/teams', {
      query: { search: q, pageSize: 12, sort: 'name', match: 'name' },
    });
    results.value = res.data;
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

async function follow(team: Team) {
  if (followedIds.value.has(team.id) || busy[team.id]) return;
  busy[team.id] = true;
  try {
    await api(`/me/teams/${team.id}`, { method: 'PUT' });
    followed.value = [...followed.value, team].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    search.value = '';
    results.value = [];
    open.value = false;
  } catch {
    ui.toast('error', 'Não foi possível seguir o time.');
  } finally {
    busy[team.id] = false;
  }
}

async function unfollow(team: Team) {
  if (busy[team.id]) return;
  busy[team.id] = true;
  try {
    await api(`/me/teams/${team.id}`, { method: 'DELETE' });
    followed.value = followed.value.filter((t) => t.id !== team.id);
  } catch {
    ui.toast('error', 'Não foi possível remover o time.');
  } finally {
    busy[team.id] = false;
  }
}

// close the results dropdown on outside click
function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div class="field">
    <span class="field-lbl">Meus times</span>
    <p class="hint">Siga seus times para receber um lembrete ~1h antes de cada jogo.</p>

    <div ref="root" class="search-wrap">
      <div class="search">
        <AppIcon name="search" :size="16" :stroke="2" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar time…"
          aria-label="Buscar time para seguir"
          @focus="search.trim() && (open = true)"
        />
      </div>

      <ul v-if="open" class="results">
        <li v-if="searching" class="rmsg">Buscando…</li>
        <template v-else-if="results.length">
          <li
            v-for="t in results"
            :key="t.id"
            class="ritem"
            :class="{ has: followedIds.has(t.id) }"
            @click="follow(t)"
          >
            <TeamBadge :team="t" :size="24" />
            <span class="rname">{{ t.name }}</span>
            <span v-if="followedIds.has(t.id)" class="rtag">Seguindo</span>
            <AppIcon v-else name="plus" :size="16" :stroke="2.2" />
          </li>
        </template>
        <li v-else class="rmsg">Nenhum time encontrado.</li>
      </ul>
    </div>

    <div v-if="loading" class="saving">Carregando…</div>
    <ul v-else-if="followed.length" class="chips">
      <li v-for="t in followed" :key="t.id" class="chip">
        <TeamBadge :team="t" :size="22" />
        <span class="cname">{{ t.shortName || t.name }}</span>
        <button class="cx" :disabled="busy[t.id]" :aria-label="`Deixar de seguir ${t.name}`" @click="unfollow(t)">
          <AppIcon name="close" :size="14" :stroke="2.4" />
        </button>
      </li>
    </ul>
    <p v-else class="empty">Você ainda não segue nenhum time.</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.field-lbl {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.hint {
  margin: -3px 0 2px;
  font-size: 12.5px;
  color: var(--muted);
}
.search-wrap {
  position: relative;
  max-width: 360px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--bg-base);
  color: var(--muted);
}
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.results {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.ritem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
  color: var(--muted);
}
.ritem:hover {
  background: var(--bg-base);
}
.ritem.has {
  cursor: default;
  opacity: 0.7;
}
.rname {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rtag {
  font-size: 11px;
  font-weight: 700;
  color: var(--emerald);
}
.rmsg {
  padding: 10px;
  font-size: 13px;
  color: var(--muted);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-base);
}
.cname {
  font-size: 13px;
  font-weight: 700;
}
.cx {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.cx:hover {
  background: color-mix(in srgb, var(--scarlet) 16%, transparent);
  color: var(--scarlet);
}
.cx:disabled {
  opacity: 0.5;
  cursor: default;
}
.empty {
  font-size: 13px;
  color: var(--muted);
}
.saving {
  font-size: 12px;
  color: var(--muted);
}
</style>
