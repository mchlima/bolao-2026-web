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

// Owner/admin manage everything (start/end temporada, edit, delete) in the
// Configurações tab. Highlight it here when the temporada hasn't started yet.
const notStarted = computed(() => pool.value?.currentRun?.status === 'DRAFT');

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
    <!-- temporada status (read-only here; managed in Configurações) -->
    <PoolRunControls
      :pool-id="id"
      :run="pool.currentRun"
      :can-manage="false"
      class="ov-run"
    />

    <!-- owner/admin entry to settings — highlighted while the temporada is DRAFT -->
    <NuxtLink
      v-if="canManage"
      :to="`/boloes/${id}/configuracoes`"
      class="cfg-link"
      :class="{ urge: notStarted }"
    >
      <span class="cfg-ic"><AppIcon name="shield" :size="17" :stroke="2" /></span>
      <span class="cfg-txt">
        <b>{{ notStarted ? 'Inicie a temporada' : 'Configurações do bolão' }}</b>
        <small>{{
          notStarted
            ? 'O bolão ainda não começou a pontuar — abra para iniciar.'
            : 'Temporada, edição e exclusão do bolão.'
        }}</small>
      </span>
      <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="cfg-go" />
    </NuxtLink>

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
