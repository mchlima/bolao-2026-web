<script setup lang="ts">
import type {
  Match,
  Paginated,
  PoolDetail,
  PoolInviteView,
  PoolMatchPredictionsView,
  PoolMemberView,
  RankingResponse,
} from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const pools = usePools();
const ui = useUiStore();
const auth = useAuthStore();
const router = useRouter();
const origin = useRequestURL().origin;
const tz = useTz();

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro',
};

const { data: pool, pending, error, refresh: refreshPool } = await useAsyncData(
  `pool-${id}`,
  () => pools.detail(id),
);
const { data: ranking, refresh: refreshRanking } = await useAsyncData(
  `pool-rank-${id}`,
  () => pools.ranking(id).catch(() => null as RankingResponse | null),
);

useRealtime(
  () => (pool.value ? [`tournament:${pool.value.tournament.id}`] : []),
  () => {
    refreshRanking();
    predCache.value = {}; // a kickoff/score event may reveal predictions
  },
);

const myId = computed(() => auth.user?.id);
const myRole = computed(() => pool.value?.myRole);
const canManage = computed(
  () => myRole.value === 'OWNER' || myRole.value === 'ADMIN',
);
const isOwner = computed(() => myRole.value === 'OWNER');

const tab = ref<'ranking' | 'members' | 'matches' | 'invites'>('ranking');

// ── "Jogos" tab: matches + per-match member predictions (lazy) ──
const matches = ref<Match[] | null>(null);
const matchesLoading = ref(false);
async function loadMatches() {
  if (matches.value || !pool.value) return;
  matchesLoading.value = true;
  try {
    const tid = pool.value.tournament.id;
    const api = useApi();
    // The API caps pageSize at 100, so page through to get every match.
    const all: Match[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await api<Paginated<Match>>(
        `/matches?tournamentId=${tid}&page=${page}&pageSize=100`,
      );
      all.push(...res.data);
      totalPages = res.pagination.totalPages;
      page++;
    } while (page <= totalPages);
    // Most recent first — played games (with revealed predictions) on top.
    matches.value = all.sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    );
  } catch (e) {
    ui.toast('error', apiError(e));
  } finally {
    matchesLoading.value = false;
  }
}
watch(tab, (t) => {
  if (t === 'matches') loadMatches();
});

const expanded = ref<string | null>(null);
const predCache = ref<Record<string, PoolMatchPredictionsView>>({});
const predLoading = ref<string | null>(null);
async function toggleMatch(m: Match) {
  if (expanded.value === m.id) {
    expanded.value = null;
    return;
  }
  expanded.value = m.id;
  if (!predCache.value[m.id]) {
    predLoading.value = m.id;
    try {
      predCache.value = {
        ...predCache.value,
        [m.id]: await pools.matchPredictions(id, m.id),
      };
    } catch (e) {
      ui.toast('error', apiError(e));
      expanded.value = null;
    } finally {
      predLoading.value = null;
    }
  }
}
function matchPlayed(m: Match): boolean {
  return m.status === 'LIVE' || m.status === 'FINISHED';
}

function apiError(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}

// ── Edit (name + description) ──
const editOpen = ref(false);
const editName = ref('');
const editDescription = ref('');
const saving = ref(false);
function openEdit() {
  editName.value = pool.value?.name ?? '';
  editDescription.value = pool.value?.description ?? '';
  editOpen.value = true;
}
async function saveEdit() {
  if (!editName.value.trim()) return;
  saving.value = true;
  try {
    await pools.update(id, {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
    });
    editOpen.value = false;
    await refreshPool();
    ui.toast('success', 'Bolão atualizado.');
  } catch (e) {
    ui.toast('error', apiError(e));
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
    ui.toast('error', apiError(e));
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
    ui.toast('error', apiError(e));
  }
}

