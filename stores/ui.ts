import { defineStore } from 'pinia';

export type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  msg: string;
}
interface ConfirmOpts {
  title: string;
  msg: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([]);
  let tid = 0;

  function toast(type: ToastType, msg: string) {
    const id = ++tid;
    toasts.value = [...toasts.value, { id, type, msg }];
    if (import.meta.client) setTimeout(() => dismiss(id), 4200);
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  const confirmState = ref<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);
  function confirm(opts: ConfirmOpts): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = { ...opts, resolve };
    });
  }
  function resolveConfirm(v: boolean) {
    confirmState.value?.resolve(v);
    confirmState.value = null;
  }

  return { toasts, toast, dismiss, confirmState, confirm, resolveConfirm };
});
