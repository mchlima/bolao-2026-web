<script setup lang="ts">
import type { PoolRunWithChampion } from '~/types/api';

// Temporadas of the pool — the "hall de campeões". Each run shows its winner and
// links to its final (or live) ranking via ?run=. Computed on-read, so history
// is always available.
const route = useRoute();
const id = route.params.id as string;
const pools = usePools();

const pool = usePoolData(id);
// Gerenciar a temporada (iniciar/encerrar/nova) é do DONO ou ADMIN. Membro comum
// só visualiza — as ações nem aparecem (e o backend bloqueia).
const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);

// Passos do "Como funcionam as temporadas" (bloco reutilizável HowItWorks).
const HOWTO_STEPS = [
  { n: 1, icon: 'plus', color: 'var(--azure)', title: 'Crie a temporada', desc: 'Escolha o <strong>campeonato</strong> e dê um nome.', ex: 'Ex.: “Copa do Mundo 2026”.' },
  { n: 2, icon: 'power', color: 'var(--emerald)', title: 'Inicie quando a galera estiver pronta', desc: 'Ao iniciar, a pontuação <strong>deste bolão</strong> zera para todos e passa a contar só dos jogos dali pra frente.', ex: 'Zera só aqui — seus palpites e os outros bolões não são afetados.' },
  { n: 3, icon: 'ball', color: 'var(--scarlet)', title: 'A galera crava os jogos', desc: 'A cada partida, quem acerta o placar <strong>pontua</strong> — e o ranking sobe <strong>ao vivo</strong>.', ex: 'Cada jogo vale pontos pra todo mundo do bolão.' },
  { n: 4, icon: 'trophy', color: 'var(--gold)', title: 'Encerre e coroe o campeão', desc: 'Quem terminar em <strong>1º lugar</strong> vira o <strong>campeão</strong> e entra no <strong>hall de campeões</strong>.', ex: 'O ranking final fica congelado pra história.' },
  { n: 5, icon: 'refresh', color: 'var(--azure)', title: 'Comece de novo, sem recriar nada', desc: 'O <strong>mesmo bolão</strong> abre a próxima temporada — membros, convites e regras seguem.', ex: 'Ex.: depois da Copa, abra o “Brasileirão 2026”.' },
];

const { data: runs, refresh: refreshRuns } = await useAsyncData(`pool-runs-${id}`, () =>
  pools.listRuns(id).catch(() => [] as PoolRunWithChampion[]),
);

// Ranking da temporada atual — pro card destacar o 1º lugar (líder).
const { data: curRanking, refresh: refreshRanking } = await useAsyncData(`pool-cur-ranking-${id}`, () =>
  pools.ranking(id).catch(() => null),
);

// Após iniciar/encerrar/criar temporada, atualiza o bolão (currentRun), a lista e o líder.
async function onRunChanged() {
  await Promise.all([refreshPoolData(id), refreshRuns(), refreshRanking()]);
}

// "Temporada atual" = pool.currentRun (mostrada em destaque no topo). O histórico
// lista só as ANTERIORES, sem duplicar a atual.
const past = computed(() =>
  (runs.value ?? []).filter((r) => r.id !== pool.value?.currentRun?.id),
);
const startedCurrent = computed(
  () => !!pool.value?.currentRun && pool.value.currentRun.status !== 'DRAFT',
);
// 1º lugar da temporada atual (só faz sentido com a temporada iniciada).
const leader = computed(() => (startedCurrent.value ? curRanking.value?.entries?.[0] ?? null : null));

function fmt(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Em andamento', cls: 'active' },
  ENDED: { label: 'Encerrada', cls: 'ended' },
  DRAFT: { label: 'Não iniciada', cls: 'draft' },
};
</script>

