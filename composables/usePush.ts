// Web Push subscription lifecycle for the current browser: ask permission,
// subscribe via the service worker's pushManager (VAPID), and register/remove the
// subscription on the API. Reactive flags drive the Settings toggle.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush() {
  const config = useRuntimeConfig();
  const ui = useUiStore();

  const supported = ref(false);
  const permission = ref<NotificationPermission>('default');
  const subscribed = ref(false);
  const busy = ref(false);

  async function sync() {
    if (!supported.value) return;
    permission.value = Notification.permission;
    try {
      const reg = await navigator.serviceWorker.ready;
      subscribed.value = !!(await reg.pushManager.getSubscription());
    } catch {
      subscribed.value = false;
    }
  }

  onMounted(() => {
    supported.value =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    void sync();
  });

  async function enable(): Promise<void> {
    if (!supported.value || busy.value) return;
    busy.value = true;
    try {
      const perm = await Notification.requestPermission();
      permission.value = perm;
      if (perm !== 'granted') {
        ui.toast('error', 'Permissão de notificações negada.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey as string),
        }));
      const json = sub.toJSON();
      await useApi()('/me/push', {
        method: 'POST',
        body: { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
      });
      subscribed.value = true;
      ui.toast('success', 'Notificações no aparelho ativadas.');
    } catch {
      ui.toast('error', 'Não foi possível ativar as notificações.');
    } finally {
      busy.value = false;
    }
  }

  async function disable(): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await useApi()('/me/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(
          () => undefined,
        );
        await sub.unsubscribe();
      }
      subscribed.value = false;
      ui.toast('success', 'Notificações no aparelho desativadas.');
    } catch {
      ui.toast('error', 'Não foi possível desativar.');
    } finally {
      busy.value = false;
    }
  }

  return { supported, permission, subscribed, busy, enable, disable };
}
