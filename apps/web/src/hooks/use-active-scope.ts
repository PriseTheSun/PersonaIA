import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-store';
import { setScopeContext } from '@/lib/api';

export function useActiveScope() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const hasTenantParam = params.has('tenant');
  const tenantId = params.get('tenant') ?? auth.activeScope?.tenantId ?? (auth.status === 'authenticated' ? auth.user.tenantId ?? undefined : undefined);
  const requestedWorkspace = params.get('workspace');
  const tenantWide = requestedWorkspace === 'all';
  const requestedContext = auth.status === 'authenticated' ? auth.user.contexts?.find((context) => context.tenantId === tenantId) : undefined;
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const firstRequiredWorkspace = hasTenantParam && !requestedWorkspace && !isSuperAdmin && requestedContext?.clientRole !== 'CLIENT_ADMIN'
    ? requestedContext?.workspaces.find((workspace) => workspace.status === 'ACTIVE')?.id
    : undefined;
  const workspaceId = tenantWide ? undefined : requestedWorkspace ?? firstRequiredWorkspace ?? (hasTenantParam ? undefined : auth.activeScope?.workspaceId);

  useEffect(() => {
    if (!tenantId) return;
    if (auth.activeScope?.tenantId === tenantId && auth.activeScope.workspaceId === workspaceId) return;
    const scope = { tenantId, ...(workspaceId ? { workspaceId } : {}) };
    setScopeContext(scope);
    auth.selectScope?.(scope);
  }, [auth, tenantId, workspaceId]);

  const selectTenant = (nextTenantId: string) => {
    const next = new URLSearchParams(params);
    if (nextTenantId) next.set('tenant', nextTenantId); else next.delete('tenant');
    const nextContext = auth.status === 'authenticated' ? auth.user.contexts?.find((context) => context.tenantId === nextTenantId) : undefined;
    const canUseTenantScope = isSuperAdmin || nextContext?.clientRole === 'CLIENT_ADMIN';
    const nextWorkspaceId = canUseTenantScope ? undefined : nextContext?.workspaces.find((workspace) => workspace.status === 'ACTIVE')?.id;
    if (canUseTenantScope) next.set('workspace', 'all');
    else if (nextWorkspaceId) next.set('workspace', nextWorkspaceId);
    else next.delete('workspace');
    setParams(next, { replace: true });
    if (nextTenantId) auth.selectScope?.({ tenantId: nextTenantId, ...(nextWorkspaceId ? { workspaceId: nextWorkspaceId } : {}) });
  };

  const selectWorkspace = (nextWorkspaceId: string) => {
    if (!tenantId) return;
    const next = new URLSearchParams(params);
    if (nextWorkspaceId) next.set('workspace', nextWorkspaceId); else next.set('workspace', 'all');
    setParams(next, { replace: true });
    auth.selectScope?.({ tenantId, ...(nextWorkspaceId ? { workspaceId: nextWorkspaceId } : {}) });
  };

  return { tenantId, workspaceId, tenantWide, selectTenant, selectWorkspace };
}
