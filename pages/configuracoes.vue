<script setup lang="ts">
import { DEFAULT_TZ } from '~/utils/format';

// Conta → Configurações: fuso horário de exibição + push. (Sem tema — só claro.)
const auth = useAuthStore();
const ui = useUiStore();

useSeoMeta({ title: 'Configurações — Cravei' });

const savingTz = ref(false);

const push = usePush();

// Privacidade (SÓ ADMIN): flag por aparelho que IMPEDE o GA4/Clarity de carregar
// (ver o guard `cravei:notrack` no nuxt.config). Como o loader roda no carregamento
// da página, alternar recarrega pra aplicar. Serve pra excluir a navegação interna
// do time sem depender de filtro por IP/parâmetro no painel do GA4.
const noTrack = ref(false);
onMounted(() => {
  try {
    noTrack.value = localStorage.getItem('cravei:notrack') === '1';
  } catch {
    /* storage indisponível */
  }
});
function toggleTrack() {
  const next = !noTrack.value;
  try {
    if (next) localStorage.setItem('cravei:notrack', '1');
    else localStorage.removeItem('cravei:notrack');
  } catch {
    /* storage indisponível */
  }
  noTrack.value = next;
  ui.toast('success', next ? 'Navegação não será registrada neste aparelho.' : 'Registro reativado.');
  // O loader do Analytics roda no carregamento → recarrega pra valer já nesta sessão.
  setTimeout(() => location.reload(), 350);
}

async function onTimezone(tz: string) {
  if (tz === auth.user?.timezone) return;
  savingTz.value = true;
  try {
    await auth.setTimezone(tz);
    ui.toast('success', 'Fuso horário atualizado.');
  } catch (e) {
    ui.toast(
      'error',
      (e as { data?: { message?: string } })?.data?.message ??
        'Não foi possível salvar.',
    );
  } finally {
    savingTz.value = false;
  }
}
</script>

<template>
  <div class="container page">
    <h1 class="page-title">Configurações</h1>

    <div class="card pad">
      <div class="field">
        <span class="field-lbl">Fuso horário</span>
        <p class="hint">Define em que horário os jogos são exibidos.</p>
        <ClientOnly>
          <TimezonePicker
            :model-value="auth.user?.timezone || DEFAULT_TZ"
            @update:model-value="onTimezone"
          />
          <template #fallback>
            <div class="input ph">{{ auth.user?.timezone || DEFAULT_TZ }}</div>
          </template>
        </ClientOnly>
        <span v-if="savingTz" class="saving">Salvando…</span>
      </div>

      <div class="sep" />

      <div class="field">
        <span class="field-lbl">Notificações no aparelho</span>
        <p class="hint">
          Receba os lembretes dos seus times mesmo com o app fechado (push).
        </p>
        <ClientOnly>
          <p v-if="!push.supported.value" class="hint">
            Seu navegador não suporta notificações push.
          </p>
          <p v-else-if="push.permission.value === 'denied'" class="hint">
            As notificações estão bloqueadas. Libere nas configurações do navegador para ativar.
          </p>
          <button
            v-else
            class="pushbtn"
            :class="{ on: push.subscribed.value }"
            :disabled="push.busy.value"
            @click="push.subscribed.value ? push.disable() : push.enable()"
          >
            {{ push.busy.value ? '…' : push.subscribed.value ? 'Desativar push' : 'Ativar push' }}
          </button>
          <template #fallback><div class="ph" /></template>
        </ClientOnly>
      </div>

      <template v-if="auth.isAdmin">
        <div class="sep" />

        <div class="field">
          <span class="field-lbl">Privacidade <span class="tag-admin">Admin</span></span>
          <p class="hint">
            Quando ativado, sua navegação neste aparelho não é registrada nas análises
            (Analytics). Vale só para este navegador/dispositivo — use nos aparelhos do time
            para não poluir as métricas.
          </p>
          <ClientOnly>
            <button class="pushbtn" :class="{ on: noTrack }" @click="toggleTrack">
              {{ noTrack ? 'Navegação ignorada — reativar registro' : 'Não registrar minha navegação' }}
            </button>
            <template #fallback><div class="ph" /></template>
          </ClientOnly>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding-top: 22px;
  padding-bottom: 40px;
  max-width: 620px;
}
.page-title {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-2xl);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 16px;
}
.pad {
  padding: 22px;
}
.sep {
  height: 1px;
  background: var(--border);
  margin: 22px 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.field-lbl {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.hint {
  margin: -3px 0 2px;
  font-size: var(--fs-xs);
  color: var(--muted);
}
.tag-admin {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--gold) 22%, transparent);
  color: color-mix(in srgb, var(--gold) 60%, #0a0e14);
  font-size: var(--fs-2xs, 11px);
  font-weight: 800;
  letter-spacing: 0.04em;
}
.seg {
  display: flex;
  gap: 3px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 4px;
  max-width: 320px;
}
.seg-btn {
  flex: 1;
  padding: 9px 4px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
  background: transparent;
}
.seg-btn.on {
  color: #0a0e14;
  background: var(--gold);
}
.ph {
  display: flex;
  align-items: center;
  color: var(--muted);
}
.saving {
  font-size: var(--fs-xs);
  color: var(--muted);
}
.pushbtn {
  align-self: flex-start;
  padding: 9px 16px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--grad-pitch);
  color: #fff;
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
}
.pushbtn.on {
  background: var(--bg-base);
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 35%, var(--border));
}
.pushbtn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
