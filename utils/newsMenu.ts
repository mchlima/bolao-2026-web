import type { TermPage } from '~/types/api';

/** Nó da árvore de categorias do menu de Notícias (cascata desktop). */
export interface MenuNode {
  name: string;
  slug: string;
  total: number;
  children: MenuNode[];
}

/** Lista plana (com parentSlug) → árvore aninhada, ordenada por nome em cada nível. */
export function buildNewsTree(items: TermPage[]): MenuNode[] {
  const nodes = new Map<string, MenuNode>();
  for (const it of items) nodes.set(it.slug, { name: it.name, slug: it.slug, total: it.total, children: [] });
  const roots: MenuNode[] = [];
  for (const it of items) {
    const node = nodes.get(it.slug)!;
    const parent = it.parentSlug ? nodes.get(it.parentSlug) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (arr: MenuNode[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
