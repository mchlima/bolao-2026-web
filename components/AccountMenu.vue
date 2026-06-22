<script setup lang="ts">
// Account menu body — shared by the header avatar dropdown (desktop) and the
// drawer account section. Emits `close` so the host can dismiss.
// `dropup` (drawer): o avatar fica fixo no rodapé e clicar abre o menu SUSPENSO
// (flutuante, pra cima), não um acordeão que empurra o conteúdo.
// `down` (header desktop): mesmo toggle flutuante, mas o menu abre pra BAIXO,
// alinhado à direita do avatar.
const props = defineProps<{ dropup?: boolean; down?: boolean }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const router = useRouter();
const notifications = useNotificationsStore();

// Modo flutuante (com botão de toggle): dropup OU down. Sem ele, o corpo está
// sempre visível (sheet da bottom-nav).
const floating = computed(() => props.dropup || props.down);
const open = ref(false);
const showBody = computed(() => !floating.value || open.value);

function logout() {
  auth.logout();
  emit('close');
  router.push('/');
}
</script>

<template>
  <div class="acct" :class="{ dropup, down }">
    <!-- Backdrop pra fechar o menu flutuante ao clicar fora dele. -->
    <button v-if="floating && open" class="dd-back" aria-label="Fechar" @click="open = false" />

    <!-- Avatar como gatilho: no modo flutuante é um botão que abre o menu; senão, link de perfil. -->
    <button v-if="floating" class="who as-btn" :aria-expanded="open" @click="open = !open">
      <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="40" />
      <span class="who-txt">
        <span class="who-name">{{ auth.user?.name }}</span>
        <span class="who-email">{{ auth.user?.email }}</span>
      </span>
      <AppIcon name="chevronDown" :size="18" :stroke="2.4" class="who-go" :class="{ on: open }" />
    </button>
    <NuxtLink v-else to="/perfil" class="who" @click="emit('close')">
      <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="40" />
      <span class="who-txt">
        <span class="who-name">{{ auth.user?.name }}</span>
        <span class="who-email">{{ auth.user?.email }}</span>
      </span>
    </NuxtLink>

    <!-- Corpo do menu (flutua acima/abaixo do avatar no modo flutuante). -->
    <div v-if="showBody" class="body">
      <div v-if="!floating" class="sep" />
      <NuxtLink to="/perfil" class="row" @click="emit('close')">Perfil</NuxtLink>
      <NuxtLink to="/notificacoes" class="row rowflex" @click="emit('close')">
        Notificações
        <span v-if="notifications.unread" class="nbadge">
          {{ notifications.unread > 9 ? '9+' : notifications.unread }}
        </span>
      </NuxtLink>
      <NuxtLink to="/meus-times" class="row" @click="emit('close')">Meus times</NuxtLink>
      <NuxtLink to="/configuracoes" class="row" @click="emit('close')">
        Configurações
      </NuxtLink>
      <template v-if="auth.isAdmin">
        <NuxtLink to="/admin" class="row" @click="emit('close')">Admin</NuxtLink>
      </template>
      <div class="sep" />
      <button class="row danger" @click="logout">Sair</button>
    </div>
  </div>
</template>

<style scoped>
/* Modo suspenso (drawer): o avatar fica no rodapé e o corpo flutua acima dele. */
.acct.dropup,
.acct.down {
  position: relative;
}
.acct.dropup .body,
.acct.down .body {
  position: absolute;
  z-index: 2;
  padding: 6px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(8, 12, 18, 0.18));
}
.acct.dropup .body {
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
}
/* Header desktop: abre pra baixo, alinhado à direita do avatar, com largura própria. */
.acct.down .body {
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
}
.dd-back {
  position: fixed;
  inset: 0;
  z-index: 1;
  border: none;
  background: transparent;
  cursor: default;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
}
.who:hover {
  background: var(--bg-base);
}
.who.as-btn {
  width: 100%;
  border: none;
  background: none;
  font: inherit;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.who-go {
  flex: none;
  margin-left: auto;
  color: var(--muted);
  transition: transform 0.16s;
}
.who-go.on {
  transform: rotate(180deg);
}
.who-txt {
  flex: 1;
  min-width: 0;
}
.who-name {
  display: block;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.who-email {
  display: block;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sep {
  height: 1px;
  background: var(--border);
  margin: 8px 6px;
}
.row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border: none;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
}
.row:hover {
  background: var(--bg-base);
}
.rowflex {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nbadge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--scarlet);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
}
.row.danger {
  color: var(--scarlet);
  font-weight: 700;
}
</style>
