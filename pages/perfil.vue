<script setup lang="ts">
// Conta → Perfil: foto (R2, troca/remoção) + edição inline do nome.
const auth = useAuthStore();
const ui = useUiStore();

useSeoMeta({ title: 'Perfil — Cravei' });

function apiMsg(e: unknown): string {
  return (
    (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado'
  );
}

// ── nome (edição inline) ──
const editing = ref(false);
const nameDraft = ref('');
const savingName = ref(false);

function startEdit() {
  nameDraft.value = auth.user?.name ?? '';
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
}
async function confirmName() {
  const name = nameDraft.value.trim();
  if (!name) {
    ui.toast('error', 'Informe um nome.');
    return;
  }
  if (name === auth.user?.name) {
    editing.value = false;
    return;
  }
  savingName.value = true;
  try {
    await auth.updateMe({ name });
    editing.value = false;
    ui.toast('success', 'Nome atualizado.');
  } catch (e) {
    ui.toast('error', apiMsg(e));
  } finally {
    savingName.value = false;
  }
}

// ── foto de perfil ──
const avatarBusy = ref(false);

async function onAvatarFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  avatarBusy.value = true;
  try {
    await auth.uploadAvatar(file);
    ui.toast('success', 'Foto atualizada.');
  } catch (err) {
    ui.toast('error', apiMsg(err));
  } finally {
    avatarBusy.value = false;
    input.value = '';
  }
}

async function removePhoto() {
  const ok = await ui.confirm({
    title: 'Remover foto',
    msg: 'Deseja remover sua foto de perfil?',
    confirmLabel: 'Remover',
    danger: true,
  });
  if (!ok) return;
  avatarBusy.value = true;
  try {
    await auth.removeAvatar();
    ui.toast('success', 'Foto removida.');
  } catch (e) {
    ui.toast('error', apiMsg(e));
  } finally {
    avatarBusy.value = false;
  }
}

// ── contas conectadas ──
const connections = ref<{ google: boolean } | null>(null);
onMounted(async () => {
  try {
    connections.value = await auth.fetchConnections();
  } catch {
    /* silencioso: a seção só aparece quando carrega */
  }
});

async function onLinkGoogle(idToken: string) {
  try {
    connections.value = await auth.linkGoogle(idToken);
    ui.toast('success', 'Conta Google vinculada.');
  } catch (e) {
    ui.toast('error', apiMsg(e));
  }
}
</script>

<template>
  <div class="container page">
    <h1 class="page-title">Perfil</h1>

    <div class="card pad">
      <div class="ava">
        <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="96" />
        <div class="ava-ctrl">
          <label class="btn lbl" :class="{ off: avatarBusy }">
            {{
              avatarBusy
                ? 'Enviando…'
                : auth.user?.avatarUrl
                  ? 'Trocar foto'
                  : 'Adicionar foto'
            }}
            <input
              type="file"
              accept="image/*"
              hidden
              :disabled="avatarBusy"
              @change="onAvatarFile"
            />
          </label>
          <button
            v-if="auth.user?.avatarUrl"
            type="button"
            class="rm"
            :disabled="avatarBusy"
            @click="removePhoto"
          >
            Remover
          </button>
        </div>
      </div>

      <div class="sep" />

      <div class="field">
        <span class="field-lbl">Nome</span>
        <div class="name-row">
          <template v-if="!editing">
            <span class="name-val">{{ auth.user?.name }}</span>
            <IconButton icon="edit" label="Editar nome" @click="startEdit" />
          </template>
          <template v-else>
            <input
              v-model="nameDraft"
              class="input"
              :disabled="savingName"
              autofocus
              @keyup.enter="confirmName"
              @keyup.esc="cancelEdit"
            />
            <IconButton
              icon="check"
              label="Salvar nome"
              tone="emerald"
              :active="true"
              @click="confirmName"
            />
          </template>
        </div>
      </div>

      <div class="field">
        <span class="field-lbl">E-mail</span>
        <span class="ro">{{ auth.user?.email }}</span>
      </div>
    </div>

    <div v-if="connections" class="card pad conn">
      <h2 class="sec-title">Contas conectadas</h2>
      <div class="conn-row">
        <div class="conn-id">
          <GoogleMark :size="22" />
          <div>
            <span class="conn-name">Google</span>
            <span class="conn-state" :class="{ on: connections.google }">
              {{ connections.google ? 'Conectado' : 'Não conectado' }}
            </span>
          </div>
        </div>
        <span v-if="connections.google" class="conn-ok"><AppIcon name="check" :size="14" :stroke="2.6" />Vinculado</span>
        <GoogleSignInButton v-else text="continue_with" @credential="onLinkGoogle" @error="ui.toast('error', 'Falha ao vincular o Google.')" />
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
  font-size: var(--fs-2xl);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 16px;
}
.pad {
  padding: 22px;
}
.ava {
  display: flex;
  align-items: center;
  gap: 18px;
}
.ava-ctrl {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.lbl {
  cursor: pointer;
  font-size: var(--fs-sm);
  padding: 10px 16px;
}
.lbl.off {
  opacity: 0.55;
  pointer-events: none;
}
.rm {
  border: none;
  background: none;
  color: var(--scarlet);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
  padding: 2px 4px;
}
.rm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sep {
  height: 1px;
  background: var(--border);
  margin: 22px 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field + .field {
  margin-top: 18px;
}
.field-lbl {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name-val {
  font-size: var(--fs-base);
  font-weight: 600;
}
.name-row .input {
  flex: 1;
}
.ro {
  font-size: var(--fs-base);
  color: var(--text);
}
.conn {
  margin-top: 16px;
}
.sec-title {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0 0 14px;
}
.conn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.conn-id {
  display: flex;
  align-items: center;
  gap: 12px;
}
.conn-id > div {
  display: flex;
  flex-direction: column;
}
.conn-name {
  font-size: var(--fs-base);
  font-weight: 600;
}
.conn-state {
  font-size: var(--fs-xs);
  color: var(--muted);
}
.conn-state.on {
  color: var(--emerald);
}
.conn-ok {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--emerald);
  font-size: var(--fs-sm);
  font-weight: 700;
}
</style>
