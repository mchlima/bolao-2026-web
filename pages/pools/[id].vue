<script setup lang="ts">
// Pool layout: header + tab bar + <NuxtPage>. Each tab is its own route
// (/pools/:id/ranking|matches|members|invites), so the URL reflects the tab and
// the chrome stays put while the content swaps.
const route = useRoute();
const id = route.params.id as string;
const pools = usePools();
const ui = useUiStore();
const router = useRouter();

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro',
};

const { data: pool, pending, error, refresh: refreshPool } =
  await usePoolDetail(id);

const myRole = computed(() => pool.value?.myRole);
const canManage = computed(
  () => myRole.value === 'OWNER' || myRole.value === 'ADMIN',
);
const isOwner = computed(() => myRole.value === 'OWNER');

// Which tab is active (derived from the URL).
const activeTab = computed(() => {
  const p = route.path;
  if (p.includes(`/pools/${id}/matches`)) return 'matches';
  if (p.endsWith('/members')) return 'members';
  if (p.endsWith('/invites')) return 'invites';
  return 'ranking';
});

// ── Edit (name + descriptions) ──
const editOpen = ref(false);
const editName = ref('');
const editDescription = ref('');
const editInviteDescription = ref('');
const saving = ref(false);
function openEdit() {
  editName.value = pool.value?.name ?? '';
  editDescription.value = pool.value?.description ?? '';
  editInviteDescription.value = pool.value?.inviteDescription ?? '';
  editOpen.value = true;
}
async function saveEdit() {
  if (!editName.value.trim()) return;
  saving.value = true;
  try {
    await pools.update(id, {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
      inviteDescription: editInviteDescription.value.trim(),
    });
    editOpen.value = false;
    await refreshPool();
    ui.toast('success', 'Bolão atualizado.');
  } catch (e) {
    ui.toast('error', poolError(e));
  } finally {
    saving.value = false;
  }
}

