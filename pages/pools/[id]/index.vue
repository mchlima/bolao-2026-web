<script setup lang="ts">
import type { RankingResponse } from '~/types/api';
// Pool home ("tela inicial"): the member's own standing (position + points), the
// pool meta that used to live in the header, and the manage/leave actions. The
// slim header + section tabs live in the shell (pools/[id].vue).
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
</script>

<template>
  <section v-if="pool" class="ov">
    <!-- member standing: position + points -->
    <div class="stand">
      <div v-if="me" class="rk">
        <span class="rk-pos font-display">{{ me.rank }}º</span>
        <div class="rk-meta">
          <span class="rk-cap">Sua posição</span>
          <span class="rk-sub">de {{ total }} {{ total === 1 ? 'participante' : 'participantes' }}</span>
        </div>
      </div>
      <div v-else class="rk empty">
        <span class="rk-cap">Você ainda não pontuou</span>
        <NuxtLink :to="`/pools/${id}/matches`" class="rk-cta">Fazer palpites →</NuxtLink>
      </div>
      <div v-if="me" class="pts">
        <span class="pts-n font-display">{{ me.points }}</span>
        <span class="pts-cap">pontos</span>
      </div>
    </div>
    <p v-if="me" class="substat">
      <strong>{{ me.exactCount }}</strong> cravadas · <strong>{{ me.scoredCount }}</strong> pontuadas
    </p>

    <!-- pool meta (moved from the header) -->
    <div class="meta">
      <span class="pill role">{{ ROLE_LABEL[pool.myRole] }}</span>
      <span class="dot">·</span>
      <span>{{ pool.memberCount }} {{ pool.memberCount === 1 ? 'membro' : 'membros' }}</span>
    </div>
    <p v-if="pool.description" class="pdesc">{{ pool.description }}</p>
    <NuxtLink :to="`/futebol/torneios/${pool.tournament.id}`" class="tour-link">
      {{ pool.tournament.name }} — palpitar <AppIcon name="chevronRight" :size="14" :stroke="2.4" />
    </NuxtLink>

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
.stand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px 20px;
}
.rk {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.rk.empty {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.rk-pos {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
  color: var(--gold);
}
.rk-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rk-cap {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
}
.rk-sub {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.rk-cta {
  font-size: 13px;
  font-weight: 700;
  color: var(--emerald);
}
.pts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
}
.pts-n {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}
.pts-cap {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.substat {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  margin: 10px 2px 0;
}
.substat strong {
  color: var(--text);
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
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
  margin-top: 12px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--emerald);
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