// ── Member management ──
async function setRole(m: PoolMemberView, role: 'ADMIN' | 'MEMBER') {
  try {
    await pools.setMemberRole(id, m.user.id, role);
    await refreshPool();
  } catch (e) {
    ui.toast('error', apiError(e));
  }
}
async function kick(m: PoolMemberView) {
  const ok = await ui.confirm({
    title: 'Remover membro',
    msg: `Remover ${m.user.name} do bolão?`,
    confirmLabel: 'Remover',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.removeMember(id, m.user.id);
    await refreshPool();
    ui.toast('success', 'Membro removido.');
  } catch (e) {
    ui.toast('error', apiError(e));
  }
}
async function makeOwner(m: PoolMemberView) {
  const ok = await ui.confirm({
    title: 'Transferir posse',
    msg: `${m.user.name} passará a ser o dono. Você vira admin.`,
    confirmLabel: 'Transferir',
  });
  if (!ok) return;
  try {
    await pools.transfer(id, m.user.id);
    await refreshPool();
    ui.toast('success', 'Posse transferida.');
  } catch (e) {
    ui.toast('error', apiError(e));
  }
}

// ── Invites ──
const newInvite = ref('');
const addingInvite = ref(false);
async function addInvite() {
  if (!newInvite.value.trim()) return;
  addingInvite.value = true;
  try {
    await pools.createInvite(id, newInvite.value.trim());
    newInvite.value = '';
    await refreshPool();
    ui.toast('success', 'Link criado.');
  } catch (e) {
    ui.toast('error', apiError(e));
  } finally {
    addingInvite.value = false;
  }
}
async function toggleInvite(inv: PoolInviteView) {
  try {
    await pools.updateInvite(id, inv.id, { isActive: !inv.isActive });
    await refreshPool();
  } catch (e) {
    ui.toast('error', apiError(e));
  }
}
function inviteUrl(inv: PoolInviteView): string {
  return `${origin}/pools/join/${inv.code}`;
}
async function copyInvite(inv: PoolInviteView) {
  try {
    await navigator.clipboard.writeText(inviteUrl(inv));
    ui.toast('success', 'Link copiado!');
  } catch {
    ui.toast('error', 'Não foi possível copiar.');
  }
}
async function removeInvite(inv: PoolInviteView) {
  const ok = await ui.confirm({
    title: 'Remover link',
    msg: `Remover o link "${inv.name}"? Quem tiver esse link não poderá mais entrar por ele.`,
    confirmLabel: 'Remover',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.deleteInvite(id, inv.id);
    await refreshPool();
    ui.toast('success', 'Link removido.');
  } catch (e) {
    ui.toast('error', apiError(e));
  }
}

// Friendly message for an unavailable pool (deleted, never existed, or left).
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
    <SkeletonList v-if="pending" variant="row" :count="6" />

    <div v-else-if="error || !pool" class="unavail">
      <div class="ic">🔍</div>
      <h1 class="font-display u-title">{{ unavailable.title }}</h1>
      <p class="muted u-msg">{{ unavailable.msg }}</p>
      <NuxtLink to="/pools" class="btn btn-gold">Ver meus bolões</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink to="/pools" class="back">← Meus bolões</NuxtLink>

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
          <NuxtLink :to="`/tournaments/${pool.tournament.id}`" class="tour-link">
            {{ pool.tournament.name }} — palpitar ›
          </NuxtLink>
        </div>
        <div class="hd-actions">
          <button v-if="canManage" class="btn sm" @click="openEdit">Editar</button>
          <button v-if="isOwner" class="btn sm danger" @click="delPool">Excluir</button>
          <button v-if="!isOwner" class="btn sm danger" @click="leavePool">Sair</button>
        </div>
      </header>

      <!-- tabs -->
      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'ranking' }" @click="tab = 'ranking'">Ranking</button>
        <button class="tab" :class="{ on: tab === 'matches' }" @click="tab = 'matches'">
          Jogos
        </button>
        <button class="tab" :class="{ on: tab === 'members' }" @click="tab = 'members'">
          Membros
        </button>
        <button v-if="canManage" class="tab" :class="{ on: tab === 'invites' }" @click="tab = 'invites'">
          Convites
        </button>
      </div>

      <!-- RANKING -->
      <section v-show="tab === 'ranking'">
        <p v-if="ranking" class="count muted">
          {{ ranking.totalParticipants }}
          {{ ranking.totalParticipants === 1 ? 'participante' : 'participantes' }}
          com palpites
        </p>
        <RankingBoard v-if="ranking" :data="ranking" />
        <p v-else class="muted load">Ranking indisponível.</p>
      </section>

      <!-- MEMBERS -->
      <section v-show="tab === 'members'" class="list">
        <div v-for="m in (pool as PoolDetail).members" :key="m.user.id" class="mrow">
          <span class="av" :style="{ background: color(m.user.id) }">{{ initials(m.user.name) }}</span>
          <div class="m-info">
            <span class="m-name">
              {{ m.user.name }}
              <span v-if="m.user.id === myId" class="me-tag">você</span>
            </span>
            <span class="m-role">{{ ROLE_LABEL[m.role] }}</span>
          </div>
          <div v-if="m.user.id !== myId" class="m-actions">
            <!-- owner: full control over non-owners -->
            <template v-if="isOwner && m.role !== 'OWNER'">
              <button v-if="m.role === 'MEMBER'" class="mini" @click="setRole(m, 'ADMIN')">Tornar admin</button>
              <button v-else class="mini" @click="setRole(m, 'MEMBER')">Rebaixar</button>
              <button class="mini" @click="makeOwner(m)">Tornar dono</button>
              <button class="mini danger" @click="kick(m)">Remover</button>
            </template>
            <!-- admin: may remove plain members -->
            <template v-else-if="myRole === 'ADMIN' && m.role === 'MEMBER'">
              <button class="mini danger" @click="kick(m)">Remover</button>
            </template>
          </div>
        </div>
      </section>

      <!-- MATCHES (palpites por jogo de cada membro) -->
      <section v-show="tab === 'matches'" class="matches">
        <SkeletonList v-if="matchesLoading && !matches" variant="row" :count="6" />
        <p v-else-if="!matches?.length" class="muted empty">
          Nenhuma partida neste torneio ainda.
        </p>
        <template v-else>
          <p class="muted hintline">
            Os palpites dos outros membros aparecem quando a partida começa.
          </p>
          <div v-for="m in matches" :key="m.id" class="game">
            <button class="g-head" @click="toggleMatch(m)">
              <div class="g-teams">
                <span class="g-tname">{{ m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir' }}</span>
                <span v-if="matchPlayed(m)" class="g-score font-numeric">
                  {{ m.homeScore }}<span class="x">×</span>{{ m.awayScore }}
                </span>
                <span v-else class="g-x">×</span>
                <span class="g-tname end">{{ m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir' }}</span>
              </div>
              <div class="g-meta">
                <span
                  v-if="m.status === 'LIVE'"
                  class="g-chip live"
                >AO VIVO</span>
                <span v-else-if="m.status === 'FINISHED'" class="g-chip">Encerrado</span>
                <span v-else-if="m.status === 'CANCELLED'" class="g-chip">Cancelado</span>
                <span v-else class="g-time">{{ formatKickoff(m.kickoffAt, tz) }}</span>
                <span class="caret" :class="{ open: expanded === m.id }">▾</span>
              </div>
            </button>

            <div v-if="expanded === m.id" class="g-body">
              <p v-if="predLoading === m.id" class="muted small">Carregando…</p>
              <template v-else-if="predCache[m.id]">
                <!-- revealed: everyone's predictions -->
                <template v-if="predCache[m.id].revealed">
                  <p v-if="!predCache[m.id].entries.length" class="muted small">
                    Nenhum membro palpitou este jogo.
                  </p>
                  <div
                    v-for="e in predCache[m.id].entries"
                    :key="e.user.id"
                    class="prow"
                    :class="{ me: e.user.id === myId }"
                  >
                    <span class="av sm" :style="{ background: color(e.user.id) }">{{ initials(e.user.name) }}</span>
                    <span class="p-name">{{ e.user.name }}</span>
                    <span class="p-guess font-numeric">{{ e.prediction.home }}–{{ e.prediction.away }}</span>
                    <span v-if="e.tier" class="p-tier" :class="{ exact: e.tier === 'EXACT' }">
                      {{ tierLabel(e.tier) }}<template v-if="e.points != null"> · {{ e.points }}</template>
                    </span>
                  </div>
                </template>
                <!-- hidden until kickoff: only own prediction -->
                <template v-else>
                  <p class="muted small lock">🔒 Palpites revelados quando a partida começar.</p>
                  <div v-if="predCache[m.id].entries.length" class="prow me">
                    <span class="av sm pitch">{{ initials(predCache[m.id].entries[0].user.name) }}</span>
                    <span class="p-name">Seu palpite</span>
                    <span class="p-guess font-numeric">
                      {{ predCache[m.id].entries[0].prediction.home }}–{{ predCache[m.id].entries[0].prediction.away }}
                    </span>
                  </div>
                  <p v-else class="muted small">Você ainda não palpitou este jogo.</p>
                </template>
              </template>
            </div>
          </div>
        </template>
      </section>

      <!-- INVITES -->
      <section v-if="canManage" v-show="tab === 'invites'" class="invites">
        <form class="add" @submit.prevent="addInvite">
          <input v-model="newInvite" class="inp" maxlength="40" placeholder="Nome do link (ex.: WhatsApp)" />
          <button class="btn btn-gold" type="submit" :disabled="addingInvite">
            {{ addingInvite ? '…' : '+ Criar link' }}
          </button>
        </form>

        <p v-if="!(pool as PoolDetail).invites?.length" class="muted empty">
          Nenhum link ainda. Crie um link nomeado e compartilhe com a galera.
        </p>

        <div v-for="inv in (pool as PoolDetail).invites ?? []" :key="inv.id" class="irow" :class="{ off: !inv.isActive }">
          <div class="i-info">
            <span class="i-name">{{ inv.name }}</span>
            <code class="i-url">{{ inviteUrl(inv) }}</code>
          </div>
          <div class="i-actions">
            <button class="mini" :disabled="!inv.isActive" @click="copyInvite(inv)">Copiar</button>
            <button class="mini" @click="toggleInvite(inv)">
              {{ inv.isActive ? 'Revogar' : 'Reativar' }}
            </button>
            <button class="mini danger" @click="removeInvite(inv)">Remover</button>
          </div>
        </div>
      </section>
    </template>

    <!-- Edit modal -->
    <AppModal v-if="editOpen" title="Editar bolão" @close="editOpen = false">
      <form id="edit-pool" class="editform" @submit.prevent="saveEdit">
        <div>
          <label class="lbl">Nome do bolão</label>
          <input v-model="editName" class="inp" maxlength="60" required />
        </div>
        <div>
          <label class="lbl">Descrição (opcional)</label>
          <textarea
            v-model="editDescription"
            class="inp area"
            maxlength="500"
            rows="3"
            placeholder="Conte do que se trata o bolão, regras combinadas, prêmio…"
          />
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
.load {
  padding: 2rem 0;
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
  display: inline-block;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 14px;
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
  display: inline-block;
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
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
}
.tab {
  padding: 10px 14px;
  border: none;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab.on {
  color: var(--text);
  border-bottom-color: var(--gold);
}
.count {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.av {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 13px;
  flex: 0 0 auto;
}
.m-info {
  flex: 1;
  min-width: 0;
}
.m-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.me-tag {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  color: #0a0e14;
  background: var(--gold);
  border-radius: 5px;
  padding: 1px 5px;
  margin-left: 5px;
}
.m-role {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.m-actions,
.i-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
.mini {
  padding: 6px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--muted);
}
.mini.danger {
  color: var(--scarlet);
}
.mini:disabled {
  opacity: 0.5;
  cursor: default;
}
.invites {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.add {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}
.add .inp {
  flex: 1;
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
.empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 13.5px;
}
.irow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.irow.off {
  opacity: 0.55;
}
.i-info {
  flex: 1;
  min-width: 0;
}
.i-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.i-url {
  display: block;
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Jogos tab ── */
.matches {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hintline {
  font-size: 12px;
  margin-bottom: 4px;
}
.game {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.g-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: none;
  background: none;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.g-teams {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.g-tname {
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.g-tname.end {
  text-align: right;
}
.g-score {
  font-size: 17px;
  flex: 0 0 auto;
}
.g-score .x,
.g-x {
  color: var(--muted);
  margin: 0 5px;
  font-weight: 600;
}
.g-x {
  flex: 0 0 auto;
}
.g-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.g-time {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}
.g-chip {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
}
.g-chip.live {
  color: var(--emerald);
  border-color: var(--emerald);
}
.caret {
  color: var(--muted);
  transition: transform 0.15s;
  font-size: 12px;
}
.caret.open {
  transform: rotate(180deg);
}
.g-body {
  padding: 4px 14px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.small {
  font-size: 12.5px;
  padding: 8px 0 2px;
}
.lock {
  font-weight: 600;
}
.prow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
}
.prow.me .p-name {
  color: var(--text);
  font-weight: 800;
}
.av.sm {
  width: 28px;
  height: 28px;
  font-size: 11px;
}
.av.pitch {
  background: var(--grad-pitch);
}
.p-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-guess {
  font-size: 16px;
  flex: 0 0 auto;
}
.p-tier {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  flex: 0 0 auto;
}
.p-tier.exact {
  color: var(--gold);
}
</style>
