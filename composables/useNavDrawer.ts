// Estado compartilhado do drawer de navegação (a "árvore completa"). O gatilho
// (hambúrguer no AppHeader) e o próprio AppNavDrawer (montado no layout) leem o
// mesmo useState por chave — sem store dedicada.
export function useNavDrawer() {
  const open = useState('nav-drawer-open', () => false);
  return {
    open,
    openDrawer: () => { open.value = true; },
    closeDrawer: () => { open.value = false; },
    toggleDrawer: () => { open.value = !open.value; },
  };
}
