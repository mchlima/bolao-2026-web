<script setup lang="ts">
import type { PoolSummary } from '~/types/api';

const pools = usePools();
const ui = useUiStore();
const router = useRouter();

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro',
};
const GRADS = ['var(--grad-pitch)', 'var(--grad-trophy)', 'var(--grad-live)'];

const { data, pending, refresh } = await useAsyncData('pools-mine', () =>
  pools.listMine(),
);

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 1);
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}
function apiError(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}

// (Joining a pool is link-only — open an invite link to join.)

// ── Create modal ── (o bolão nasce vazio; o torneio é escolhido na 1ª temporada)
const createOpen = ref(false);
const form = reactive({
  name: '',
  description: '',
  inviteDescription: '',
});
const creating = ref(false);

function openCreate() {
  createOpen.value = true;
}

async function submitCreate() {
  if (!form.name.trim()) return;
  creating.value = true;
  try {
    const pool = await pools.create({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      inviteDescription: form.inviteDescription.trim() || undefined,
    });
    ui.toast('success', 'Bolão criado!');
    createOpen.value = false;
    form.name = '';
    form.description = '';
    form.inviteDescription = '';
    await router.push(`/boloes/${pool.id}`);
  } catch (e) {
    ui.toast('error', apiError(e));
  } finally {
    creating.value = false;
  }
}

</script>

<template>
  <div class="page">
    <PageHero pillar="Bolão" title="Meus bolões" icon="trophy" tone="gold" :crumbs="[{ name: 'Início', to: '/' }, { name: 'Meus bolões' }]">
      <template #actions><button class="btn btn-gold" @click="openCreate"><AppIcon name="plus" :size="16" :stroke="2.4" />Criar bolão</button></template>
    </PageHero>

    <SkeletonList v-if="pending && !data" variant="card" :count="3" />

    <EmptyState
      v-else-if="!data?.length"
      icon="trophy"
      title="Você ainda não está em nenhum bolão"
      description="Crie um bolão para disputar com seus amigos ou entre com um código de convite."
    >
      <template #action>
        <button class="btn btn-gold" @click="openCreate"><AppIcon name="plus" :size="16" :stroke="2.4" />Criar bolão</button>
      </template>
    </EmptyState>

    <div v-else class="grid">
      <NuxtLink
        v-for="(p, i) in (data as PoolSummary[])"
        :key="p.id"
        :to="`/boloes/${p.id}`"
        class="card"
      >
        <div class="c-top">
          <span class="c-badge font-display" :style="{ background: GRADS[i % GRADS.length] }">
            {{ badge(p.name) }}
          </span>
          <div class="c-info">
            <div class="c-name font-display">{{ p.name }}</div>
            <div class="c-tour">{{ p.tournament?.name ?? 'Sem temporada' }}</div>
          </div>
        </div>
        <div class="c-foot">
          <span class="pill">{{ ROLE_LABEL[p.myRole] }}</span>
          <span class="members">
            {{ p.memberCount }} {{ p.memberCount === 1 ? 'membro' : 'membros' }}
          </span>
        </div>
      </NuxtLink>
    </div>

    <!-- Create modal -->
    <AppModal v-if="createOpen" title="Criar bolão" @close="createOpen = false">
      <form id="create-pool" class="m-form" @submit.prevent="submitCreate">
        <label class="fld">
          <span class="lbl">Nome do bolão</span>
          <input v-model="form.name" class="inp" maxlength="60" placeholder="Ex.: Galera da firma" required />
        </label>
        <label class="fld">
          <span class="lbl">Descrição interna (opcional)</span>
          <textarea
            v-model="form.description"
            class="inp area"
            maxlength="500"
            rows="2"
            placeholder="Para os membros: regras combinadas, prêmio…"
          />
        </label>
        <label class="fld">
          <span class="lbl">Mensagem do convite (opcional)</span>
          <textarea
            v-model="form.inviteDescription"
            class="inp area"
            maxlength="500"
            rows="2"
            placeholder="Aparece para quem abrir o link de convite."
          />
        </label>
        <p class="hint muted">
          O bolão começa vazio. Depois de criar, abra a <strong>Visão geral</strong>
          e crie a <strong>1ª temporada</strong> — é nela que você escolhe o torneio
          e o nome.
        </p>
      </form>
      <template #footer>
        <button class="btn" @click="createOpen = false">Cancelar</button>
        <button class="btn btn-gold" form="create-pool" type="submit" :disabled="creating">
          {{ creating ? 'Criando…' : 'Criar' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.page {
  padding: 10px;
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
.area {
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
}
.empty {
  padding: 3rem 0;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
}
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
  transition: transform 0.15s, border-color 0.15s;
}
.card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--emerald) 50%, var(--border));
}
.c-top {
  display: flex;
  align-items: center;
  gap: 13px;
}
.c-badge {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-weight: 700;
  color: #fff;
  font-size: 15px;
}
.c-info {
  min-width: 0;
  flex: 1;
}
.c-name {
  font-weight: 600;
  font-size: 16.5px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.c-tour {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.c-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.pill {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--azure);
  border: 1px solid var(--azure);
  border-radius: 999px;
  padding: 3px 10px;
}
.members {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.m-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fld {
  display: block;
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
.hint {
  font-size: 12.5px;
  line-height: 1.4;
}
</style>
