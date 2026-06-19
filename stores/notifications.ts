import { defineStore } from 'pinia';
import type { AppNotification } from '~/types/api';

// In-app notifications: a live unread badge (kept fresh by the per-user SSE room
// `user:{id}`, see NotificationsBridge) plus the inbox list. Mutations are
// optimistic; the API call follows.
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([]);
  const unread = ref(0);
  const loaded = ref(false);

  async function refreshUnread(): Promise<void> {
    try {
      const r = await useApi()<{ count: number }>('/notifications/unread-count');
      unread.value = r.count;
    } catch {
      /* ignore — badge just stays as-is */
    }
  }

  async function fetchList(): Promise<void> {
    try {
      items.value = await useApi()<AppNotification[]>('/notifications');
      unread.value = items.value.filter((n) => !n.readAt).length;
      loaded.value = true;
    } catch {
      /* ignore */
    }
  }

  async function markRead(id: string): Promise<void> {
    const n = items.value.find((x) => x.id === id);
    if (n && !n.readAt) {
      n.readAt = new Date().toISOString();
      unread.value = Math.max(0, unread.value - 1);
    }
    try {
      await useApi()(`/notifications/${id}/read`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }

  async function markAllRead(): Promise<void> {
    if (!unread.value && items.value.every((n) => n.readAt)) return;
    const now = new Date().toISOString();
    items.value.forEach((n) => {
      if (!n.readAt) n.readAt = now;
    });
    unread.value = 0;
    try {
      await useApi()('/notifications/read-all', { method: 'POST' });
    } catch {
      /* ignore */
    }
  }

  function reset(): void {
    items.value = [];
    unread.value = 0;
    loaded.value = false;
  }

  return { items, unread, loaded, refreshUnread, fetchList, markRead, markAllRead, reset };
});
