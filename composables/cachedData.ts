import type { NuxtApp } from '#app';

// useAsyncData getCachedData helper: on client-side navigation back to a page,
// serve the data already fetched (from the Nuxt payload cache) instead of
// refetching. Without this, returning to a page re-runs the fetch and the UI
// rebuilds from an empty/loading state — components pop in at different times
// and the layout visibly reflows. Live data stays fresh via each page's
// useRealtime() → refresh(), which bypasses this cache.
export function cachedPayload<T>(key: string, nuxtApp: NuxtApp): T | undefined {
  return (nuxtApp.payload.data[key] ?? (nuxtApp.static?.data as Record<string, unknown>)?.[key]) as
    | T
    | undefined;
}
