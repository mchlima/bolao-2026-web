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

const isOwner = computed(() => pool.value?.myRole === 'OWNER');
// Gerenciar temporada (criar/iniciar/encerrar) é do DONO ou ADMIN.
const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);

const { data: ranking, refresh } = await useAsyncData(`pool-overview-${id}`, () =>
  pools.ranking(id).catch(() => null as RankingResponse | null),
);
useRealtime(
  () => (pool.value?.tournament ? [`tournament:${pool.value.tournament.id}`] : []),
  () => refresh(),
);
const me = computed(() => ranking.value?.currentUser ?? null);
const total = computed(() => ranking.value?.totalParticipants ?? 0);

// Owner/admin manage everything (start/end temporada, edit, delete) in the
// Configurações tab. Highlight it here when the temporada hasn't started yet.
const notStarted = computed(() => pool.value?.currentRun?.status === 'DRAFT');

// "Sobre o bolão": estado legível da temporada atual (com acento de cor).
const stateInfo = computed<{ label: string; cls: string }>(() => {
  switch (pool.value?.currentRun?.status) {
    case 'ACTIVE':
      return { label: 'Pontuando', cls: 'active' };
    case 'ENDED':
      return { label: 'Encerrado', cls: 'ended' };
    case 'DRAFT':
      return { label: 'Não iniciado', cls: 'draft' };
    default:
      return { label: 'Não definido', cls: 'none' };
  }
});

// "Sobre o bolão": período da temporada (datas que ficavam no card removido).
// ACTIVE → desde a abertura; ENCERRADA → intervalo; senão (rascunho/sem) → indef.
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
const periodLabel = computed<string | null>(() => {
  const run = pool.value?.currentRun;
  if (!run) return null;
  if (run.status === 'ACTIVE') return `Desde ${fmtDate(run.startAt)}`;
  if (run.status === 'ENDED') return `${fmtDate(run.startAt)} – ${fmtDate(run.endAt)}`;
  return null;
});

// Após criar a 1ª temporada pelo CTA, atualiza o bolão (currentRun) + ranking.
async function onRunChanged() {
  await Promise.all([refreshPoolData(id), refresh()]);
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
    <template v-if="pool.currentRun">
      <!-- sua posição e pontos (topo) -->
      <StandingHero
        :me="me"
        :total="total"
        :title="pool.name"
        :subtitle="pool.tournament?.name"
        :cta-to="competitionHref(pool.tournament?.competition) ?? '/futebol/campeonato'"
        class="ov-standing"
      />

      <!-- dono/admin: atalho destacado pra iniciar a temporada (gerenciada em Temporadas) -->
      <NuxtLink
        v-if="canManage && notStarted"
        :to="`/boloes/${id}/temporadas`"
        class="cfg-link urge"
      >
        <span class="cfg-ic"><AppIcon name="trophy" :size="17" :stroke="2" /></span>
        <span class="cfg-txt">
          <b>Inicie a temporada</b>
          <small>O bolão ainda não começou a pontuar — abra na aba Temporadas.</small>
        </span>
        <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="cfg-go" />
      </NuxtLink>
    </template>

    <!-- sobre o bolão: infos + descrição -->
    <section class="desc-sec">
      <h2 class="sec-lbl">Sobre o bolão</h2>
      <dl class="about">
        <div class="ab-row">
          <dt>Temporada</dt>
          <dd :class="{ undef: !pool.currentRun }">{{ pool.currentRun?.label ?? 'Não definido' }}</dd>
        </div>
        <div class="ab-row">
          <dt>Estado</dt>
          <dd>
            <span class="state" :class="stateInfo.cls"><span class="st-dot" />{{ stateInfo.label }}</span>
          </dd>
        </div>
        <div class="ab-row">
          <dt>Período</dt>
          <dd :class="{ undef: !periodLabel }">{{ periodLabel ?? 'Não definido' }}</dd>
        </div>
        <div class="ab-row">
          <dt>Campeonato</dt>
          <dd :class="{ undef: !pool.tournament }">{{ pool.tournament?.name ?? 'Não definido' }}</dd>
        </div>
        <div class="ab-row">
          <dt>Participantes</dt>
          <dd>{{ pool.memberCount }}</dd>
        </div>
      </dl>
      <div v-if="pool.description" class="pdesc">
        <span class="pdesc-lbl">Descrição</span>
        <p class="pdesc-tx">{{ pool.description }}</p>
      </div>
    </section>

    <!-- BOLÃO VAZIO (sem temporada): CTA pra criar a 1ª temporada (abaixo das infos) -->
    <PoolNoSeasonCta v-if="!pool.currentRun" :pool-id="id" :can-manage="canManage" class="ov-cta" @changed="onRunChanged" />

    <!-- leave (members only; owner/admin manage in Configurações) -->
    <div v-if="!isOwner" class="actions">
      <button class="btn danger" @click="leavePool">Sair do bolão</button>
    </div>
  </section>
</template>

<style scoped>
.ov {
  padding-top: 2px;
}
.ov-standing {
  display: block;
  margin-bottom: 14px;
}
.ov-run {
  display: block;
  margin-bottom: 14px;
}

/* descrição do bolão — card próprio (não fica solto) */
.desc-sec {
  margin-top: 14px;
  padding: 14px 15px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-surface);
}
.sec-lbl {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
  margin-bottom: 8px;
}
/* infos do bolão (Temporada / Estado / Campeonato / Participantes) */
.about {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ab-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
.ab-row:last-child {
  border-bottom: none;
}
.ab-row dt {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.ab-row dd {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  text-align: right;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-row dd.undef {
  color: var(--muted);
  font-weight: 600;
  font-style: italic;
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
}
.st-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.state.active {
  color: var(--emerald);
}
.state.ended {
  color: var(--gold);
}
.state.draft {
  color: var(--azure);
}
.state.none {
  color: var(--muted);
  font-weight: 600;
  font-style: italic;
}
.pdesc {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
.pdesc-lbl {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 4px;
}
.pdesc-tx {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  white-space: pre-line;
}

.ov-cta {
  margin-top: 14px;
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

/* Entry to the Configurações tab (owner/admin). `urge` highlights it while the
   temporada is still DRAFT so the start action is impossible to miss. */
.cfg-link {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  margin-bottom: 16px;
  padding: 13px 15px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  text-decoration: none;
}
.cfg-link:hover {
  border-color: color-mix(in srgb, var(--azure) 45%, var(--border));
}
.cfg-link.urge {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
  background: color-mix(in srgb, var(--gold) 9%, var(--bg-surface));
}
.cfg-ic {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--azure) 15%, transparent);
  color: var(--azure);
}
.cfg-link.urge .cfg-ic {
  background: color-mix(in srgb, var(--gold) 18%, transparent);
  color: var(--gold);
}
.cfg-txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.cfg-txt b {
  font-size: 14px;
  font-weight: 700;
}
.cfg-txt small {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.cfg-go {
  flex: none;
  color: var(--muted);
}
</style>
