import type { PoolDetail } from '~/types/api';

/**
 * Shared pool detail, keyed by id — the pool layout (`pools/[id].vue`) and every
 * tab page reuse the same cached result, so the header stays put while tabs swap
 * and a mutation in one tab refreshes the whole thing.
 */
export function usePoolDetail(id: string) {
  return useAsyncData<PoolDetail>(`pool-${id}`, () => usePools().detail(id));
}

/** Standard `{ code, message }` error message from a failed $fetch call. */
export function poolError(e: unknown): string {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Algo deu errado.';
}