<template>
  <section class="temps">
    <HowItWorks
      title="Como funcionam as temporadas"
      storage-key="temporadas-howto-open"
      lead="Uma <strong>temporada</strong> é um ciclo de disputa do bolão dentro de um <strong>campeonato</strong>. O mesmo bolão — a galera, os convites e as regras — vive várias temporadas, uma depois da outra."
      :steps="HOWTO_STEPS"
      example="<b>Na prática:</b> você abre a temporada <strong>“Copa do Mundo 2026”</strong>, a galera crava os jogos e vai pontuando; no fim, quem fez mais pontos é o <strong>campeão</strong>. Depois, no mesmo bolão, é só abrir a próxima."
    />

    <!-- TEMPORADA ATUAL: mesmo card dos campeões, com o 1º lugar + realce. -->
    <section v-if="pool" class="sec">
      <div class="sec-head">
        <h2 class="sec-lbl">Temporada atual</h2>
        <!-- "Nova temporada" no topo só quando JÁ existe uma (habilita quando encerrada).
             Sem temporada, a criação fica no CTA abaixo. -->
        <PoolRunControls
          v-if="canManage && pool.currentRun"
          actions-only
          scope="new"
          class="sec-action"
          :pool-id="id"
          :run="pool.currentRun"
          :can-manage="canManage"
          @changed="onRunChanged"
        />
      </div>

      <!-- bolão sem temporada ainda: mesmo CTA da Visão geral -->
      <PoolNoSeasonCta v-if="!pool.currentRun" :pool-id="id" :can-manage="canManage" @changed="onRunChanged" />

      <div v-else class="t current">
        <div class="t-head">
          <span class="t-name font-display">{{ pool.currentRun.label ?? 'Temporada' }}</span>
          <span class="t-badge" :class="STATUS[pool.currentRun.status]?.cls">{{ STATUS[pool.currentRun.status]?.label }}</span>
        </div>
        <div class="t-meta">
          <span>{{ pool.tournament?.name }}</span>
          <span v-if="pool.currentRun.startAt" class="dot">·</span>
          <span v-if="pool.currentRun.startAt">desde {{ fmt(pool.currentRun.startAt) }}</span>
        </div>

        <!-- 1º lugar (líder atual) -->
        <div v-if="leader" class="champ">
          <span class="cr"><AppIcon name="trophy" :size="15" :stroke="2" /></span>
          <UserAvatar :name="leader.user.name" :src="leader.user.avatarUrl" :size="30" />
          <span class="champ-name">{{ leader.user.name }}</span>
          <span class="champ-pts">{{ leader.points }} pts</span>
        </div>
        <p v-else-if="startedCurrent" class="champ-none muted">Sem pontuação ainda — nenhum jogo pontuou nesta temporada.</p>
        <p v-else class="champ-none muted">Temporada ainda não iniciada.</p>

        <NuxtLink
          v-if="startedCurrent"
          :to="`/boloes/${id}/ranking?run=${pool.currentRun.id}`"
          class="t-link"
        >
          Ver classificação <AppIcon name="chevronRight" :size="14" :stroke="2.5" />
        </NuxtLink>

        <!-- gestão (dono/admin): encerrar/iniciar — some quando a temporada está encerrada -->
        <div v-if="canManage && pool.currentRun.status !== 'ENDED'" class="cur-manage">
          <PoolRunControls
            actions-only
            scope="lifecycle"
            :pool-id="id"
            :run="pool.currentRun"
            :can-manage="canManage"
            @changed="onRunChanged"
          />
        </div>
      </div>
    </section>

    <!-- TEMPORADAS ANTERIORES: o hall de campeões (sem a atual) -->
    <section v-if="past.length" class="sec">
      <h2 class="sec-lbl">Temporadas anteriores</h2>
      <ul class="list">
        <li v-for="r in past" :key="r.id" class="t">
          <div class="t-head">
            <span class="t-name font-display">{{ r.label ?? 'Temporada' }}</span>
            <span class="t-badge" :class="STATUS[r.status]?.cls">{{ STATUS[r.status]?.label }}</span>
          </div>
          <div class="t-meta">
            <span>{{ r.tournament.name }}</span>
            <span v-if="r.startAt" class="dot">·</span>
            <span v-if="r.startAt">{{ fmt(r.startAt) }}<template v-if="r.endAt"> – {{ fmt(r.endAt) }}</template></span>
          </div>

          <div v-if="r.champion" class="champ">
            <span class="cr"><AppIcon name="trophy" :size="15" :stroke="2" /></span>
            <UserAvatar :name="r.champion.user.name" :src="r.champion.user.avatarUrl" :size="30" />
            <span class="champ-name">{{ r.champion.user.name }}</span>
            <span class="champ-pts">{{ r.champion.points }} pts</span>
          </div>
          <p v-else class="champ-none muted">Sem pontuação registrada.</p>

          <NuxtLink
            v-if="r.status !== 'DRAFT'"
            :to="`/boloes/${id}/ranking?run=${r.id}`"
            class="t-link"
          >
            Ver classificação <AppIcon name="chevronRight" :size="14" :stroke="2.5" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.sec {
  margin-top: 22px;
}
.sec-lbl {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
  margin-bottom: 10px;
}
/* Header da seção com a ação "Nova temporada" à direita. */
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.sec-head .sec-lbl {
  margin-bottom: 0;
}
.sec-action {
  flex: none;
}
.load {
  padding: 2rem 0;
}
.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.t {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 15px;
  background: var(--bg-surface);
}
/* Realce do card da temporada ATUAL. */
.t.current {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
  background: color-mix(in srgb, var(--gold) 8%, var(--bg-surface));
  box-shadow: var(--shadow);
}
.cur-manage {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--gold) 28%, var(--border));
}
.t-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.t-name {
  font-weight: 700;
  font-size: var(--fs-base);
}
.t-badge {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--muted);
  border: 1px solid var(--border);
}
.t-badge.active {
  color: var(--emerald);
  border-color: var(--emerald);
}
.t-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
}
.dot {
  opacity: 0.5;
}
.champ {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
}
.cr {
  color: var(--gold);
  flex: none;
}
.champ-name {
  font-weight: 700;
  font-size: var(--fs-sm);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.champ-pts {
  font-weight: 800;
  font-size: var(--fs-sm);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.champ-none {
  margin-top: 10px;
  font-size: var(--fs-sm);
}
.t-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 12px;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--azure);
}
</style>