async function delPool() {
  const ok = await ui.confirm({
    title: 'Excluir bolão',
    msg: 'Isso remove o bolão, seus membros e links de convite. Esta ação não pode ser desfeita.',
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.remove(id);
    ui.toast('success', 'Bolão excluído.');
    await router.push('/pools');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}

async function leavePool() {
  const ok = await ui.confirm({
    title: 'Sair do bolão',
    msg: 'Você deixará de ver o ranking deste bolão. Pode voltar com um novo convite.',
    confirmLabel: 'Sair',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.leave(id);
    ui.toast('success', 'Você saiu do bolão.');
    await router.push('/pools');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}

const unavailable = computed(() => {
  const status = (error.value as { statusCode?: number } | null)?.statusCode;
  if (status === 403) {
    return {
      title: 'Você não faz parte deste bolão',
      msg: 'Talvez você tenha saído ou sido removido. Peça um novo convite para voltar.',
    };
  }
  return {
    title: 'Bolão não encontrado',
    msg: 'Este bolão não existe mais ou o link está incorreto. Ele pode ter sido excluído pelo dono.',
  };
});
</script>

<template>
  <div class="page">
    <SkeletonList v-if="pending && !pool" variant="row" :count="6" />

    <div v-else-if="error || !pool" class="unavail">
      <div class="ic"><AppIcon name="search" :size="28" :stroke="1.8" /></div>
      <h1 class="font-display u-title">{{ unavailable.title }}</h1>
      <p class="muted u-msg">{{ unavailable.msg }}</p>
      <NuxtLink to="/pools" class="btn btn-gold">Ver meus bolões</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink to="/pools" class="back"><AppIcon name="arrowLeft" :size="14" :stroke="2.2" />Meus bolões</NuxtLink>

      <!-- header -->
      <header class="hd">
        <div class="hd-main">
          <h1 class="font-display title">{{ pool.name }}</h1>
          <div class="meta">
            <span class="pill role">{{ ROLE_LABEL[pool.myRole] }}</span>
            <span class="dot">·</span>
            <span>{{ pool.memberCount }} {{ pool.memberCount === 1 ? 'membro' : 'membros' }}</span>
          </div>
          <p v-if="pool.description" class="pdesc">{{ pool.description }}</p>
          <NuxtLink :to="`/futebol/torneios/${pool.tournament.id}`" class="tour-link">
            {{ pool.tournament.name }} — palpitar <AppIcon name="chevronRight" :size="13" :stroke="2.4" />
          </NuxtLink>
        </div>
        <div class="hd-actions">
          <button v-if="canManage" class="btn sm" @click="openEdit">Editar</button>
          <button v-if="isOwner" class="btn sm danger" @click="delPool">Excluir</button>
          <button v-if="!isOwner" class="btn sm danger" @click="leavePool">Sair</button>
        </div>
      </header>

      <!-- tabs (each is a route) -->
      <nav class="tabs">
        <NuxtLink :to="`/pools/${id}/ranking`" class="tab" :class="{ on: activeTab === 'ranking' }">Ranking</NuxtLink>
        <NuxtLink :to="`/pools/${id}/matches`" class="tab" :class="{ on: activeTab === 'matches' }">Jogos</NuxtLink>
        <NuxtLink :to="`/pools/${id}/members`" class="tab" :class="{ on: activeTab === 'members' }">Membros</NuxtLink>
        <NuxtLink v-if="canManage" :to="`/pools/${id}/invites`" class="tab" :class="{ on: activeTab === 'invites' }">Convites</NuxtLink>
      </nav>

      <NuxtPage />
    </template>

    <!-- Edit modal -->
    <AppModal v-if="editOpen" title="Editar bolão" @close="editOpen = false">
      <form id="edit-pool" class="editform" @submit.prevent="saveEdit">
        <div>
          <label class="lbl">Nome do bolão</label>
          <input v-model="editName" class="inp" maxlength="60" required />
        </div>
        <div>
          <label class="lbl">Descrição interna (membros)</label>
          <textarea v-model="editDescription" class="inp area" maxlength="500" rows="2" placeholder="Regras combinadas, prêmio…" />
        </div>
        <div>
          <label class="lbl">Mensagem do convite</label>
          <textarea v-model="editInviteDescription" class="inp area" maxlength="500" rows="2" placeholder="Aparece para quem abrir o link de convite." />
        </div>
      </form>
      <template #footer>
        <button class="btn" @click="editOpen = false">Cancelar</button>
        <button class="btn btn-gold" form="edit-pool" type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 44px;
}
.unavail {
  max-width: 420px;
  margin: 8vh auto 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.unavail .ic {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 28px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
.u-title {
  font-weight: 700;
  font-size: clamp(20px, 5vw, 26px);
  text-transform: uppercase;
  line-height: 1.1;
}
.u-msg {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 6px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 14px;
}
.back:hover {
  color: var(--text);
}
.hd {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}
.title {
  font-weight: 700;
  font-size: clamp(24px, 5vw, 34px);
  text-transform: uppercase;
  line-height: 1;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
.dot {
  opacity: 0.5;
}
.pill.role {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--azure);
  border: 1px solid var(--azure);
  border-radius: 999px;
  padding: 2px 9px;
}
.pdesc {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text);
  max-width: 560px;
  white-space: pre-line;
}
.tour-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 10px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--emerald);
}
.editform {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.area {
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
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
.lbl {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 6px;
}
.hd-actions {
  display: flex;
  gap: 8px;
}
.btn.sm {
  padding: 8px 13px;
  font-size: 13px;
}
.btn.danger {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border));
}
/* Section tabs — small pill tags (matches the tournament shell). Active uses the
   pitch gradient. Single row that scrolls sideways when it overflows the
   container (e.g. when "Convites" makes it four) instead of wrapping. */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tab {
  flex: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
