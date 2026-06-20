<script setup lang="ts">
import type { Match } from '~/types/api';

// Per-match notification toggle. Filled/active when the user opted into this
// match OR follows one of its teams. Clicking toggles the explicit opt-in;
// when it's active only because of a followed team, we explain instead of
// silently doing nothing (you manage team follows in "Meus times").
const props = withDefaults(
  defineProps<{
    match: Pick<Match, 'id' | 'homeTeam' | 'awayTeam'>;
    size?: number;
    /** round translucent pill style for the match hero (vs the bare list icon) */
    pill?: boolean;
  }>(),
  { size: 18, pill: false },
);

const auth = useAuthStore();
const follows = useFollowsStore();
const ui = useUiStore();
const authLink = useAuthLink();

onMounted(() => {
  if (auth.isAuthenticated) void follows.ensureLoaded();
});

const active = computed(() => follows.isActive(props.match));
const byTeam = computed(() => follows.activeByTeam(props.match));
const busy = ref(false);

const title = computed(() => {
  if (!active.value) return 'Receber notificações deste jogo';
  if (byTeam.value) return 'Notificações ativas (você segue o time)';
  return 'Notificações ativas — clique para desativar';
});

async function onClick(): Promise<void> {
  if (!auth.isAuthenticated) {
    navigateTo(authLink('/entrar'));
    return;
  }
  if (byTeam.value) {
    ui.toast(
      'info',
      `Você segue ${follows.teamNameFor(props.match)} — este jogo já está nas suas notificações. Gerencie em Meus times.`,
    );
    return;
  }
  if (busy.value) return;
  busy.value = true;
  const willFollow = !active.value;
  try {
    await follows.toggle(props.match.id);
    ui.toast(
      'success',
      willFollow
        ? 'Você vai receber notificações deste jogo.'
        : 'Notificações deste jogo desativadas.',
    );
  } catch {
    ui.toast('error', 'Não foi possível atualizar as notificações.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    v-if="auth.isAuthenticated"
    type="button"
    class="nbell"
    :class="{ on: active, pill }"
    :disabled="busy"
    :aria-pressed="active"
    :title="title"
    @click.stop.prevent="onClick"
  >
    <AppIcon name="bell" :size="size" :stroke="1.9" />
  </button>
</template>

<style scoped>
.nbell {
  position: relative;
  z-index: 2; /* sit above the row/card link so the click lands here */
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.nbell:hover {
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 10%, transparent);
}
.nbell.on {
  color: var(--gold);
}
.nbell.on :deep(svg) {
  fill: color-mix(in srgb, var(--gold) 28%, transparent);
}
.nbell:disabled {
  opacity: 0.55;
  cursor: default;
}
/* Hero variant: a compact translucent pill that reads cleanly over the gradient
   or a stadium photo (its own backdrop keeps the label legible either way). */
/* Hero variant: a round translucent icon button that reads cleanly over the
   gradient or a stadium photo (its own backdrop keeps it legible either way). */
.nbell.pill {
  padding: 9px;
  border-radius: 999px;
  border-color: color-mix(in srgb, var(--border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 62%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: var(--text);
  box-shadow: 0 4px 14px -8px rgba(0, 0, 0, 0.55);
}
.nbell.pill:hover {
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 14%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--gold) 40%, transparent);
}
.nbell.pill.on {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 55%, transparent);
  background: color-mix(in srgb, var(--gold) 18%, var(--bg-elevated));
}
</style>
