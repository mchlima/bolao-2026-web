<script setup lang="ts">
import type { AppNotification } from '~/types/api';

// Conta → Notificações: central de notificações (inbox). O badge ao vivo é
// mantido pela NotificationsBridge; aqui carregamos a lista completa.
useSeoMeta({ title: 'Notificações — Cravei' });

const store = useNotificationsStore();

onMounted(() => store.fetchList());

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

async function open(n: AppNotification) {
  await store.markRead(n.id);
  if (n.url) navigateTo(n.url);
}
</script>

<template>
  <div class="container page">
    <div class="head">
      <h1 class="page-title">Notificações</h1>
      <button
        v-if="store.unread"
        class="readall"
        @click="store.markAllRead()"
      >
        Marcar todas como lidas
      </button>
    </div>

    <div v-if="store.loaded && !store.items.length" class="empty">
      <AppIcon name="bell" :size="30" :stroke="1.6" />
      <p>Nenhuma notificação por aqui ainda.</p>
      <NuxtLink to="/meus-times" class="lnk">Siga seus times para receber lembretes →</NuxtLink>
    </div>

    <ul v-else class="list">
      <li
        v-for="n in store.items"
        :key="n.id"
        class="item"
        :class="{ unread: !n.readAt, link: !!n.url }"
        @click="open(n)"
      >
        <span class="dot" :class="{ on: !n.readAt }" />
        <span class="body">
          <span class="row1">
            <span class="title">{{ n.title }}</span>
            <span class="time">{{ relative(n.createdAt) }}</span>
          </span>
          <span class="text">{{ n.body }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page {
  padding-top: 22px;
  padding-bottom: 40px;
  max-width: 620px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 24px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0;
}
.readall {
  flex: none;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
}
.readall:hover {
  color: var(--text);
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
}
.empty p {
  margin: 0;
  font-size: 14px;
}
.lnk {
  font-size: 13px;
  font-weight: 700;
  color: var(--emerald);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  gap: 11px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-surface);
}
.item.link {
  cursor: pointer;
}
.item.link:hover {
  border-color: color-mix(in srgb, var(--gold) 40%, var(--border));
}
.item.unread {
  background: color-mix(in srgb, var(--azure) 7%, var(--bg-surface));
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: transparent;
}
.dot.on {
  background: var(--azure);
}
.body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.row1 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.title {
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.time {
  flex: none;
  font-size: 11px;
  color: var(--muted);
}
.text {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.35;
}
</style>
