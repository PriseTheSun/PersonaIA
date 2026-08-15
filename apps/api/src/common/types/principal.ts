export type AppRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER' | 'PROJECT_USER';

export interface Principal {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: AppRole;
  tokenVersion: number;
}
