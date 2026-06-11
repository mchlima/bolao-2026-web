/**
 * Thin $fetch wrapper bound to the API base (runtimeConfig.public.apiBase).
 * Attaches the bearer token and surfaces the standard error format
 * (see bolao-2026-docs/api/contracts.md).
 */
export function useApi() {
  const { public: { apiBase } } = useRuntimeConfig()
  const token = useCookie<string | null>('bolao-token', { sameSite: 'lax' })

  return $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (token.value) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token.value}`)
      }
    },
  })
}
