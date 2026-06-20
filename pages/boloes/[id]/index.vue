<script setup lang="ts">
import type { RankingResponse } from '~/types/api';
// Pool home ("tela inicial" / Resumo tab): the member's own standing (position +
// points), the pool meta that used to live in the header, and the manage/leave
// actions. The slim header + section tabs live in the shell (pools/[id].vue).
const route = useRoute();
const id = route.params.id as string;
const pool = usePoolData(id);
const pools = usePools();
const ui = useUiStore();
const router = useRouter();

const ROLE_LABEL: Record<string, string> = { OWNER: 'Dono', ADMIN: 'Admin', MEMBER: 'Membro' };
const canManage = computed(() => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN');
const isOwner = computed(() => pool.value?.myRole === 'OWNER');

const { data: ranking, refresh } = await useAsyncData(`pool-overview-${id}`, () =>
  pools.ranking(id).catch(() => null as RankingResponse | null),
);
useRealtime(
  () => (pool.value ? [`tournament:${pool.value.tournament.id}`] : []),
  () => refresh(),
);
const me = computed(() => ranking.value?.currentUser ?? null);
const total = computed(() => ranking.value?.totalParticipants ?? 0);

// Refresh both the pool (current temporada state) and the ranking after a
// temporada is started/ended/created.
async function onRunChanged() {
  await Promise.all([refreshPoolData(id), refresh()]);
}

// ── Edit / leave / delete (moved out of the header) ──
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
    await refreshPoolData(id);
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
    await router.push('/boloes');
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
    await router.push('/boloes');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
</script>

<template>
  <section v-if="pool" class="ov">
    <!-- temporada status + owner controls (start / end / new season) -->
    <PoolRunControls
      :pool-id="id"
      :run="pool.currentRun"
      :can-manage="canManage"
      class="ov-run"
      @changed="onRunChanged"
    />

    <!-- member standing (shared component) -->
    <StandingHero
      :me="me"
      :total="total"
      :title="pool.name"
      :subtitle="pool.tournament.name"
      :cta-to="`/futebol/torneios/${pool.tournament.id}`"
    />

    <!-- podium leaders (same panel as the Ranking tab) -->
    <RankingPodium
      v-if="ranking"
      :data="ranking"
      :title="pool.name"
      :subtitle="pool.tournament.name"
      class="ov-podium"
    />

    <!-- tournament: jump to predictions -->
    <NuxtLink :to="`/futebol/torneios/${pool.tournament.id}`" class="tcard">
      <span class="tcard-ic"><AppIcon name="trophy" :size="20" :stroke="2" /></span>
      <span class="tcard-txt">
        <b>{{ pool.tournament.name }}</b>
        <small>Ver jogos e fazer palpites</small>
      </span>
      <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="tcard-go" />
    </NuxtLink>

    <p v-if="pool.description" class="pdesc">{{ pool.description }}</p>

    <!-- meta -->
    <div class="meta">
      <span class="pill role">{{ ROLE_LABEL[pool.myRole] }}</span>
      <span class="dot">·</span>
      <span>{{ pool.memberCount }} {{ pool.memberCount === 1 ? 'membro' : 'membros' }}</span>
    </div>

    <!-- actions -->
    <div class="actions">
      <button v-if="canManage" class="btn" @click="openEdit">Editar bolão</button>
      <button v-if="isOwner" class="btn danger" @click="delPool">Excluir bolão</button>
      <button v-if="!isOwner" class="btn danger" @click="leavePool">Sair do bolão</button>
    </div>

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
  </section>
</template>

<style scoped>
.ov {
  padding-top: 2px;
}
.ov-run {
  display: block;
  margin-bottom: 14px;
}
.ov-podium {
  display: block;
  margin-top: 14px;
}

/* tournament card */
.tcard {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 13px 15px;
  margin-top: 14px;
  text-decoration: none;
  color: var(--text);
}
.tcard:hover {
  border-color: color-mix(in srgb, var(--emerald) 45%, var(--border));
}
.tcard-ic {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--emerald) 16%, transparent);
  color: var(--emerald);
}
.tcard-txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.tcard-txt b {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tcard-txt small {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.tcard-go {
  flex: none;
  color: var(--muted);
}

.pdesc {
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text);
  max-width: 560px;
  white-space: pre-line;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
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

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}
.btn.danger {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border));
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
</style>
