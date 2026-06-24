<script setup lang="ts">
import type { NewsTone } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const isNew = computed(() => route.params.id === 'new');
const toneId = ref<string | null>(isNew.value ? null : (route.params.id as string));
const loaded = ref(isNew.value);
const saving = ref(false);

const form = reactive({ name: '', description: '', promptText: '', isActive: true });

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

onMounted(async () => {
  if (isNew.value) return;
  try {
    const t = await useApi()<NewsTone>(`/admin/content/tones/${toneId.value}`);
    form.name = t.name;
    form.description = t.description ?? '';
    form.promptText = t.promptText;
    form.isActive = t.isActive;
  } catch {
    ui.toast('error', 'Não foi possível carregar o tom.');
  } finally {
    loaded.value = true;
  }
});

async function save() {
  if (!form.name.trim() || !form.promptText.trim()) {
    ui.toast('error', 'Nome e guia de voz são obrigatórios.');
    return;
  }
  saving.value = true;
  const body = {
    name: form.name.trim(),
    description: form.description.trim(),
    promptText: form.promptText.trim(),
    isActive: form.isActive,
  };
  try {
    if (isNew.value) await useApi()('/admin/content/tones', { method: 'POST', body });
    else await useApi()(`/admin/content/tones/${toneId.value}`, { method: 'PATCH', body });
    ui.toast('success', 'Tom salvo.');
    navigateTo('/admin/content/tones');
  } catch (e) {
    err(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <AdminPageHeader :title="isNew ? 'Novo tom' : 'Editar tom'" subtitle="A voz editorial injetada na geração do texto.">
      <template #actions>
        <NuxtLink to="/admin/content/tones" class="btn">Voltar</NuxtLink>
      </template>
    </AdminPageHeader>

    <div v-if="loaded" class="card adm-panel form-wrap">
      <div class="adm-form">
        <label>Nome</label>
        <input v-model="form.name" class="input" maxlength="80" placeholder="Ex.: Corneteiro Raiz" />

        <label>Descrição (opcional)</label>
        <input v-model="form.description" class="input" maxlength="200" placeholder="Resumo curto do estilo" />

        <label>Guia de voz</label>
        <textarea v-model="form.promptText" class="input area" rows="10" maxlength="4000" placeholder="Descreva como o texto deve soar…" />
        <p class="hint">Vira a instrução de estilo do modelo. Editar sobe a versão; textos já gerados mantêm a voz antiga.</p>

        <label class="check"><input type="checkbox" v-model="form.isActive" /> Ativo</label>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-wrap { max-width: 680px; }
.adm-form { display: flex; flex-direction: column; gap: 6px; }
.adm-form label { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); margin-top: 10px; }
.area { resize: vertical; line-height: 1.5; }
.hint { font-size: var(--fs-xs); color: var(--muted); margin: 6px 0 0; }
.check { display: flex; align-items: center; gap: 8px; flex-direction: row !important; margin-top: 14px; font-weight: 600; color: var(--text); }
.form-actions { margin-top: 18px; display: flex; justify-content: flex-end; }
</style>
