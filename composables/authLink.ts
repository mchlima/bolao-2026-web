import type { RouteLocationRaw } from 'vue-router';

// Build a link to an auth page (/login or /register) that returns the user to
// the page they're on after they authenticate — both pages push `?redirect` on
// success. On the auth pages themselves we skip it (their tabs already carry the
// query across, and we never want redirect=/login looping back).
export function useAuthLink() {
  const route = useRoute();
  return (path: '/login' | '/register'): RouteLocationRaw => {
    if (route.path === '/login' || route.path === '/register') return path;
    return { path, query: { redirect: route.fullPath } };
  };
}
