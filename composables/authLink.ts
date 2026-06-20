import type { RouteLocationRaw } from 'vue-router';

// Build a link to an auth page (/entrar or /cadastro) that returns the user to
// the page they're on after they authenticate — both pages push `?redirect` on
// success. On the auth pages themselves we skip it (their tabs already carry the
// query across, and we never want redirect=/entrar looping back).
export function useAuthLink() {
  const route = useRoute();
  return (path: '/entrar' | '/cadastro'): RouteLocationRaw => {
    if (route.path === '/entrar' || route.path === '/cadastro') return path;
    return { path, query: { redirect: route.fullPath } };
  };
}
