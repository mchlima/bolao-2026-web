<script setup lang="ts">
import { DEFAULT_TZ } from '~/utils/format';

// Conta → Configurações: tema (preferência local) + fuso horário de exibição.
const auth = useAuthStore();
const ui = useUiStore();
const colorMode = useColorMode();

useSeoMeta({ title: 'Configurações — Cravei' });

const themes = [
  { key: 'system', title: 'Sistema' },
  { key: 'light', title: 'Claro' },
  { key: 'dark', title: 'Escuro' },
] as const;

const savingTz = ref(false);

const push = usePush();

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
        <span class="field-lbl">Tema</span>
        <ClientOnly>
          <div class="seg">
            <button
              v-for="t in themes"
              :key="t.key"
              class="seg-btn"
              :class="{ on: colorMode.preference === t.key }"
              @click="colorMode.preference = t.key"
            >
              {{ t.title }}
            </button>
          </div>
          <template #fallback>
            <div class="seg" />
          </template>
        </ClientOnly>
      </div>

      <div class="sep" />

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
  font-size: 24px;
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
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.hint {
  margin: -3px 0 2px;
  font-size: 12.5px;
  color: var(--muted);
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
  font-size: 12.5px;
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
  font-size: 12px;
  color: var(--muted);
}
.pushbtn {
  align-self: flex-start;
  padding: 9px 16px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--grad-pitch);
  color: #fff;
  font-size: 13px;
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
