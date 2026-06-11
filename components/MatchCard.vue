<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';

const props = defineProps<{ match: Match; prediction?: Prediction | null }>();
const emit = defineEmits<{ saved: [Prediction] }>();

const auth = useAuthStore();
const home = ref<number | null>(props.prediction?.homeScore ?? null);
const away = ref<number | null>(props.prediction?.awayScore ?? null);
const saving = ref(false);
const message = ref('');

const isLive = computed(() => props.match.status === 'LIVE');
const hasResult = computed(
  () => props.match.homeScore !== null && props.match.awayScore !== null,
);
const isOpen = computed(
  () =>
    props.match.status === 'SCHEDULED' &&
    !!props.match.homeTeam &&
    !!props.match.awayTeam &&
    new Date(props.match.kickoffAt).getTime() > Date.now(),
);

async function save() {
  if (home.value === null || away.value === null) {
    message.value = 'Informe o placar.';
    return;
  }
  saving.value = true;
  message.value = '';
  try {
    const saved = await useApi()<Prediction>('/predictions', {
      method: 'POST',
      body: {
        matchId: props.match.id,
        homeScore: Number(home.value),
        awayScore: Number(away.value),
      },
    });
    message.value = 'Palpite salvo! ✓';
    emit('saved', saved);
  } catch (e) {
    message.value =
      (e as { data?: { message?: string } })?.data?.message ??
      'Erro ao salvar.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="card match">
    <div class="meta">
      <span class="muted">{{ formatKickoff(match.kickoffAt) }}</span>
      <span v-if="isLive" class="badge badge-live">● Ao vivo</span>
      <span v-else-if="match.status === 'FINISHED'" class="badge">Encerrada</span>
      <span v-else-if="match.status === 'CANCELLED'" class="badge">Cancelada</span>
    </div>

    <div class="row">
      <TeamBadge
        class="side"
        :team="match.homeTeam"
        :placeholder="match.homeSourceLabel"
        align="right"
      />

      <div class="center">
        <div v-if="hasResult" class="score">
          {{ match.homeScore }} <span class="x">×</span> {{ match.awayScore }}
        </div>
        <div v-else-if="isOpen && auth.isAuthenticated" class="inputs">
          <input v-model.number="home" type="number" min="0" max="99" class="input pick" />
          <span class="x">×</span>
          <input v-model.number="away" type="number" min="0" max="99" class="input pick" />
        </div>
        <div v-else class="x muted">×</div>
      </div>

      <TeamBadge class="side" :team="match.awayTeam" :placeholder="match.awaySourceLabel" />
    </div>

    <div v-if="match.stadium" class="muted venue">
      {{ match.stadium.name }} · {{ match.stadium.city }}
    </div>

    <!-- prediction / actions -->
    <div v-if="isOpen && auth.isAuthenticated" class="actions">
      <button class="btn btn-primary" :disabled="saving" @click="save">
        {{ prediction ? 'Atualizar palpite' : 'Palpitar' }}
      </button>
      <span class="muted hint">{{ message }}</span>
    </div>
    <div v-else-if="isOpen && !auth.isAuthenticated" class="actions">
      <NuxtLink to="/login" class="muted hint">Entre para palpitar →</NuxtLink>
    </div>
    <div v-else-if="prediction" class="actions">
      <span class="muted hint">
        Seu palpite: <strong>{{ prediction.homeScore }}×{{ prediction.awayScore }}</strong>
        <template v-if="prediction.score">
          · {{ tierLabel(prediction.score.tier) }}
          <strong class="pts">+{{ prediction.score.points }}</strong>
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.match {
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
}
.side {
  min-width: 0;
}
.center {
  flex: 0 0 auto;
}
.score {
  font-size: 1.3rem;
  font-weight: 800;
  white-space: nowrap;
}
.x {
  color: var(--muted);
  margin: 0 0.15rem;
}
.inputs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.pick {
  width: 44px;
  text-align: center;
  padding: 0.35rem;
}
.venue {
  font-size: 0.78rem;
  text-align: center;
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-top: 1px solid var(--border);
  padding-top: 0.55rem;
}
.hint {
  font-size: 0.82rem;
}
.pts {
  color: var(--primary);
}
</style>
