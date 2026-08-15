import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { AppLogo } from '@/components/shared/app-logo';
import { LanguageSelector } from '@/components/shared/language-selector';
import { ThemeSelector } from '@/components/shared/theme-selector';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider, SidebarRail, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/features/auth/auth-store';
import { AccountMenu } from './account-menu';
import { ContextSwitcher } from './context-switcher';
import { Navigation } from './navigation';
import { NotificationsMenu } from './notifications-menu';

export function AppShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" mobileTitle={t('common.menu')} mobileDescription={t('common.appName')}>
        <SidebarHeader className="border-b border-sidebar-border">
          <span className="group-data-[collapsible=icon]:hidden"><AppLogo /></span>
          <span className="hidden group-data-[collapsible=icon]:block"><AppLogo compact /></span>
          <ContextSwitcher />
        </SidebarHeader>
        <SidebarContent><Navigation role={auth.effectiveRole ?? auth.user.role} /></SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border"><AccountMenu /></SidebarFooter>
        <SidebarRail label={t('common.collapseSidebar')} />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur-sm transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger label={t('common.openMenu')} />
            <span className="lg:hidden"><AppLogo compact /></span>
            <p className="hidden truncate text-sm text-muted-foreground lg:block">{t(`roles.${auth.effectiveRole ?? auth.user.role}`)}</p>
          </div>
          <div className="ml-auto flex items-center gap-0.5"><LanguageSelector /><ThemeSelector /><NotificationsMenu /></div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
