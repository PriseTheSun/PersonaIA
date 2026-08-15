import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { RoleGuard } from '@/features/auth/role-guard';
import { RouteLoading } from '@/components/shared/route-loading';

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })));
const TenantsPage = lazy(() => import('@/features/tenants/tenants-page').then((module) => ({ default: module.TenantsPage })));
const AdminsPage = lazy(() => import('@/features/admins/admins-page').then((module) => ({ default: module.AdminsPage })));
const ProjectsPage = lazy(() => import('@/features/projects/projects-page').then((module) => ({ default: module.ProjectsPage })));
const UsersPage = lazy(() => import('@/features/users/users-page').then((module) => ({ default: module.UsersPage })));
const PermissionsPage = lazy(() => import('@/features/permissions/permissions-page').then((module) => ({ default: module.PermissionsPage })));
const ForbiddenPage = lazy(() => import('@/features/errors/error-pages').then((module) => ({ default: module.ForbiddenPage })));
const NotFoundPage = lazy(() => import('@/features/errors/error-pages').then((module) => ({ default: module.NotFoundPage })));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [{
      element: <AppShell />,
      children: [
        { path: '403', element: <RouteLoading><ForbiddenPage /></RouteLoading> },
        {
          element: <RoleGuard allow={['SUPER_ADMIN', 'CLIENT_ADMIN']} />,
          children: [
            { index: true, element: <RouteLoading><DashboardPage /></RouteLoading> },
            { element: <RoleGuard allow={['SUPER_ADMIN']} />, children: [{ path: 'tenants', element: <RouteLoading><TenantsPage /></RouteLoading> }, { path: 'administrators', element: <RouteLoading><AdminsPage /></RouteLoading> }] },
            { element: <RoleGuard allow={['CLIENT_ADMIN']} />, children: [{ path: 'projects', element: <RouteLoading><ProjectsPage /></RouteLoading> }, { path: 'users', element: <RouteLoading><UsersPage /></RouteLoading> }, { path: 'permissions', element: <RouteLoading><PermissionsPage /></RouteLoading> }] },
            { path: '*', element: <RouteLoading><NotFoundPage /></RouteLoading> },
          ],
        },
      ],
    }],
  },
  { path: '*', element: <RouteLoading><NotFoundPage /></RouteLoading> },
]);
