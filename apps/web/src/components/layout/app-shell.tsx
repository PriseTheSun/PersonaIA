import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { AppLogo } from '@/components/shared/app-logo';
import { LanguageSelector } from '@/components/shared/language-selector';
import { ThemeSelector } from '@/components/shared/theme-selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/auth-store';
import { AccountMenu } from './account-menu';
import { Navigation } from './navigation';

export function AppShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);
  if (auth.status !== 'authenticated') return null;
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r bg-muted/35 lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5"><AppLogo /></div>
        <div className="flex-1 overflow-y-auto px-3 py-3"><Navigation role={auth.user.role} /></div>
        <div className="border-t p-3"><LanguageSelector showLabel /></div>
      </aside>
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-sticky flex h-16 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
              <DialogTrigger asChild><Button size="icon" variant="ghost" aria-label={t('common.openMenu')}><Menu aria-hidden="true" /></Button></DialogTrigger>
              <DialogContent className="bottom-0 left-0 top-0 h-full w-[min(288px,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-0">
                <DialogTitle className="sr-only">{t('common.menu')}</DialogTitle>
                <DialogDescription className="sr-only">{t('common.appName')}</DialogDescription>
                <div className="flex h-16 items-center border-b px-5"><AppLogo /></div>
                <div className="px-3 py-4"><Navigation role={auth.user.role} onNavigate={() => setNavigationOpen(false)} /></div>
                <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-3 safe-bottom"><LanguageSelector showLabel /></div>
              </DialogContent>
            </Dialog>
            <AppLogo compact />
          </div>
          <div className="hidden min-w-0 lg:block"><p className="truncate text-sm text-muted-foreground">{auth.user.tenantId ? t('roles.CLIENT_ADMIN') : t('roles.SUPER_ADMIN')}</p></div>
          <div className="ml-auto flex items-center gap-0.5"><LanguageSelector /><ThemeSelector /><AccountMenu /></div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
