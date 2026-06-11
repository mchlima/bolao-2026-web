import { DEFAULT_TZ } from '~/utils/format';

/** The display timezone for the current account (falls back to Brasília). */
export function useTz() {
  const auth = useAuthStore();
  return computed(() => auth.user?.timezone || DEFAULT_TZ);
}
