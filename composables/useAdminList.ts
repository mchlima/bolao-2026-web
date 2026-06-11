import type { Paginated } from '~/types/api';

/** Paginated admin list with search; refresh after mutations. */
export function useAdminList<T>(path: string, extraQuery: () => string = () => '') {
  const page = ref(1);
  const pageSize = 20;
  const search = ref('');
  const data = ref<Paginated<T> | null>(null);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      const q = new URLSearchParams({
        page: String(page.value),
        pageSize: String(pageSize),
      });
      if (search.value) q.set('search', search.value);
      const extra = extraQuery();
      data.value = await useApi()<Paginated<T>>(
        `${path}?${q.toString()}${extra ? `&${extra}` : ''}`,
      );
    } finally {
      loading.value = false;
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(search, () => {
    page.value = 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 250);
  });
  watch(page, load);

  return { page, pageSize, search, data, loading, load };
}
