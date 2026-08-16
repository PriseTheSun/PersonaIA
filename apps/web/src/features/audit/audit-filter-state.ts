export type AuditFilterState = {
  search: string;
  action: string;
  targetType: string;
  tenantId: string;
  from: string;
  to: string;
};

export const emptyAuditFilters: AuditFilterState = {
  search: '', action: '', targetType: '', tenantId: '', from: '', to: '',
};
