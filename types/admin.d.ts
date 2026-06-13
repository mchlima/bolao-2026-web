export {};

declare global {
  /** Column descriptor consumed by <AdminTable>. Global so admin pages can type
      their `COLS` arrays without importing from the component. */
  interface AdminColumn {
    key: string;
    label: string;
    align?: 'start' | 'end';
    /** Hidden entirely on mobile (low-value secondary data). */
    mobileHide?: boolean;
  }
}
