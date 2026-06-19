<script setup lang="ts">
// Account menu body — shared by the header avatar dropdown (desktop) and the
// bottom-nav avatar sheet (mobile). Emits `close` so the host can dismiss.
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const router = useRouter();
const notifications = useNotificationsStore();

function logout() {
  auth.logout();
  emit('close');
  router.push('/');
}
</script>

<template>
  <div class="acct">
    <NuxtLink to="/perfil" class="who" @click="emit('close')">
      <UserAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :size="40" />
      <span class="who-txt">
        <span class="who-name">{{ auth.user?.name }}</span>
        <span class="who-email">{{ auth.user?.email }}</span>
      </span>
    </NuxtLink>
    <div class="sep" />
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
</template>

<style scoped>
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
.who-txt {
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
