<script setup lang="ts">
const props = defineProps<{ modelValue?: string | null; prefix: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const ui = useUiStore();
const { uploadImage } = useUpload();
const busy = ref(false);

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  busy.value = true;
  try {
    const url = await uploadImage(file, props.prefix);
    emit('update:modelValue', url);
    ui.toast('success', 'Imagem enviada');
  } catch (err) {
    ui.toast('error', (err as { data?: { message?: string } })?.data?.message ?? 'Falha no upload');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="up">
    <div class="prev">
      <img v-if="modelValue" :src="modelValue" alt="" />
      <span v-else>—</span>
    </div>
    <div class="ctrl">
      <label class="btn lbl">
        {{ busy ? 'Enviando…' : 'Enviar imagem' }}
        <input type="file" accept="image/*" hidden :disabled="busy" @change="onFile" />
      </label>
      <input
        class="input"
        :value="modelValue ?? ''"
        placeholder="ou cole uma URL"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.up { display: flex; gap: 10px; align-items: center; }
.prev {
  width: 48px; height: 48px; flex: 0 0 auto; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-base);
  display: grid; place-items: center; overflow: hidden; color: var(--muted);
}
.prev img { width: 100%; height: 100%; object-fit: cover; }
.ctrl { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.lbl { font-size: var(--fs-xs); padding: 8px 12px; cursor: pointer; }
</style>
