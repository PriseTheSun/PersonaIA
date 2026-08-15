import { createContext, useContext } from 'react';

export type SidebarContextValue = {
  open: boolean;
  openMobile: boolean;
  isDesktop: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used inside SidebarProvider');
  return context;
}
