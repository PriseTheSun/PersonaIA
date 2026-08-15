import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes, type PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'personaia.sidebar.open.v1';
const DESKTOP_QUERY = '(min-width: 1024px)';

type SidebarContextValue = {
  open: boolean;
  openMobile: boolean;
  isDesktop: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getInitialOpen() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

export function SidebarProvider({ children, className }: PropsWithChildren<{ className?: string }>) {
  const [open, setOpen] = useState(getInitialOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const isDesktop = useDesktopViewport();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  }, [open]);

  useEffect(() => {
    if (isDesktop) setOpenMobile(false);
  }, [isDesktop]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) setOpen((current) => !current);
    else setOpenMobile((current) => !current);
  }, [isDesktop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  const value = useMemo(() => ({ open, openMobile, isDesktop, setOpenMobile, toggleSidebar }), [open, openMobile, isDesktop, toggleSidebar]);
  const style = {
    '--sidebar-width': '15.5rem',
    '--sidebar-width-icon': '4.5rem',
    '--sidebar-current-width': open ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)',
  } as CSSProperties;

  return <SidebarContext.Provider value={value}><div className={cn('min-h-screen w-full bg-background', className)} style={style}>{children}</div></SidebarContext.Provider>;
}

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used inside SidebarProvider');
  return context;
}

export function Sidebar({ children, className, mobileTitle, mobileDescription }: PropsWithChildren<{ className?: string; mobileTitle: string; mobileDescription: string }>) {
  const { open, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <aside
        data-sidebar="sidebar"
        data-state={open ? 'expanded' : 'collapsed'}
        data-collapsible={open ? '' : 'icon'}
        className={cn('group/sidebar fixed inset-y-0 left-0 z-sticky hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex', open ? 'w-[var(--sidebar-width)]' : 'w-[var(--sidebar-width-icon)]', className)}
      >
        {children}
      </aside>
      <Dialog open={openMobile} onOpenChange={setOpenMobile}>
        <DialogContent data-sidebar="sidebar" data-collapsible="" className="group/sidebar bottom-0 left-0 top-0 flex h-full w-[min(18rem,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <DialogTitle className="sr-only">{mobileTitle}</DialogTitle>
          <DialogDescription className="sr-only">{mobileDescription}</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="header" className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border px-5', className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="content" className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3', className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="footer" className={cn('shrink-0 border-t border-sidebar-border p-3', className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group" className={cn('flex flex-col gap-1', className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group-label" className={cn('flex h-8 items-center px-3 text-xs font-medium text-sidebar-foreground/60 group-data-[collapsible=icon]/sidebar:sr-only', className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group-content" className={className} {...props} />;
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul data-sidebar="menu" className={cn('flex flex-col gap-1', className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li data-sidebar="menu-item" className={cn('relative', className)} {...props} />;
}

export function SidebarTrigger({ className, openLabel, closeLabel, menuLabel }: { className?: string; openLabel: string; closeLabel: string; menuLabel: string }) {
  const { open, isDesktop, toggleSidebar } = useSidebar();
  const label = isDesktop ? (open ? closeLabel : openLabel) : menuLabel;
  const Icon = isDesktop && open ? PanelLeftClose : PanelLeft;

  return <Button type="button" variant="ghost" size="icon" className={className} aria-label={label} title={label} onClick={toggleSidebar}><Icon aria-hidden="true" /></Button>;
}

export function SidebarRail({ openLabel, closeLabel }: { openLabel: string; closeLabel: string }) {
  const { open, toggleSidebar } = useSidebar();
  const label = open ? closeLabel : openLabel;

  return (
    <button type="button" data-sidebar="rail" aria-label={label} title={label} onClick={toggleSidebar} className="absolute inset-y-0 -right-3 z-20 hidden w-6 items-center justify-center lg:flex after:h-8 after:w-px after:bg-sidebar-border hover:after:bg-sidebar-foreground/35" />
  );
}

export function SidebarInset({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="inset" className={cn('min-h-screen min-w-0 w-full transition-[padding-left] duration-200 ease-out lg:pl-[var(--sidebar-current-width)]', className)} {...props} />;
}
