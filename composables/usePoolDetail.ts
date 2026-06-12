import type { PoolDetail } from '~/types/api';

/**
 * Shared pool detail, keyed by id — the pool layout (`pools/[id].vue`) and every
 * tab page reuse the same cached result, so the header stays put while tabs swap
 * and a mutation in one tab refreshes the whole thing.
 */
export function usePoolDetail(id: string) {
  return useAsyncData<PoolDetail>(`pool-${id}`, () => usePools().detail(id));
}

/**
 * Read the pool from cache WITHOUT triggering a fetch — for the tab pages. The
 * layout (`pools/[id].vue`) owns the fetch; if the children re-fetched the same
 * key on every tab navigation they'd flip the shared `pending` and (while the
 * layout swaps `<NuxtPage>`) cancel their own in-flight request, deadlocking the
 * skeleton.
 */
export function usePoolData(id: string) {
  return useNuxtData<PoolDetail>(`pool-${id}`).data;
}

/** Re-run the layout's pool fetch after a mutation in a tab. */
export function refreshPoolData(id: string) {
  return refreshNuxtData(`pool-${id}`);
}

/** Standard `{ code, message }` error message from a failed $fetch call. */
export function poolError(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}
