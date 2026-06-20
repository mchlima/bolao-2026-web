<script setup lang="ts">
// Pool settings — owner/admin only. Gathers the management actions that used to
// be scattered on the overview: temporada lifecycle, editing the pool, and the
// danger zone (delete). Each action is explained inline. Members without manage
// rights are bounced out (the tab isn't shown to them either).
const route = useRoute();
const id = route.params.id as string;
const pool = usePoolData(id);
const pools = usePools();
const ui = useUiStore();
const router = useRouter();

const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);
const isOwner = computed(() => pool.value?.myRole === 'OWNER');

// Guard: this page is management-only — bounce members to the overview.
watchEffect(() => {
  if (pool.value && !canManage.value) navigateTo(`/boloes/${id}`);
});

async function onRunChanged() {
  await refreshPoolData(id);
}

// ── Edit ──
const name = ref(pool.value?.name ?? '');
const description = ref(pool.value?.description ?? '');
const inviteDescription = ref(pool.value?.inviteDescription ?? '');
const saving = ref(false);
// Keep the form in sync if the pool refreshes and the fields are still pristine.
watch(pool, (p) => {
  if (!p) return;
  if (!name.value) name.value = p.name;
});

const dirty = computed(
  () =>
    !!pool.value &&
    (name.value.trim() !== pool.value.name ||
      (description.value ?? '') !== (pool.value.description ?? '') ||
      (inviteDescription.value ?? '') !== (pool.value.inviteDescription ?? '')),
);

async function save() {
  if (!name.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await pools.update(id, {
      name: name.value.trim(),
      description: description.value.trim(),
      inviteDescription: inviteDescription.value.trim(),
    });
    await refreshPoolData(id);
    ui.toast('success', 'Bolão atualizado.');
  } catch (e) {
    ui.toast('error', poolError(e));
  } finally {
    saving.value = false;
  }
}

// ── Delete (owner only) ──
async function del() {
  const ok = await ui.confirm({
    title: 'Excluir bolão',
    msg: 'Isso remove o bolão, todos os membros, os links de convite e o histórico de temporadas. Esta ação é permanente.',
    confirmLabel: 'Excluir definitivamente',
    danger: true,
  });
  if (!ok) return;
  try {
    await pools.remove(id);
    ui.toast('success', 'Bolão excluído.');
    await router.push('/boloes');
  } catch (e) {
    ui.toast('error', poolError(e));
  }
}
</script>

<template>
  <section v-if="pool && canManage" class="cfg">
    <!-- Temporada -->
    <div class="block">
      <div class="b-head">
        <span class="b-ic"><AppIcon name="trophy" :size="18" :stroke="2" /></span>
        <div>
          <h2 class="b-title">Temporada</h2>
          <p class="b-desc">
            A temporada é a disputa atual do bolão. Ao <b>iniciar</b>, todos
            começam do zero e a pontuação conta a partir do <b>próximo jogo que
            ainda não começou</b> — quem já vinha pontuando no torneio não leva
            vantagem. Ao <b>encerrar</b>, o ranking é congelado e o campeão fica
            registrado; depois você pode abrir uma <b>nova temporada</b> (o
            returno, outro torneio…) sem precisar criar outro bolão.
          </p>
        </div>
      </div>
      <PoolRunControls
        :pool-id="id"
        :run="pool.currentRun"
        :can-manage="true"
        @changed="onRunChanged"
      />
    </div>

    <!-- Editar -->
    <div class="block">
      <div class="b-head">
        <span class="b-ic"><AppIcon name="edit" :size="18" :stroke="2" /></span>
        <div>
          <h2 class="b-title">Editar bolão</h2>
          <p class="b-desc">
            O nome aparece para todos. A descrição interna é vista só pelos
            membros, dentro do bolão. A mensagem de convite aparece para quem
            abre o link antes de entrar.
          </p>
        </div>
      </div>

      <form class="form" @submit.prevent="save">
        <label class="fld">
          <span class="lbl">Nome do bolão</span>
          <input v-model="name" class="inp" maxlength="60" required />
        </label>
        <label class="fld">
          <span class="lbl">Descrição interna (membros)</span>
          <textarea
            v-model="description"
            class="inp area"
            maxlength="500"
            rows="2"
            placeholder="Regras combinadas, prêmio…"
          />
        </label>
        <label class="fld">
          <span class="lbl">Mensagem do convite</span>
          <textarea
            v-model="inviteDescription"
            class="inp area"
            maxlength="500"
            rows="2"
            placeholder="Aparece para quem abre o link de convite."
          />
        </label>
        <div class="form-foot">
          <button class="btn btn-gold" type="submit" :disabled="!dirty || saving">
            {{ saving ? 'Salvando…' : 'Salvar alterações' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Zona de perigo (owner only) -->
    <div v-if="isOwner" class="block danger">
      <div class="b-head">
        <span class="b-ic danger"><AppIcon name="trash" :size="18" :stroke="2" /></span>
        <div>
          <h2 class="b-title">Zona de perigo</h2>
          <p class="b-desc">
            Excluir o bolão remove <b>tudo</b>: membros, links de convite e o
            histórico de temporadas e campeões. Não há como desfazer. Os palpites
            das pessoas continuam valendo no torneio e nos outros bolões.
          </p>
        </div>
      </div>
      <div class="danger-row">
        <div class="dr-txt">
          <b>Excluir este bolão</b>
          <small>Permanente. Pense duas vezes.</small>
        </div>
        <button class="btn danger" @click="del">Excluir bolão</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cfg {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 620px;
}
.block {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  background: var(--bg-surface);
}
.block.danger {
  border-color: color-mix(in srgb, var(--scarlet) 35%, var(--border));
  background: color-mix(in srgb, var(--scarlet) 5%, var(--bg-surface));
}
.b-head {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}
.b-ic {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--emerald) 14%, transparent);
  color: var(--emerald);
}
.b-ic.danger {
  background: color-mix(in srgb, var(--scarlet) 14%, transparent);
  color: var(--scarlet);
}
.b-title {
  font-weight: 700;
  font-size: 16px;
  font-family: 'Oswald', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.b-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
  margin-top: 4px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.inp {
  width: 100%;
  padding: 11px 13px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-base);
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
.form-foot {
  display: flex;
  justify-content: flex-end;
}
.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dr-txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dr-txt b {
  font-size: 14px;
  font-weight: 700;
}
.dr-txt small {
  font-size: 12px;
  color: var(--muted);
}
.btn.danger {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 45%, var(--border));
}
</style>
