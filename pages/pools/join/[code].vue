<script setup lang="ts">
const route = useRoute();
const code = route.params.code as string;
const pools = usePools();
const ui = useUiStore();
const router = useRouter();

const { data, pending, error } = await useAsyncData(`join-${code}`, () =>
  pools.joinPreview(code),
);

const joining = ref(false);
function apiError(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}

async function confirmJoin() {
  joining.value = true;
  try {
    const pool = await pools.join(code);
    ui.toast('success', 'Você entrou no bolão!');
    await router.push(`/pools/${pool.id}`);
  } catch (e) {
    ui.toast('error', apiError(e));
  } finally {
    joining.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <SkeletonList v-if="pending" variant="row" :count="2" />

      <template v-else-if="error || !data">
        <div class="ic bad">✕</div>
        <h1 class="font-display title">Convite inválido</h1>
        <p class="muted">Este link de convite não existe mais ou foi revogado.</p>
        <NuxtLink to="/pools" class="btn">Ver meus bolões</NuxtLink>
      </template>

      <template v-else>
        <div class="ic">⚽</div>
        <span class="cap">Convite para o bolão</span>
        <h1 class="font-display title">{{ data.name }}</h1>
        <p class="tour">{{ data.tournament.name }}</p>
        <p v-if="data.description" class="desc">{{ data.description }}</p>
        <p class="muted members">
          {{ data.memberCount }} {{ data.memberCount === 1 ? 'membro' : 'membros' }}
        </p>

        <button
          v-if="data.alreadyMember"
          class="btn btn-gold"
          @click="router.push(`/pools/${data.id}`)"
        >
          Você já participa — abrir bolão
        </button>
        <button v-else class="btn btn-gold" :disabled="joining" @click="confirmJoin">
          {{ joining ? 'Entrando…' : 'Entrar no bolão' }}
        </button>
        <NuxtLink to="/pools" class="muted link">Voltar</NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 40px 0;
  display: grid;
  place-items: center;
}
.card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 32px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.ic {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 30px;
  background: var(--grad-trophy);
  margin-bottom: 4px;
}
.ic.bad {
  background: var(--scarlet);
  color: #fff;
}
.cap {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.title {
  font-weight: 700;
  font-size: clamp(22px, 5vw, 30px);
  text-transform: uppercase;
  line-height: 1.05;
}
.tour {
  font-weight: 600;
  font-size: 14.5px;
  color: var(--azure);
}
.desc {
  font-size: 14px;
  line-height: 1.45;
  color: var(--text);
  white-space: pre-line;
  margin-top: 2px;
}
.members {
  font-size: 13px;
  margin-bottom: 8px;
}
.btn-gold {
  width: 100%;
}
.link {
  font-size: 13px;
  font-weight: 700;
  margin-top: 2px;
}
</style>
