import type { Competition, Paginated, TermPage } from '~/types/api';
import { buildNewsTree, type MenuNode } from '~/utils/newsMenu';

// Estrutura de navegação COMPLETA, compartilhada: o drawer (hambúrguer, mobile) e
// o menu da topbar (desktop) leem daqui, de modo que ambos sejam a MESMA fonte —
// os 3 pilares + categorias de notícia + campeonatos + sub-bolão. As chaves do
// useAsyncData são estáveis, então com os dois componentes montados há uma única
// busca (Nuxt deduplica por chave). Falha silenciosa em ambas.
export function useNavTree() {
  const auth = useAuthStore();

  const { data: cats } = useAsyncData('nav-cats', () =>
    useApi()<TermPage[]>('/content/categories').catch(() => [] as TermPage[]),
  );
  const newsTree = computed<MenuNode[]>(() => buildNewsTree(cats.value ?? []).slice(0, 8));

  // Campeonatos data-driven: cada competição deep-linka pra TEMPORADA vigente
  // (activeSeason, resolvida no backend). ONGOING primeiro, depois UPCOMING.
  const { data: compsData } = useAsyncData('nav-comps', () =>
    useApi()<Paginated<Competition>>('/competitions?pageSize=100').catch(() => null),
  );
  const championships = computed(() => {
    const list = (compsData.value?.data ?? []).filter((c) => c.activeSeason?.slug);
    const rank = (c: Competition) =>
      c.activeSeason?.status === 'ONGOING' ? 0 : c.activeSeason?.status === 'UPCOMING' ? 1 : 2;
    return [...list]
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 6);
  });

  // Itens diretos do pilar Bolão (1º nível do dropdown). Logado: área privada;
  // deslogado: equivalentes públicos (pra o menu não ficar só com o Ranking).
  const bolaoFlat = computed(() =>
    auth.isAuthenticated
      ? [
          { label: 'Meus bolões', to: '/boloes' },
          { label: 'Palpites', to: '/boloes/palpites' },
        ]
      : [
          { label: 'Bolão da Copa do Mundo', to: '/bolao-da-copa-do-mundo-2026' },
          { label: 'Como funciona', to: '/como-funciona' },
        ],
  );
  // Grupo "Ranking" (3º nível: Bolão > Ranking > …): cada competição com temporada
  // ativa tem ranking PÚBLICO por slug.
  const bolaoRanking = computed(() =>
    championships.value.map((c) => ({
      label: c.name,
      to: `/boloes/ranking/${c.urlSlug}`,
    })),
  );
  const bolaoRoot = computed(() =>
    auth.isAuthenticated ? '/boloes' : '/bolao-da-copa-do-mundo-2026',
  );

  return { newsTree, championships, bolaoFlat, bolaoRanking, bolaoRoot };
}
