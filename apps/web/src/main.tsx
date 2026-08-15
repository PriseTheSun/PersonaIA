import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/auth-context';
import { I18nProvider } from '@/i18n/i18n-provider';
import { router } from '@/router';
import { AppToaster } from '@/components/ui/sonner';
import '@/styles/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <AppToaster />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
